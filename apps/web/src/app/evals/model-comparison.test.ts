import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PROMPT_VERSIONS } from "@weavetrail/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MappingRunRecordSchema } from "../../../../../packages/contracts/src";
import { loadSelectionInputs } from "../../../../../packages/evals/src/held-out-protocol";
import comparison from "../../../../../packages/evals/results/mapping-held-out-v2/comparison.json";
import decision from "../../../../../packages/evals/results/mapping-held-out-v2/decision.json";
import receipt from "../../../../../packages/evals/results/mapping-held-out-v2/sessions/f869738c-fb61-42df-9b50-ecfd9c3b299a/session.json";
import firstComparison from "../../../../../packages/evals/results/mapping-held-out-v1/comparison.json";
import firstDecision from "../../../../../packages/evals/results/mapping-held-out-v1/decision.json";
import {
  SELECTION_MODELS,
  selectMappingModels,
} from "../../../../../packages/evals/src/mapping-selection";
import { LanguageProvider } from "../i18n/language";
import { committedHeldOutResult } from "./held-out-result";
import { ModelComparison } from "./model-comparison";
import { modelComparisonCopy } from "./model-comparison-copy";
import {
  DECLARED_MODELS,
  FAILURE_LOG_ENTRIES,
  PROMPT_HISTORY,
  RULE,
  TAGS,
  chartPoints,
  definitionLinks,
  dollars,
  failureLogAnchor,
  failureModes,
  fraction,
  outputObserved,
  percent,
  type HeldOutResult,
} from "./model-comparison-data";

/** The first capture, where every request failed at the provider. */
const firstSession: HeldOutResult = {
  ...committedHeldOutResult,
  comparison: firstComparison as HeldOutResult["comparison"],
  decision: firstDecision as HeldOutResult["decision"],
};

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

/** Authored gold records over the sealed held-out grid; not provider output. */
const { source, corpus, prices } = loadSelectionInputs();
function goldRecords() {
  return SELECTION_MODELS.flatMap((model) =>
    corpus.dialects.flatMap((d) =>
      [1, 2, 3].map((repeat) =>
        MappingRunRecordSchema.parse({
          schemaVersion: "mapping-run/1",
          evaluationSet: {
            version: corpus.version,
            sha256: source.sha256,
            split: "HELD_OUT",
          },
          dialectId: d.id,
          repeat,
          provider: "google",
          requestedModel: model,
          reportedModel: model,
          adapterVersion: "openai-compatible-mapping/1",
          promptVersion: "schema-mapping/1",
          outputSchemaVersion: "mapping-fields/1",
          validatorVersion: "mapping-validator/2",
          temperature: "0",
          latencyMs: 0,
          inputTokens: 100,
          outputTokens: 100,
          outcome: "VALID",
          failureClass: null,
          validatorReasons: [],
          parsedOutput: {
            fields: d.gold.map((g) => ({
              sourceColumn: g.sourceColumn,
              targetField: g.targetField,
              transform: g.transform,
              status: g.status,
              confidence: g.status === "PROPOSED" ? 1 : 0,
              evidence:
                "Authored gold regression fixture; not a provider observation.",
            })),
          },
        }),
      ),
    ),
  );
}

function heldOut(records: ReturnType<typeof goldRecords>): HeldOutResult {
  const { comparison, decision } = selectMappingModels(records, source, prices);
  return {
    runDate: "2026-10-09",
    links: {
      records: "https://example.test/records",
      sessionReceipt: "https://example.test/receipt",
    },
    comparison: comparison as unknown as HeldOutResult["comparison"],
    decision: decision as HeldOutResult["decision"],
  };
}

const render = (result: HeldOutResult | null, korean = false) => {
  const element = createElement(ModelComparison, { result });
  return renderToStaticMarkup(
    korean ? createElement(LanguageProvider, null, element) : element,
  );
};

describe("model comparison data", () => {
  it("formats rates and costs with exact integers", () => {
    expect(fraction({ numerator: "2", denominator: "3" })).toBe("2/3");
    expect(percent({ numerator: "2", denominator: "3" })).toBe("66.7%");
    expect(percent({ numerator: "1", denominator: "8" })).toBe("12.5%");
    expect(percent({ numerator: "0", denominator: "0" })).toBeNull();
    expect(dollars("1234")).toBe("$0.001234");
    expect(dollars("2500000")).toBe("$2.50");
    expect(dollars("0")).toBe("$0.00");
  });

  it("names exactly the candidates and thresholds the accepted rule declares", () => {
    expect(DECLARED_MODELS).toEqual(SELECTION_MODELS);
    const rule = read("docs/EVALUATION.md");
    expect(rule).toContain(`valid output\n  ≥ ${fraction(RULE.validOutput)}`);
    expect(rule).toContain(
      `over-abstention ≤ ${fraction(RULE.overAbstention)}`,
    );
    expect(rule).toContain(`misassignment ≤ ${fraction(RULE.misassignment)}`);
    expect(rule).toContain(
      `≥ ${fraction(RULE.primaryAccuracy)} strict accuracy`,
    );
  });

  it("lists every registered prompt version and every failure-log entry", () => {
    expect(Object.keys(PROMPT_HISTORY)).toEqual([...PROMPT_VERSIONS]);
    const log = {
      en: read("docs/AI_FAILURE_LOG.md"),
      ko: read("docs/AI_FAILURE_LOG.ko.md"),
    };
    for (const language of ["en", "ko"] as const) {
      const headings = [...log[language].matchAll(/^### (F-\d{3}): (.+)$/gm)];
      expect(headings.map(([, id, title]) => [id, title])).toEqual(
        FAILURE_LOG_ENTRIES.map((entry) => [entry.id, entry[language]]),
      );
    }
    expect(failureLogAnchor(FAILURE_LOG_ENTRIES[0].en, "F-001")).toBe(
      "#f-001-the-configured-mapping-gate-accepted-transform-invalid-outputs",
    );
  });

  it("links the definitions to headings that exist", () => {
    for (const language of ["en", "ko"] as const) {
      const doc = read(`docs/EVALUATION${language === "ko" ? ".ko" : ""}.md`);
      const links = definitionLinks(language);
      for (const link of [links.metrics, links.rule, links.reference]) {
        const anchor = decodeURIComponent(link.split("#")[1]!);
        const headings = [...doc.matchAll(/^#{2,3} (.+)$/gm)].map(([, h]) =>
          h!
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s-]/gu, "")
            .replace(/\s/g, "-"),
        );
        expect(headings, link).toContain(anchor);
      }
    }
  });

  it("gives both languages the same copy structure", () => {
    const shape = (value: unknown): unknown =>
      typeof value === "function"
        ? "function"
        : Array.isArray(value)
          ? value.map(shape)
          : value && typeof value === "object"
            ? Object.fromEntries(
                Object.entries(value)
                  .sort(([a], [b]) => (a < b ? -1 : 1))
                  .map(([k, v]) => [k, shape(v)]),
              )
            : typeof value;
    expect(shape(modelComparisonCopy.ko)).toEqual(
      shape(modelComparisonCopy.en),
    );
  });
});

describe("model comparison on the evaluation page", () => {
  it("keeps an absent session distinct from a committed no-model result", () => {
    for (const korean of [false, true]) {
      const copy = modelComparisonCopy[korean ? "ko" : "en"];
      const markup = render(null, korean);
      expect(markup).toContain(copy.answer.pending);
      for (const model of DECLARED_MODELS) expect(markup).toContain(model);
      expect(markup).toContain(copy.referenceName);
      expect(markup).toContain(copy.chart.pending);
      for (const entry of FAILURE_LOG_ENTRIES)
        expect(markup).toContain(entry.id);
    }
  });

  it("reports the actual no-model session and links its immutable capture", () => {
    expect(committedHeldOutResult.comparison).toEqual(comparison);
    expect(committedHeldOutResult.decision).toEqual(decision);
    expect(committedHeldOutResult.runDate).toBe(receipt.startedAt.slice(0, 10));
    expect(committedHeldOutResult.decision.session?.sessionId).toBe(
      receipt.sessionId,
    );
    for (const [name, file] of [
      ["records", "records.json"],
      ["sessionReceipt", "session.json"],
    ] as const)
      expect(committedHeldOutResult.links[name]).toBe(
        `https://github.com/WeaveTrail/WeaveTrail/blob/2ef2cc3577cc1370b9377b7d5ae2c4485a77d8fe/packages/evals/results/mapping-held-out-v2/sessions/${receipt.sessionId}/${file}`,
      );
    for (const korean of [false, true]) {
      const copy = modelComparisonCopy[korean ? "ko" : "en"];
      const markup = render(committedHeldOutResult, korean);
      expect(markup).toContain(copy.answer.noModel);
      expect(markup).not.toContain(copy.answer.pending);
      expect(markup).toContain(
        copy.caption.run(committedHeldOutResult.runDate),
      );
      expect(markup).toContain(committedHeldOutResult.links.records);
      expect(markup).toContain(committedHeldOutResult.links.sessionReceipt);
      expect(markup.match(/data-eligible="false"/g)).toHaveLength(5);
    }
  });

  it("reports a committed selection, the baseline row and links every number", () => {
    const result = heldOut(goldRecords());
    expect(result.decision).toMatchObject({
      primary: "gemini-3.1-flash-lite",
      escalation: "gemini-3.5-flash-lite",
    });
    const markup = render(result);
    expect(markup).toContain(
      modelComparisonCopy.en.answer.selected(
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
      ),
    );
    expect(markup).toContain('class="mc-reference"');
    expect(markup.match(/data-eligible="true"/g)).toHaveLength(5);
    expect(markup).toContain("Held-out eligibility, run on 2026-10-09");
    // Every rendered number is a link to its definition.
    for (const [, inner] of markup.matchAll(
      /<a class="mc-number" href="([^"]+)"/g,
    ))
      expect([
        definitionLinks("en").metrics,
        definitionLinks("en").rule,
      ]).toContain(inner);
    const numbers = markup.match(/class="mc-number"/g) ?? [];
    expect(numbers.length).toBeGreaterThan(30);

    const points = chartPoints(result);
    expect(points.filter((p) => p.kind === "reference")).toHaveLength(1);
    expect(points.filter((p) => p.kind === "eligible")).toHaveLength(5);
    expect(points.find((p) => p.kind === "reference")!.costKnown).toBe(false);
    for (const p of points) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
    }
  });

  it("reports no eligible model and how each failed", () => {
    const failures = goldRecords().map((r) => ({
      ...r,
      outcome: "PROVIDER_FAILED" as const,
      failureClass: "TIMEOUT" as const,
      parsedOutput: null,
    }));
    const result = heldOut(
      failures as unknown as ReturnType<typeof goldRecords>,
    );
    expect(result.decision.outcome).toBe("NO_MODEL");
    for (const korean of [false, true]) {
      const copy = modelComparisonCopy[korean ? "ko" : "en"];
      const markup = render(result, korean);
      expect(markup).toContain(copy.answer.noModel);
      expect(
        markup.match(new RegExp(copy.roleValue.noModel, "g")),
      ).toHaveLength(2);
    }
    const model = result.comparison.groups.find((g) => g.role === "MODEL")!;
    expect(failureModes(model).map((m) => m.key)[0]).toBe("providerFailed");
  });

  it("does not plot accuracy for a model whose every request failed", () => {
    const points = chartPoints(firstSession);
    const models = points.filter((p) => p.kind !== "reference");
    expect(models).toHaveLength(DECLARED_MODELS.length);
    for (const p of models) expect([p.y, p.accuracy]).toEqual([null, null]);
    const reference = points.find((p) => p.kind === "reference")!;
    expect(Number.isInteger(reference.y)).toBe(true);
    for (const korean of [false, true]) {
      const copy = modelComparisonCopy[korean ? "ko" : "en"];
      const markup = render(firstSession, korean);
      expect(markup).toContain(copy.chart.unplotted(DECLARED_MODELS.length));
      expect(markup.match(/<g data-kind="[^"]+"/g)).toEqual([
        '<g data-kind="reference"',
      ]);
    }
  });

  it("plots every model with observed output in the recovery session", () => {
    // Only gemini-2.5-pro failed every request at the provider.
    const points = chartPoints(committedHeldOutResult);
    const unplotted = points.filter((p) => p.y === null).map((p) => p.name);
    expect(unplotted).toEqual(["gemini-2.5-pro"]);
    for (const korean of [false, true]) {
      const copy = modelComparisonCopy[korean ? "ko" : "en"];
      expect(render(committedHeldOutResult, korean)).toContain(
        copy.chart.unplotted(1),
      );
    }
  });

  it("shows output-dependent rates as unavailable when no output was observed", () => {
    const models = firstSession.comparison.groups.filter(
      (g) => g.role === "MODEL",
    );
    for (const group of models) {
      expect(outputObserved(group, group.byTag.ALL!)).toBe(false);
      for (const tag of TAGS)
        expect(outputObserved(group, group.byTag[tag]!)).toBe(false);
    }
    for (const korean of [false, true]) {
      const copy = modelComparisonCopy[korean ? "ko" : "en"];
      const markup = render(firstSession, korean);
      const rows = markup.match(/<tr data-eligible="false">.*?<\/tr>/g) ?? [];
      expect(rows).toHaveLength(DECLARED_MODELS.length);
      for (const row of rows) {
        const cells = [...row.matchAll(/<td>(.*?)<\/td>/g)].map(([, c]) => c);
        // Eligibility, six rates, cost; only valid output stays measured.
        const rates = cells.slice(1, 7);
        expect(rates[1]).toContain("0/36 · 0.0%");
        for (const [index, cell] of rates.entries())
          if (index !== 1) expect(cell).toContain(`>${copy.unavailable}<`);
      }
      // Per-tag accuracy is unavailable for every model; the reference is last.
      const tags = markup.match(
        new RegExp(`<caption>${copy.tags.caption}</caption>.*?</table>`),
      )![0];
      for (const row of tags.match(/<tbody>.*<\/tbody>/)![0].split("</tr>"))
        if (row.includes("<td>")) {
          const cells = [...row.matchAll(/<td>(.*?)<\/td>/g)].map(([, c]) => c);
          expect(cells).toHaveLength(DECLARED_MODELS.length + 1);
          for (const cell of cells.slice(0, -1))
            expect(cell).toContain(`>${copy.unavailable}<`);
        }
    }
  });

  it("keeps eligible candidates eligible when none reaches the primary threshold", () => {
    // Constructed decision: every candidate passes the gates, none is primary.
    const passing = heldOut(goldRecords());
    const result: HeldOutResult = {
      ...passing,
      decision: {
        ...passing.decision,
        outcome: "NO_MODEL",
        primary: null,
        escalation: null,
      },
    };
    expect(result.decision.eligible).toHaveLength(DECLARED_MODELS.length);
    for (const korean of [false, true]) {
      const copy = modelComparisonCopy[korean ? "ko" : "en"];
      const markup = render(result, korean);
      expect(markup).toContain(copy.answer.noModel);
      expect(
        markup.match(new RegExp(copy.roleValue.noModel, "g")),
      ).toHaveLength(2);
      expect(markup.match(/data-eligible="true"/g)).toHaveLength(
        DECLARED_MODELS.length,
      );
    }
  });
});
