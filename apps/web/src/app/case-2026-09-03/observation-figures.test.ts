import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { sha256Canonical } from "@weavetrail/replay-engine";

import {
  publishedCaseProposal,
  replayPublishedCase,
} from "../../lib/published-case";
import { caseCopy } from "./case-copy";
import {
  BaselineRankFigures,
  DenominatorDivergenceFigures,
} from "./observation-figures";
import { proportionalScale } from "./scaled-price";

/**
 * The figures are checked against a real run rather than against a fixture,
 * because their whole claim is that they cannot show a number the engine did
 * not produce. A hand-written specimen would let a figure and its subject drift
 * apart exactly where this test is supposed to catch it.
 */
function runCase() {
  const { proposal } = publishedCaseProposal();
  return replayPublishedCase({
    approvedArtifactHash: sha256Canonical(proposal),
    reviewerRef: "reviewer:local-lab",
    decision: "APPROVED",
    overrides: [],
    approvedAt: "2026-09-07T00:00:00Z",
  });
}

function conclusive() {
  const replay = runCase();
  const evaluation = replay.evaluation;
  if (evaluation.result === "INCONCLUSIVE")
    throw new Error("The published case must reach a conclusive result");
  if (!("sensitivity" in evaluation) || evaluation.sensitivity === null)
    throw new Error("The published case must report a sensitivity comparison");
  return { ...evaluation, sensitivity: evaluation.sensitivity };
}

const LANGUAGES = ["ko", "en"] as const;

function rankMarkup(language: (typeof LANGUAGES)[number]) {
  const evaluation = conclusive();
  return renderToStaticMarkup(
    createElement(BaselineRankFigures, {
      analysis: evaluation.analysis,
      findings: evaluation.findings,
      legNames: caseCopy[language].legNames,
      text: caseCopy[language],
    }),
  );
}

function divergenceMarkup(language: (typeof LANGUAGES)[number]) {
  const evaluation = conclusive();
  return renderToStaticMarkup(
    createElement(DenominatorDivergenceFigures, {
      findings: evaluation.findings,
      legNames: caseCopy[language].legNames,
      legs: evaluation.sensitivity.legs,
      text: caseCopy[language],
    }),
  );
}

/** Every value the figures print as a machine value. */
const printedValues = (markup: string) =>
  [...markup.matchAll(/<code>([^<]*)<\/code>/g)].map(
    ([, value]) => value ?? "",
  );

/** Every inline bar width and threshold offset, as fractions. */
const percentages = (markup: string, property: string) =>
  [...markup.matchAll(new RegExp(`${property}:\\s*([0-9.]+)%`, "g"))].map(
    ([, value]) => Number(value) / 100,
  );

describe("the baseline rank figure", () => {
  it("marks the position the ranked gate reported, and only that one", () => {
    const evaluation = conclusive();
    const gates = evaluation.findings.filter(
      ({ gate }) => gate === "BASELINE_RANK",
    );
    expect(gates.length).toBeGreaterThan(0);
    const markup = rankMarkup("en");
    const slots = [
      ...markup.matchAll(/class="rank-slot" data-analysed="(\w+)"/g),
    ].map(([, analysed]) => analysed === "true");
    // One tick per member of the population, and the analysed date is the only
    // one coloured.
    expect(slots).toHaveLength(
      Number(evaluation.analysis.rank.populationSize) * gates.length,
    );
    expect(slots.filter(Boolean)).toHaveLength(gates.length);
    // The marked tick sits where the gate says it does, counting from one.
    expect(slots.indexOf(true) + 1).toBe(Number(gates[0]!.observedValue));
    expect(gates[0]!.observedValue).toBe(evaluation.analysis.rank.position);
  });

  it("prints the same position, population and range it draws", () => {
    const evaluation = conclusive();
    const gate = evaluation.findings.find(
      ({ gate: name }) => name === "BASELINE_RANK",
    )!;
    for (const language of LANGUAGES) {
      const markup = rankMarkup(language);
      const values = printedValues(markup);
      // The text alternative carries the drawn position, the population it was
      // counted over, and the declared range that population came from.
      expect(values, language).toContain(gate.observedValue);
      expect(values, language).toContain(
        evaluation.analysis.rank.populationSize,
      );
      expect(values, language).toContain(
        `${evaluation.analysis.baselineRange.startDate} — ${evaluation.analysis.baselineRange.endDateInclusive}`,
      );
      // A rank is a position within a declared range, and the figure says so
      // in the contract's own words.
      expect(markup, language).toContain(
        "POSITION_WITHIN_DECLARED_RANGE_NOT_PROBABILITY",
      );
    }
  });
});

describe("the denominator divergence figure", () => {
  it("draws every declared denominator's metric against the gate's threshold", () => {
    const evaluation = conclusive();
    const markup = divergenceMarkup("en");
    for (const leg of evaluation.sensitivity.legs) {
      const threshold = evaluation.findings.find(
        (finding) =>
          finding.gate === "LEG_REVERSAL_MULTIPLE" &&
          finding.legId === leg.legId,
      )!.threshold;
      const values = printedValues(markup);
      for (const metric of [leg.approved, ...leg.alternatives]) {
        expect(values, metric.denominatorId).toContain(metric.metricValue);
        expect(values, metric.denominatorId).toContain(metric.denominatorValue);
      }
      for (const alternative of leg.alternatives)
        if (alternative.ratioToApprovedMetric !== null)
          expect(values, alternative.denominatorId).toContain(
            alternative.ratioToApprovedMetric,
          );
      expect(markup, leg.legId).toContain(threshold);
    }
  });

  it("sizes every bar from the reported metric, on a scale that starts at zero", () => {
    const evaluation = conclusive();
    const markup = divergenceMarkup("en");
    const widths = percentages(markup, "width");
    const offsets = percentages(markup, "inset-inline-start");
    const expectedWidths: number[] = [];
    const expectedOffsets: number[] = [];
    for (const leg of evaluation.sensitivity.legs) {
      const threshold = evaluation.findings.find(
        (finding) =>
          finding.gate === "LEG_REVERSAL_MULTIPLE" &&
          finding.legId === leg.legId,
      )!.threshold;
      const metrics = [leg.approved, ...leg.alternatives].map(
        ({ metricValue }) => metricValue,
      );
      const scale = proportionalScale([...metrics, threshold], 0, 1);
      for (const metric of metrics) {
        expectedWidths.push(scale(metric));
        expectedOffsets.push(scale(threshold));
      }
    }
    // Four decimal places of a percentage, which is what the markup carries.
    const rounded = (value: number) => Number((value * 100).toFixed(4));
    expect(widths.map(rounded)).toEqual(expectedWidths.map(rounded));
    expect(offsets.map(rounded)).toEqual(expectedOffsets.map(rounded));
    // The approved denominator is the larger metric here, so it fills the
    // track and the alternative's near-absence is the comparison's point.
    expect(Math.max(...widths)).toBe(1);
    expect(Math.min(...widths)).toBeLessThan(0.01);
  });

  it("names the comparison as a recomputation rather than a conclusion", () => {
    const evaluation = conclusive();
    expect(evaluation.sensitivity.comparison).toBe(
      "MECHANICAL_METRIC_COMPARISON",
    );
    expect(evaluation.sensitivity.interpretation).toBe(
      "MECHANICAL_RECOMPUTATION_NOT_CAUSAL_CONCLUSION",
    );
    for (const language of LANGUAGES) {
      const caveat = caseCopy[language].divergenceCaveat;
      expect(caveat, language).toMatch(
        /다시 계산한 것뿐입니다|recomputed under a different denominator/,
      );
      expect(caveat, language).toMatch(/원인|causal/);
    }
  });
});

describe("both observation figures", () => {
  it("print no value the run did not return", () => {
    // The strongest form of "derived from runtime output": every machine value
    // either figure prints has to appear in the result the engine returned.
    // A figure that computed its own number would fail here.
    const replay = runCase();
    const returned = JSON.stringify(replay.evaluation);
    for (const language of LANGUAGES) {
      const values = [
        ...printedValues(rankMarkup(language)),
        ...printedValues(divergenceMarkup(language)),
      ];
      expect(values.length, language).toBeGreaterThan(0);
      for (const value of values) {
        // The baseline range prints as one span, so it is checked by its ends.
        for (const part of value.split(" — "))
          expect(returned, `${language} ${part}`).toContain(part);
      }
    }
  });

  it("keeps both figures legible at the narrowest viewport and in both themes", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/styles.css"),
      "utf8",
    );
    // Values are HTML text in a grid that collapses, not labels inside a fixed
    // viewBox that shrink with the picture.
    for (const selector of [".rank-facts", ".divergence-values"]) {
      const rule = new RegExp(
        `\\${selector} \\{[^}]*grid-template-columns: repeat\\(auto-fit, minmax\\(min\\(`,
      );
      expect(rule.test(styles), selector).toBe(true);
    }
    // Every colour comes from a theme token, so the figures follow the
    // reader's theme instead of carrying a second palette.
    const block = styles.slice(
      styles.indexOf(".rank-figure,"),
      styles.indexOf(".case-stop-grid {"),
    );
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const token of ["--red-600", "--slate-500", "--amber-600"])
      expect(block, token).toContain(token);
  });
});
