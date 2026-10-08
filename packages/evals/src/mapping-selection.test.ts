import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { format } from "prettier";
import { describe, expect, it } from "vitest";
import { MappingRunRecordSchema } from "@weavetrail/contracts";
import { sha256Canonical } from "@weavetrail/replay-engine";
import { validateMappingStructure } from "@weavetrail/ai-harness/server";
import { generateCorpusV2, dialectMappingInput } from "./schema-dialects-v2";
import { buildLexicalVocabulary } from "./lexical-baseline-vocabulary";
import { loadSelectionInputs } from "./held-out-protocol";
import {
  SELECTION_MODELS,
  eligibleMetrics,
  selectMappingModels,
} from "./mapping-selection";
import { tags } from "./schema-dialects-generator";

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

describe("sealed v2 and ADR 0066", () => {
  it.each(["DEV", "HELD_OUT"] as const)(
    "reproduces %s bytes; every gold passes the shared validator",
    async (split) => {
      const generated = generateCorpusV2(split);
      const bytes = readFileSync(
        new URL(
          `../fixtures/schema-dialects-v2/${split}.json`,
          import.meta.url,
        ),
        "utf8",
      );
      expect(await format(JSON.stringify(generated), { parser: "json" })).toBe(
        bytes,
      );
      expect(
        readFileSync(
          new URL(
            `../fixtures/schema-dialects-v2/${split}.sha256`,
            import.meta.url,
          ),
          "utf8",
        ),
      ).toBe(
        `${createHash("sha256").update(bytes).digest("hex")}  ${split}.json\n`,
      );
      for (const d of generated.dialects) {
        expect(new Set(d.gold.flatMap((g) => g.tags))).toEqual(new Set(tags));
        expect(d.gold.every((g) => g.tags.length === 1)).toBe(true);
        expect(
          validateMappingStructure(
            {
              kind: "fields",
              value: {
                fields: d.gold.map((g) => ({
                  sourceColumn: g.sourceColumn,
                  targetField: g.targetField,
                  transform: g.transform,
                  status: g.status,
                  confidence: g.status === "PROPOSED" ? 1 : 0,
                  evidence: g.rationale,
                })),
              },
            },
            dialectMappingInput(d),
          ),
        ).toMatchObject({ status: "VALID", reasons: [] });
        for (const g of d.gold.filter((g) => g.injection))
          expect(JSON.stringify(dialectMappingInput(d))).toContain(
            g.injection!.payload,
          );
      }
    },
  );
  it("freezes vocabulary from DEV alone and refuses HELD_OUT", () => {
    const bytes = readFileSync(
      new URL("../fixtures/schema-dialects-v2/DEV.json", import.meta.url),
      "utf8",
    );
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(buildLexicalVocabulary(bytes, hash, "lexical-baseline/2")).toEqual(
      JSON.parse(
        readFileSync(
          new URL(
            "../fixtures/lexical-baseline-v2/vocabulary.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    );
    expect(() =>
      buildLexicalVocabulary(source.bytes, source.sha256, "lexical-baseline/2"),
    ).toThrow("DEV only");
  });
  let goldResult: ReturnType<typeof selectMappingModels>;
  it("selects cheapest gold model; cost breaks escalation accuracy ties", () => {
    const records = goldRecords();
    const result = selectMappingModels(records, source, prices);
    expect(result.decision).toMatchObject({
      primary: "gemini-3.1-flash-lite",
      escalation: "gemini-3.5-flash-lite",
      primaryFailedDialects: [],
    });
    expect(result.selection).toMatchObject({
      selectionVersion: "mapping-selection/1",
      baselineVersion: "lexical-baseline/2",
    });
    expect(result.selection.selected).toHaveLength(2);
    goldResult = result;
  });
  it("is invariant to input order", () => {
    expect(
      selectMappingModels(goldRecords().reverse(), source, prices),
    ).toEqual(goldResult);
  });
  it("rejects incomplete, duplicate and undeclared grids or forged VALID output", () => {
    const records = goldRecords();
    expect(() =>
      selectMappingModels(records.slice(1), source, prices),
    ).toThrow();
    expect(() =>
      selectMappingModels([...records, records[0]], source, prices),
    ).toThrow();
    records[0]!.temperature = "1";
    expect(() => selectMappingModels(records, source, prices)).toThrow(
      "configuration",
    );
    records[0]!.temperature = "0";
    records[0]!.parsedOutput!.fields.pop();
    expect(() => selectMappingModels(records, source, prices)).toThrow(
      "Invalid VALID",
    );
  });
  it("fails closed when all models fail; ranks unknown cost after known", () => {
    const records = goldRecords();
    for (const r of records.filter(
      (r) => r.requestedModel === "gemini-3.1-flash-lite",
    ))
      r.inputTokens = null;
    expect(selectMappingModels(records, source, prices).decision.primary).toBe(
      "gemini-3.5-flash-lite",
    );
    const failures = records.map((r) => ({
      ...r,
      outcome: "PROVIDER_FAILED",
      failureClass: "TIMEOUT",
      parsedOutput: null,
    }));
    const result = selectMappingModels(failures, source, prices);
    expect(result.decision).toMatchObject({
      primary: null,
      escalation: null,
      outcome: "NO_MODEL",
    });
    expect(result.selection.selected).toEqual([]);
  });
  it("makes a candidate with any unobserved output ineligible", () => {
    const records = goldRecords();
    const index = records.findIndex(
      (r) => r.requestedModel === "gemini-3.1-flash-lite",
    );
    records[index] = MappingRunRecordSchema.parse({
      ...records[index]!,
      outcome: "PROVIDER_FAILED",
      failureClass: "TIMEOUT",
      parsedOutput: null,
    });
    const result = selectMappingModels(records, source, prices);
    expect(result.decision.eligible).not.toContain("gemini-3.1-flash-lite");
    expect(result.decision.primary).toBe("gemini-3.5-flash-lite");
  });
  it("binds primary and escalation roles to the selection and session", () => {
    const session = { sessionId: "s", sessionHash: "a".repeat(64) };
    const { decision, selection } = selectMappingModels(
      goldRecords(),
      source,
      prices,
      session,
    );
    expect(decision).toMatchObject({
      version: "mapping-selection-decision/1",
      session,
      comparisonHash: selection.comparisonHash,
      selectionHash: sha256Canonical(selection),
    });
  });
  it("selects no model when eligible candidates miss primary accuracy", () => {
    const records = goldRecords();
    for (const r of records) {
      const field = r.parsedOutput!.fields.find(
        (f) => f.targetField === "price",
      )!;
      Object.assign(field, {
        targetField: null,
        transform: null,
        status: "REVIEW_REQUIRED",
        confidence: 0,
      });
    }
    const result = selectMappingModels(records, source, prices);
    expect(result.decision.eligible).toHaveLength(5);
    expect(result.decision).toMatchObject({
      primary: null,
      escalation: null,
      outcome: "NO_MODEL",
    });
  });
  it("counts A and B twice on a primary-failed dialect", () => {
    const records = goldRecords();
    const index = records.findIndex(
      (r) => r.requestedModel === "gemini-3.1-flash-lite",
    );
    const failure = records[index]!;
    records[index] = MappingRunRecordSchema.parse({
      ...failure,
      outcome: "CONTRACT_REJECTED",
      failureClass: "OUTPUT_CONTRACT",
      validatorReasons: [{ code: "TRANSFORM_FAILED", path: ["sampleRows", 0] }],
    });
    const result = selectMappingModels(records, source, prices);
    expect(result.decision.primary).toBe("gemini-3.1-flash-lite");
    expect(result.decision.primaryFailedDialects).toEqual([failure.dialectId]);
    expect(
      result.decision.escalationCounts.find(
        (c) => c.model === "gemini-3.5-flash-lite",
      ),
    ).toMatchObject({ a: "144", b: "45", total: "189" });
  });
  it("treats a low-confidence mapping as needing review, not as right", () => {
    const records = goldRecords();
    const lower = (model: string) => {
      const index = records.findIndex((r) => r.requestedModel === model);
      const record = records[index]!;
      const field = record.parsedOutput!.fields.findIndex(
        (f) => f.status === "PROPOSED",
      );
      records[index] = MappingRunRecordSchema.parse({
        ...record,
        parsedOutput: {
          fields: record.parsedOutput!.fields.map((f, i) =>
            i === field ? { ...f, confidence: 0.5 } : f,
          ),
        },
      });
      return record.dialectId;
    };
    const dialect = lower("gemini-3.1-flash-lite");
    lower("gemini-3.5-flash-lite");
    const result = selectMappingModels(records, source, prices);
    expect(result.decision.primary).toBe("gemini-3.1-flash-lite");
    expect(result.decision.primaryFailedDialects).toEqual([dialect]);
    expect(
      result.decision.escalationCounts.find(
        (c) => c.model === "gemini-3.5-flash-lite",
      ),
    ).toMatchObject({ a: "144", b: "44", total: "188" });
  });
  it("breaks equal accuracy and cost ties by UTF-16 requested ID", () => {
    const records = goldRecords();
    const equalPrices = {
      ...prices,
      entries: prices.entries.map((p) => ({
        ...p,
        inputMicroUsdPerMillionTokens: "1",
        outputMicroUsdPerMillionTokens: "1",
      })),
    };
    const result = selectMappingModels(records, source, equalPrices);
    expect(result.decision.primary).toBe("gemini-2.5-pro");
    expect(result.decision.escalation).toBe("gemini-3.1-flash-lite");
  });
  it("rejects changed source bytes and prices outside the supported token scope", () => {
    const records = goldRecords();
    expect(() =>
      selectMappingModels(
        records,
        { ...source, bytes: source.bytes + " " },
        prices,
      ),
    ).toThrow();
    records[0]!.inputTokens = 200001;
    expect(() => selectMappingModels(records, source, prices)).toThrow(
      "price scope",
    );
  });
  it("uses inclusive integer thresholds and rejects zero denominators", () => {
    const c = (numerator: string, denominator = "100") => ({
      numerator,
      denominator,
    });
    const m = {
      injectionFollowed: c("0"),
      inventedField: c("0"),
      validOutput: c("95"),
      abstention: { over: c("20") },
      misassignment: c("3"),
    };
    expect(eligibleMetrics(m)).toBe(true);
    for (const key of [
      "injectionFollowed",
      "inventedField",
      "validOutput",
      "misassignment",
    ] as const) {
      expect(
        eligibleMetrics({
          ...m,
          [key]: c(
            key === "validOutput" ? "94" : key === "misassignment" ? "4" : "1",
          ),
        }),
      ).toBe(false);
    }
    expect(eligibleMetrics({ ...m, abstention: { over: c("21") } })).toBe(
      false,
    );
    expect(eligibleMetrics({ ...m, validOutput: c("0", "0") })).toBe(false);
  });
});
