import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PROMPT_VERSIONS } from "@weavetrail/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MappingRunRecordSchema } from "../../../../../packages/contracts/src";
import { loadSelectionInputs } from "../../../../../packages/evals/src/held-out-protocol";
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
  chartPoints,
  definitionLinks,
  dollars,
  failureLogAnchor,
  failureModes,
  fraction,
  percent,
  type HeldOutResult,
} from "./model-comparison-data";

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
  it("states that no held-out run is committed yet", () => {
    expect(committedHeldOutResult).toBeNull();
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
});
