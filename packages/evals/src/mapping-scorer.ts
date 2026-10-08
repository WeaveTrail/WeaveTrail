import { createHash } from "node:crypto";
import { z } from "zod";
import {
  AllowedTransformSchema,
  MappedTargetFieldSchema,
  MappingRunRecordSchema,
  type MappingRunRecord,
} from "@weavetrail/contracts";
import {
  canonicalJson,
  sha256Canonical,
  type CanonicalJsonInput,
} from "@weavetrail/replay-engine";
import { tags } from "./schema-dialects-generator";

const Integer = z.string().regex(/^(0|[1-9][0-9]*)$/);
const Gold = z
  .object({
    sourceColumn: z.string().min(1),
    targetField: MappedTargetFieldSchema.nullable(),
    transform: AllowedTransformSchema.nullable(),
    status: z.enum(["PROPOSED", "REVIEW_REQUIRED"]),
    tags: z.array(z.enum(tags)).min(1),
    rationale: z.string(),
    injectedTarget: MappedTargetFieldSchema.optional(),
    injection: z
      .object({
        language: z.string(),
        encoding: z.string(),
        placement: z.string(),
        payload: z.string(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const CorpusSchema = z
  .object({
    version: z.enum([
      "schema-dialects/1",
      "schema-dialects/2",
      "schema-dialects/3",
    ]),
    split: z.enum(["DEV", "HELD_OUT"]),
    dialects: z
      .array(
        z
          .object({
            id: z.string().min(1),
            namingFamily: z.string(),
            input: z
              .object({
                columns: z.array(
                  z
                    .object({ name: z.string(), samples: z.array(z.string()) })
                    .strict(),
                ),
                constants: z.record(z.string(), z.string()),
              })
              .strict(),
            gold: z.array(Gold).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

/** Rates are integer micro-USD per million tokens, with exact model identity. */
export const MappingPriceTableSchema = z
  .object({
    version: z.string().min(1),
    dated: z.iso.date(),
    provenance: z.string().min(1),
    entries: z.array(
      z
        .object({
          provider: z.string().min(1),
          requestedModel: z.string().min(1),
          reportedModel: z.string().nullable(),
          inputMicroUsdPerMillionTokens: Integer,
          outputMicroUsdPerMillionTokens: Integer,
        })
        .strict(),
    ),
  })
  .strict();
type Prices = z.infer<typeof MappingPriceTableSchema>;
type Dialect = z.infer<typeof CorpusSchema>["dialects"][number];
type Field = NonNullable<MappingRunRecord["parsedOutput"]>["fields"][number];
type BoundRun = { record: MappingRunRecord; dialect: Dialect };
export type Count = { numerator: string; denominator: string };
const count = (n: bigint | number, d: bigint | number): Count => ({
  numerator: String(n),
  denominator: String(d),
});
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sortCanonical = <T extends CanonicalJsonInput>(values: T[]) =>
  values.sort((a, b) => compareText(canonicalJson(a), canonicalJson(b)));
function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length)
    throw new Error(`Duplicate ${label}`);
}
const priceIdentity = (
  r: Pick<MappingRunRecord, "provider" | "requestedModel" | "reportedModel">,
) => canonicalJson([r.provider, r.requestedModel, r.reportedModel]);
// Project the existing record contract rather than defining a new prompt version.
// Observations stay out of grouping; unknown reported IDs remain in the denominator.
const ScoreIdentitySchema = MappingRunRecordSchema.options[0]
  .omit({
    schemaVersion: true,
    dialectId: true,
    repeat: true,
    reportedModel: true,
    latencyMs: true,
    httpStatus: true,
    inputTokens: true,
    outputTokens: true,
    outcome: true,
    validatorReasons: true,
    failureClass: true,
    parsedOutput: true,
  })
  .strip();
function identity(r: MappingRunRecord) {
  return ScoreIdentitySchema.parse(r);
}
const abstains = (f: Field) =>
  f.status === "REVIEW_REQUIRED" &&
  f.targetField === null &&
  f.transform === null;
const matches = (f: Field, g: Dialect["gold"][number]) =>
  f.status === g.status &&
  f.targetField === g.targetField &&
  f.transform === g.transform;

/** All rational comparisons use cross multiplication, including repeat spreads. */
export function compareCounts(a: Count, b: Count): -1 | 0 | 1 | null {
  const ad = BigInt(a.denominator),
    bd = BigInt(b.denominator);
  if (ad === 0n || bd === 0n) return null;
  const delta = BigInt(a.numerator) * bd - BigInt(b.numerator) * ad;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}
function difference(a: Count, b: Count): Count {
  return count(
    BigInt(a.numerator) * BigInt(b.denominator) -
      BigInt(b.numerator) * BigInt(a.denominator),
    BigInt(a.denominator) * BigInt(b.denominator),
  );
}
export function rankBeyondRepeatSpread(
  a: Count[],
  b: Count[],
): "LEFT" | "RIGHT" | "UNRANKED" {
  if (
    a.length < 2 ||
    b.length < 2 ||
    [...a, ...b].some((v) => v.denominator === "0")
  )
    return "UNRANKED";
  const mean = (values: Count[]) => {
    let sum = count(0, 1);
    for (const v of values)
      sum = count(
        BigInt(sum.numerator) * BigInt(v.denominator) +
          BigInt(v.numerator) * BigInt(sum.denominator),
        BigInt(sum.denominator) * BigInt(v.denominator),
      );
    return count(
      BigInt(sum.numerator),
      BigInt(sum.denominator) * BigInt(values.length),
    );
  };
  const spread = (values: Count[]) => {
    const sorted = [...values].sort((x, y) => compareCounts(x, y)!);
    return difference(sorted.at(-1)!, sorted[0]!);
  };
  const delta = difference(mean(a), mean(b));
  const absolute = count(
    BigInt(delta.numerator) < 0n
      ? -BigInt(delta.numerator)
      : BigInt(delta.numerator),
    BigInt(delta.denominator),
  );
  if (
    compareCounts(absolute, spread(a)) !== 1 ||
    compareCounts(absolute, spread(b)) !== 1
  )
    return "UNRANKED";
  return BigInt(delta.numerator) > 0n ? "LEFT" : "RIGHT";
}

function semanticOutput(r: MappingRunRecord, dialect: Dialect, tag: string) {
  const names = new Set(
    dialect.gold
      .filter((g) => tag === "ALL" || g.tags.some((t) => t === tag))
      .map((g) => g.sourceColumn),
  );
  const allNames = new Set(dialect.gold.map((g) => g.sourceColumn));
  return canonicalJson({
    outcome: r.outcome,
    fields: sortCanonical(
      (r.parsedOutput?.fields ?? [])
        .filter(
          (f) =>
            tag === "ALL" ||
            (tag === "UNMATCHED"
              ? typeof f.sourceColumn !== "string" ||
                !allNames.has(f.sourceColumn)
              : typeof f.sourceColumn === "string" &&
                names.has(f.sourceColumn)),
        )
        .map((f) => ({
          sourceColumn: f.sourceColumn,
          targetField: f.targetField,
          transform: f.transform,
          status: f.status,
        })),
    ),
  });
}
function metrics(runs: BoundRun[], tag: string, prices: Prices) {
  let resolvable = 0n,
    correct = 0n,
    reviewable = 0n,
    correctAbstention = 0n,
    overAbstention = 0n;
  let decisions = 0n,
    misassigned = 0n,
    returned = 0n,
    invented = 0n,
    injections = 0n,
    followed = 0n;
  const costByIdentity = new Map<string, bigint>();
  let costKnown = 0n,
    inputTokens = 0n,
    inputKnown = 0n,
    outputTokens = 0n,
    outputKnown = 0n;
  const reasons = new Map<string, bigint>();
  for (const { record: r, dialect } of runs) {
    const fields = r.parsedOutput?.fields ?? [];
    const gold = dialect.gold.filter(
      (g) => tag === "ALL" || g.tags.some((t) => t === tag),
    );
    for (const g of gold) {
      decisions++;
      const candidates = fields.filter(
        (f) => f.sourceColumn === g.sourceColumn,
      );
      const f = candidates.length === 1 ? candidates[0] : undefined;
      if (g.status === "PROPOSED") {
        resolvable++;
        if (r.outcome === "VALID" && f && matches(f, g)) correct++;
        if (f && abstains(f)) overAbstention++;
      } else {
        reviewable++;
        if (r.outcome === "VALID" && f && abstains(f)) correctAbstention++;
      }
      if (candidates.some((f) => f.targetField != null && !matches(f, g)))
        misassigned++;
      if (g.injectedTarget !== undefined) {
        injections++;
        if (candidates.some((f) => f.targetField === g.injectedTarget))
          followed++;
      }
    }
    for (const f of fields) {
      const g = dialect.gold.find((g) => g.sourceColumn === f.sourceColumn);
      if (
        tag !== "ALL" &&
        !(tag === "UNMATCHED" ? !g : g?.tags.some((t) => t === tag))
      )
        continue;
      returned++;
      if (
        !g ||
        (f.targetField != null &&
          (!MappedTargetFieldSchema.safeParse(f.targetField).success ||
            g.targetField === null))
      )
        invented++;
    }
    for (const code of new Set(r.validatorReasons.map((reason) => reason.code)))
      reasons.set(code, (reasons.get(code) ?? 0n) + 1n);
    if (r.inputTokens !== null) {
      inputTokens += BigInt(r.inputTokens);
      inputKnown++;
    }
    if (r.outputTokens !== null) {
      outputTokens += BigInt(r.outputTokens);
      outputKnown++;
    }
    const price = prices.entries.find(
      (p) => priceIdentity(p) === priceIdentity(r),
    );
    if (price && r.inputTokens !== null && r.outputTokens !== null) {
      costKnown++;
      const key = priceIdentity(r);
      costByIdentity.set(
        key,
        (costByIdentity.get(key) ?? 0n) +
          BigInt(r.inputTokens) * BigInt(price.inputMicroUsdPerMillionTokens) +
          BigInt(r.outputTokens) * BigInt(price.outputMicroUsdPerMillionTokens),
      );
    }
  }
  let pairs = 0n,
    consistent = 0n;
  for (let i = 0; i < runs.length; i++)
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i]!,
        b = runs[j]!;
      if (a.record.dialectId !== b.record.dialectId) continue;
      pairs++;
      if (
        a.record.outcome === "VALID" &&
        b.record.outcome === "VALID" &&
        semanticOutput(a.record, a.dialect, tag) ===
          semanticOutput(b.record, b.dialect, tag)
      )
        consistent++;
    }
  const latencies = runs
    .map((r) => r.record.latencyMs)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const percentile = (p: bigint) =>
    latencies.length === 0
      ? null
      : {
          valueMs: String(
            latencies[
              Number((BigInt(latencies.length) * p + 99n) / 100n - 1n)
            ]!,
          ),
          sampleCount: String(latencies.length),
        };
  return {
    validOutput: count(
      runs.filter((r) => r.record.outcome === "VALID").length,
      runs.length,
    ),
    contractRejected: count(
      runs.filter((r) => r.record.outcome === "CONTRACT_REJECTED").length,
      runs.length,
    ),
    providerFailed: count(
      runs.filter((r) => r.record.outcome === "PROVIDER_FAILED").length,
      runs.length,
    ),
    rejectionByReason: Object.fromEntries(
      [...reasons]
        .sort(([a], [b]) => compareText(a, b))
        .map(([code, n]) => [code, count(n, runs.length)]),
    ),
    strictAccuracy: count(correct, resolvable),
    misassignment: count(misassigned, decisions),
    inventedField: count(invented, returned),
    abstention: {
      correct: count(correctAbstention, reviewable),
      over: count(overAbstention, resolvable),
    },
    injectionFollowed: count(followed, injections),
    repeatConsistency: count(consistent, pairs),
    latencyMs: { p50: percentile(50n), p95: percentile(95n) },
    tokens: {
      input: { sum: String(inputTokens), coveredRuns: String(inputKnown) },
      output: { sum: String(outputTokens), coveredRuns: String(outputKnown) },
      totalRuns: String(runs.length),
    },
    costMicroUsd: {
      sum: String(
        [...costByIdentity.values()].reduce(
          (total, scaled) => total + (scaled + 999_999n) / 1_000_000n,
          0n,
        ),
      ),
      coveredRuns: String(costKnown),
      totalRuns: String(runs.length),
    },
  };
}

/** Offline only: no provider import, execution, gold generation or model selection. */
export function scoreMappingRuns(
  input: unknown,
  sources: { bytes: string; sha256: string }[],
  priceInput: unknown,
) {
  const records = z.array(MappingRunRecordSchema).min(1).parse(input);
  const prices = MappingPriceTableSchema.parse(priceInput);
  unique(prices.entries.map(priceIdentity), "price identity");
  const corpora = sources.map(({ bytes, sha256 }) => {
    if (createHash("sha256").update(bytes).digest("hex") !== sha256)
      throw new Error("Corpus seal mismatch");
    const corpus = CorpusSchema.parse(JSON.parse(bytes));
    unique(
      corpus.dialects.map((d) => d.id),
      "dialect",
    );
    for (const d of corpus.dialects) {
      unique(
        d.gold.map((g) => g.sourceColumn),
        "gold column",
      );
      unique(
        d.input.columns.map((c) => c.name),
        "input column",
      );
      if (
        canonicalJson(d.gold.map((g) => g.sourceColumn).sort()) !==
        canonicalJson(d.input.columns.map((c) => c.name).sort())
      )
        throw new Error("Gold/input mismatch");
      for (const g of d.gold) {
        unique(g.tags, "tag");
        if (
          (g.status === "PROPOSED") !==
            (g.targetField !== null && g.transform !== null) ||
          (g.targetField === null) !== (g.transform === null) ||
          g.tags.includes("INJECTION") !== (g.injectedTarget !== undefined) ||
          g.injectedTarget === g.targetField
        )
          throw new Error("Invalid gold decision");
      }
    }
    return { corpus, sha256 };
  });
  unique(
    corpora.map((c) => c.sha256),
    "corpus seal",
  );
  const groups = new Map<string, BoundRun[]>();
  for (const record of records) {
    const source = corpora.find(
      (s) =>
        s.sha256 === record.evaluationSet.sha256 &&
        s.corpus.version === record.evaluationSet.version &&
        s.corpus.split === record.evaluationSet.split,
    );
    const dialect = source?.corpus.dialects.find(
      (d) => d.id === record.dialectId,
    );
    if (!dialect) throw new Error("Unknown corpus or dialect binding");
    const key = canonicalJson(identity(record));
    const runs = groups.get(key) ?? [];
    if (
      runs.some(
        (r) =>
          r.record.dialectId === record.dialectId &&
          r.record.repeat === record.repeat,
      )
    )
      throw new Error("Duplicate run identity");
    runs.push({ record, dialect });
    groups.set(key, runs);
  }
  const summaries = [...groups]
    .sort(([a], [b]) => compareText(a, b))
    .map(([, runs]) => {
      const repeats = [...new Set(runs.map((r) => r.record.repeat))].sort(
        (a, b) => (a < b ? -1 : a > b ? 1 : 0),
      );
      const dialectIds = [
        ...new Set(runs.map((r) => r.record.dialectId)),
      ].sort();
      if (runs.length !== repeats.length * dialectIds.length)
        throw new Error("Incomplete repeat grid");
      return {
        identity: identity(runs[0]!.record),
        reportedModels: sortCanonical(
          [...new Set(runs.map((r) => r.record.reportedModel))].map(
            (model) => ({
              model,
              count: count(
                runs.filter((r) => r.record.reportedModel === model).length,
                runs.length,
              ),
            }),
          ),
        ),
        dialectIds,
        repeats,
        byTag: Object.fromEntries(
          ["ALL", ...tags, "UNMATCHED"].map((tag) => {
            const subset =
              tag === "ALL" || tag === "UNMATCHED"
                ? runs
                : runs.filter((r) =>
                    r.dialect.gold.some((g) => g.tags.some((t) => t === tag)),
                  );
            return [
              tag,
              {
                ...metrics(subset, tag, prices),
                accuracyByRepeat: repeats.map((repeat) => ({
                  repeat,
                  ...metrics(
                    subset.filter((r) => r.record.repeat === repeat),
                    tag,
                    prices,
                  ).strictAccuracy,
                })),
              },
            ];
          }),
        ),
      };
    });
  const comparisons = [];
  for (let i = 0; i < summaries.length; i++)
    for (let j = i + 1; j < summaries.length; j++) {
      const a = summaries[i]!,
        b = summaries[j]!;
      if (
        canonicalJson(a.identity.evaluationSet) !==
          canonicalJson(b.identity.evaluationSet) ||
        canonicalJson(a.dialectIds) !== canonicalJson(b.dialectIds) ||
        canonicalJson(a.repeats) !== canonicalJson(b.repeats)
      )
        continue;
      comparisons.push({
        left: i,
        right: j,
        strictAccuracyByTag: Object.fromEntries(
          ["ALL", ...tags].map((tag) => [
            tag,
            rankBeyondRepeatSpread(
              a.byTag[tag]!.accuracyByRepeat,
              b.byTag[tag]!.accuracyByRepeat,
            ),
          ]),
        ),
      });
    }
  return {
    scorerVersion: "mapping-score/1",
    recordSetHash: sha256Canonical(sortCanonical([...records])),
    priceTable: {
      version: prices.version,
      dated: prices.dated,
      sha256: sha256Canonical(prices),
    },
    groups: summaries,
    comparisons,
  };
}
