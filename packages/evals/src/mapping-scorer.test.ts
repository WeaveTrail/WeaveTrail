import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MappingRunRecordSchema,
  type MappingRunRecord,
} from "@weavetrail/contracts";
import {
  compareCounts,
  MappingPriceTableSchema,
  rankBeyondRepeatSpread,
  scoreMappingRuns,
} from "./mapping-scorer";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const records = JSON.parse(
  read("../fixtures/mapping-score-v1/records.json"),
).map((r: unknown) => MappingRunRecordSchema.parse(r)) as MappingRunRecord[];
const prices = MappingPriceTableSchema.parse(
  JSON.parse(read("../fixtures/mapping-score-v1/prices.json")),
);
const sources = ["DEV", "HELD_OUT"].map((split) => ({
  bytes: read(`../fixtures/schema-dialects-v1/${split}.json`),
  sha256: read(`../fixtures/schema-dialects-v1/${split}.sha256`).split(" ")[0]!,
}));
const score = (runs: unknown = records, table: unknown = prices) =>
  scoreMappingRuns(runs, sources, table);
const oracle = () =>
  structuredClone(
    records.filter((r) => r.requestedModel === "synthetic-oracle"),
  );
const all = (runs: unknown, table: unknown = prices) =>
  score(runs, table).groups[0]!.byTag.ALL!;
const c = (n: number | string, d: number | string) => ({
  numerator: String(n),
  denominator: String(d),
});

function valid(r: MappingRunRecord) {
  if (r.outcome !== "VALID") throw new Error("Expected valid fixture");
  return r;
}

describe("offline mapping score/1", () => {
  it("re-scores committed records byte for byte and is input-order invariant", () => {
    expect(JSON.stringify(score()) + "\n").toBe(
      read("../results/mapping-score-v1.json"),
    );
    expect(score([...records].reverse())).toEqual(score());
  });
  it("runs the verification command with no provider configuration", () => {
    expect(
      execFileSync(
        process.execPath,
        ["--import", "tsx", "packages/evals/src/score-mapping-runs.ts"],
        {
          cwd: new URL("../../../", import.meta.url),
          env: { PATH: process.env.PATH, CI: "true" },
          encoding: "utf8",
        },
      ),
    ).toContain("PASS: offline mapping summary matches committed bytes");
  });
  it("scores exact target, transform and status; confidence and prose cannot earn accuracy", () => {
    const runs = oracle();
    expect(all(runs).strictAccuracy).toEqual(c(14, 14));
    const f = valid(runs[0]!).parsedOutput.fields.find(
      (f) => f.status === "PROPOSED",
    )!;
    f.transform = f.transform === "IDENTITY" ? "DECIMAL_STRING" : "IDENTITY";
    expect(all(runs).strictAccuracy).toEqual(c(13, 14));
    expect(all(runs).misassignment).toEqual(c(1, 28));
    f.status = "REVIEW_REQUIRED";
    expect(all(runs).strictAccuracy).toEqual(c(13, 14));
    expect(all(runs).abstention.over).toEqual(c(0, 14));
  });
  it("always-abstaining records earn zero accuracy and full over-abstention together", () => {
    const m = all(
      records.filter((r) => r.requestedModel === "synthetic-always-abstain"),
    );
    expect(m.strictAccuracy).toEqual(c(0, 14));
    expect(m.abstention).toEqual({ correct: c(14, 14), over: c(14, 14) });
    expect(m.validOutput).toEqual(c(2, 2));
  });
  it("counts invalid runs as misses, separates provider failures and deduplicates reason codes per run", () => {
    const runs = structuredClone(
      records.filter((r) => r.requestedModel === "synthetic-failure-probes"),
    );
    const r = runs[0]!;
    if (r.outcome !== "CONTRACT_REJECTED")
      throw new Error("Expected rejected fixture");
    r.validatorReasons.push(
      { code: "SYNTHETIC_INVALID_TARGET", path: ["fields", 0] },
      { code: "SECOND_REASON", path: [] },
    );
    const m = all(runs);
    expect(m.validOutput).toEqual(c(0, 2));
    expect(m.contractRejected).toEqual(c(1, 2));
    expect(m.providerFailed).toEqual(c(1, 2));
    expect(m.strictAccuracy).toEqual(c(0, 14));
    expect(m.abstention.correct).toEqual(c(0, 14));
    expect(m.rejectionByReason).toEqual({
      SECOND_REASON: c(1, 2),
      SYNTHETIC_INVALID_TARGET: c(1, 2),
    });
    expect(m.inventedField).toEqual(c(2, 15));
    expect(m.misassignment).toEqual(c(2, 28));
    expect(m.injectionFollowed).toEqual(c(2, 4));
    const byTag = score(runs).groups[0]!.byTag;
    expect(byTag.INJECTION!.injectionFollowed).toEqual(c(2, 4));
    expect(byTag.UNMATCHED!.inventedField).toEqual(c(1, 1));
    expect(byTag.CLEAR!.injectionFollowed).toEqual(c(0, 0));
  });
  it("does not award missing or duplicate field decisions a correct score or an abstention", () => {
    const runs = oracle();
    const fields = valid(runs[0]!).parsedOutput.fields;
    const index = fields.findIndex((f) => f.status === "PROPOSED");
    fields.splice(index, 1);
    expect(all(runs).strictAccuracy).toEqual(c(13, 14));
    expect(all(runs).abstention.over).toEqual(c(0, 14));
    const f = fields.find((f) => f.status === "PROPOSED")!;
    fields.push({ ...f });
    expect(all(runs).strictAccuracy).toEqual(c(12, 14));
  });
  it("measures semantic consistency across repeat pairs without rewarding repeated failures", () => {
    const runs = oracle();
    for (const f of valid(runs[1]!).parsedOutput.fields) {
      f.evidence = "Different prose";
      f.confidence = 0;
    }
    valid(runs[1]!).parsedOutput.fields.reverse();
    expect(all(runs).repeatConsistency).toEqual(c(1, 1));
    valid(runs[1]!).parsedOutput.fields.pop();
    expect(all(runs).repeatConsistency).toEqual(c(0, 1));
    expect(all([runs[0]]).repeatConsistency).toEqual(c(0, 0));
    const failure = records.find((r) => r.outcome === "PROVIDER_FAILED")!;
    expect(all([failure, { ...failure, repeat: 3 }]).repeatConsistency).toEqual(
      c(0, 1),
    );
    expect(
      all([runs[0], { ...runs[0], repeat: 3 }, { ...runs[0], repeat: 4 }])
        .repeatConsistency,
    ).toEqual(c(3, 3));
  });
  it("uses nearest-rank latency without interpolation, including failed attempts", () => {
    const runs = oracle();
    const samples = Array.from({ length: 20 }, (_, i) => ({
      ...runs[0],
      repeat: i + 1,
      latencyMs: i + 1,
    }));
    expect(all(samples).latencyMs).toEqual({ p50: c(10, 20), p95: c(19, 20) });
    expect(all([runs[0]]).latencyMs).toEqual({ p50: c(10, 1), p95: c(10, 1) });
    expect(
      all(
        records.filter((r) => r.requestedModel === "synthetic-failure-probes"),
      ).latencyMs.p95,
    ).toEqual(c(30000, 2));
  });
  it("keeps unknown usage and unpriced cost visible, with independent token coverage", () => {
    const runs = oracle();
    runs[1]!.inputTokens = null;
    const m = all(runs);
    expect(m.tokens).toEqual({
      input: c(100, 1),
      output: c(60, 2),
      totalRuns: "2",
    });
    expect(m.costMicroUsd).toEqual({ ...c(200, 1), totalRuns: "2" });
    expect(all(runs, { ...prices, entries: [] }).costMicroUsd).toEqual({
      ...c(0, 0),
      totalRuns: "2",
    });
    expect(
      all(runs.map((r) => ({ ...r, reportedModel: null }))).costMicroUsd
        .denominator,
    ).toBe("0");
  });
  it("ceil-rounds cost once after summing exact integer products, even above safe number range", () => {
    const runs = oracle().map((r) => ({
      ...r,
      inputTokens: 1,
      outputTokens: 1,
    }));
    const table = {
      ...prices,
      entries: prices.entries.map((p) => ({
        ...p,
        inputMicroUsdPerMillionTokens: "1",
        outputMicroUsdPerMillionTokens: "1",
      })),
    };
    expect(all(runs, table).costMicroUsd).toEqual({
      ...c(1, 2),
      totalRuns: "2",
    });
    const large = "9007199254740993";
    const bigTable = {
      ...prices,
      entries: prices.entries.map((p) => ({
        ...p,
        inputMicroUsdPerMillionTokens: large,
        outputMicroUsdPerMillionTokens: large,
      })),
    };
    const huge = runs.map((r) => ({
      ...r,
      inputTokens: Number.MAX_SAFE_INTEGER,
      outputTokens: Number.MAX_SAFE_INTEGER,
    }));
    const expected =
      (4n * BigInt(Number.MAX_SAFE_INTEGER) * BigInt(large) + 999999n) /
      1000000n;
    expect(all(huge, bigTable).costMicroUsd.numerator).toBe(String(expected));
    expect(() =>
      all(runs, { ...table, entries: [...table.entries, table.entries[0]] }),
    ).toThrow("Duplicate price");
  });
  it("shares the scorer with non-model record producers without an identity special case", () => {
    const runs = oracle().map((r) => ({
      ...r,
      provider: "non-model",
      requestedModel: "lexical-baseline/1",
      reportedModel: null,
    }));
    expect(all(runs).strictAccuracy).toEqual(all(oracle()).strictAccuracy);
    expect(all(runs).abstention).toEqual(all(oracle()).abstention);
    // Authored interface fixture only: the actual lexical mapper is separate work.
    expect(all(runs).costMicroUsd.denominator).toBe("0");
  });
  it.each([
    "promptVersion",
    "requestedModel",
    "adapterVersion",
    "validatorVersion",
    "outputSchemaVersion",
    "temperature",
  ] as const)("does not pool different %s", (key) => {
    const runs = oracle();
    runs[1]![key] = key === "temperature" ? "1" : "different-version";
    expect(score(runs).groups).toHaveLength(2);
    expect(score(runs).comparisons).toEqual([]);
  });
  it("keeps missing and differing reported IDs in the requested model denominator", () => {
    const runs = oracle();
    runs[1]!.reportedModel = null;
    const group = score(runs).groups[0]!;
    expect(score(runs).groups).toHaveLength(1);
    expect(group.byTag.ALL!.strictAccuracy).toEqual(c(14, 14));
    expect(group.reportedModels).toHaveLength(2);
    expect(group.byTag.ALL!.costMicroUsd.denominator).toBe("1");
  });
  it("rejects wrong seals, split/version/dialect binding, duplicate runs and incomplete repeat grids", () => {
    expect(() =>
      scoreMappingRuns(
        records,
        [{ ...sources[0]!, bytes: sources[0]!.bytes + " " }],
        prices,
      ),
    ).toThrow("seal");
    for (const change of [
      { split: "HELD_OUT" },
      { version: "other/1" },
      { sha256: "0".repeat(64) },
    ])
      expect(() =>
        score([
          {
            ...records[0],
            evaluationSet: { ...records[0]!.evaluationSet, ...change },
          },
        ]),
      ).toThrow("binding");
    expect(() => score([{ ...records[0], dialectId: "absent" }])).toThrow(
      "binding",
    );
    expect(() => score([records[0], records[0]])).toThrow("Duplicate run");
    const otherId = JSON.parse(sources[0]!.bytes).dialects[1].id;
    expect(() =>
      score([...oracle(), { ...oracle()[0], dialectId: otherId }]),
    ).toThrow("repeat grid");
    expect(() => score([])).toThrow();
  });
  it("validates gold inventory and never scores mutated bytes against an old seal", () => {
    const corpus = JSON.parse(sources[0]!.bytes);
    corpus.dialects[0].gold[0].sourceColumn = "invented";
    const bytes = JSON.stringify(corpus);
    expect(() =>
      scoreMappingRuns(
        records,
        [{ bytes, sha256: createHash("sha256").update(bytes).digest("hex") }],
        prices,
      ),
    ).toThrow("Gold/input mismatch");
  });
  it("keeps DEV and HELD_OUT distinct and compares only identical case inventories", () => {
    const held = JSON.parse(sources[1]!.bytes);
    const base = records.find((r) => r.outcome === "PROVIDER_FAILED")!;
    const run = {
      ...base,
      evaluationSet: {
        version: held.version,
        split: held.split,
        sha256: sources[1]!.sha256,
      },
      dialectId: held.dialects[0].id,
    };
    const result = score([base, run]);
    expect(result.groups).toHaveLength(2);
    expect(result.comparisons).toEqual([]);
  });
});

describe("integer comparisons and repeat-spread ranking", () => {
  it("cross-multiplies without floating-point rounding", () => {
    expect(
      compareCounts(
        c("9007199254740993", "9007199254740994"),
        c("9007199254740992", "9007199254740993"),
      ),
    ).toBe(1);
    expect(compareCounts(c(1, 2), c(2, 4))).toBe(0);
    expect(compareCounts(c(0, 0), c(0, 1))).toBeNull();
  });
  it("requires a strict difference beyond both models' own spreads", () => {
    expect(
      rankBeyondRepeatSpread([c(8, 10), c(10, 10)], [c(6, 10), c(8, 10)]),
    ).toBe("UNRANKED");
    expect(
      rankBeyondRepeatSpread([c(8, 10), c(10, 10)], [c(7, 10), c(7, 10)]),
    ).toBe("UNRANKED");
    expect(
      rankBeyondRepeatSpread([c(8, 10), c(10, 10)], [c(6, 10), c(6, 10)]),
    ).toBe("LEFT");
    expect(
      rankBeyondRepeatSpread([c(6, 10), c(6, 10)], [c(8, 10), c(10, 10)]),
    ).toBe("RIGHT");
    expect(rankBeyondRepeatSpread([c(1, 1)], [c(0, 1)])).toBe("UNRANKED");
    expect(rankBeyondRepeatSpread([c(0, 0), c(0, 0)], [c(0, 1), c(0, 1)])).toBe(
      "UNRANKED",
    );
    expect(
      rankBeyondRepeatSpread([c(1, 2), c(2, 4)], [c(5, 10), c(50, 100)]),
    ).toBe("UNRANKED");
  });
});
