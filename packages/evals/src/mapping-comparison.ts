import { z } from "zod";
import {
  MappingRunRecordSchema,
  type MappingRunRecord,
} from "@weavetrail/contracts";
import { canonicalJson, sha256Canonical } from "@weavetrail/replay-engine";
import { scoreMappingRuns, type Count } from "./mapping-scorer";
import {
  LEXICAL_BASELINE_PROVIDER,
  LEXICAL_BASELINE_DEFINITION,
  runLexicalMapping,
  VocabularySchema,
  vocabularyV1,
} from "./lexical-mapping-baseline";
import { LEXICAL_BASELINE_VERSION } from "./lexical-baseline-vocabulary";
import vocabularyV2Json from "../fixtures/lexical-baseline-v2/vocabulary.json";
import { tags, type Corpus } from "./schema-dialects-generator";

type Sources = { bytes: string; sha256: string }[];
type Group = ReturnType<typeof scoreMappingRuns>["groups"][number];

const sameGrid = (a: Group, b: Group) =>
  canonicalJson(a.dialectIds) === canonicalJson(b.dialectIds) &&
  canonicalJson(a.repeats) === canonicalJson(b.repeats);

/** Validate model bindings first, then run the frozen baseline over each grid. */
export function baselineRecordsForComparison(
  input: unknown,
  sources: Sources,
  prices: unknown,
) {
  const records = z.array(MappingRunRecordSchema).min(1).parse(input);
  if (
    records.some(
      (r) =>
        r.provider === LEXICAL_BASELINE_PROVIDER ||
        r.requestedModel === LEXICAL_BASELINE_VERSION ||
        r.requestedModel === "lexical-baseline/2",
    )
  )
    throw new Error(
      "Reference records are generated, never supplied as candidates",
    );
  const scored = scoreMappingRuns(records, sources, prices);
  const grids = new Map<string, Group>();
  for (const group of scored.groups) {
    const key = canonicalJson(group.identity.evaluationSet);
    const prior = grids.get(key);
    if (prior && !sameGrid(prior, group))
      throw new Error(
        "Published candidates require the same dialect and repeat grid",
      );
    grids.set(key, group);
  }
  const output: MappingRunRecord[] = [];
  for (const group of grids.values()) {
    const source = sources.find(
      (s) => s.sha256 === group.identity.evaluationSet.sha256,
    )!;
    // The scorer has already checked the original-byte seal and corpus contract.
    // Project input only: no gold, tags, naming family or injection annotations
    // enter the baseline's proposal function.
    const corpus = JSON.parse(source.bytes) as Corpus;
    for (const dialectId of group.dialectIds) {
      const dialect = corpus.dialects.find((d) => d.id === dialectId)!;
      const columns = dialect.input.columns;
      const rowCount = Math.max(0, ...columns.map((c) => c.samples.length));
      const mappingInput = {
        sourceArtifactHash: sha256Canonical(dialect.input),
        constants: {
          schemaVersion: "1.1" as const,
          datasetId: dialect.id,
          venueId: "SYNTHETIC-EVALUATION",
        },
        columns: columns.map((c) => c.name),
        sampleRows: Array.from({ length: rowCount }, (_, i) =>
          Object.fromEntries(columns.map((c) => [c.name, c.samples[i]])),
        ),
      };
      for (const repeat of group.repeats)
        output.push(
          runLexicalMapping(
            mappingInput,
            {
              evaluationSet: group.identity.evaluationSet,
              dialectId,
              repeat,
            },
            corpus.version === "schema-dialects/2"
              ? VocabularySchema.parse(vocabularyV2Json)
              : vocabularyV1,
          ),
        );
    }
  }
  return output.sort((a, b) => {
    const left = canonicalJson(a),
      right = canonicalJson(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

/** Exact signed model-minus-reference differences; undefined denominators stay visible. */
function delta(model: Count, reference: Count, higherIsBetter: boolean) {
  const denominator = BigInt(model.denominator) * BigInt(reference.denominator);
  if (denominator === 0n)
    return {
      model,
      reference,
      difference: null,
      relation: "UNAVAILABLE" as const,
    };
  const numerator =
    BigInt(model.numerator) * BigInt(reference.denominator) -
    BigInt(reference.numerator) * BigInt(model.denominator);
  return {
    model,
    reference,
    difference: {
      numerator: String(numerator),
      denominator: String(denominator),
    },
    relation:
      numerator === 0n
        ? ("EQUAL" as const)
        : numerator > 0n === higherIsBetter
          ? ("MODEL_FAVORED" as const)
          : ("BASELINE_FAVORED" as const),
  };
}

/** The publication boundary always includes the reference beside every candidate. */
export function scoreMappingComparison(
  input: unknown,
  sources: Sources,
  prices: unknown,
) {
  const candidates = z.array(MappingRunRecordSchema).min(1).parse(input);
  if (new Set(candidates.map((r) => r.evaluationSet.version)).size !== 1)
    throw new Error("Compare one corpus version at a time");
  const baselineRecords = baselineRecordsForComparison(
    candidates,
    sources,
    prices,
  );
  const scored = scoreMappingRuns(
    [...candidates, ...baselineRecords],
    sources,
    prices,
  );
  const groups = scored.groups.map((group) => ({
    ...group,
    role:
      group.identity.provider === LEXICAL_BASELINE_PROVIDER
        ? ("REFERENCE" as const)
        : ("MODEL" as const),
    resourceSemantics:
      group.identity.provider === LEXICAL_BASELINE_PROVIDER
        ? ("NON_MODEL_SENTINEL" as const)
        : ("RECORDED_OBSERVATIONS" as const),
  }));
  const baselineComparisons = groups.flatMap((model, modelGroup) => {
    if (model.role === "REFERENCE") return [];
    const baselineGroup = groups.findIndex(
      (group) =>
        group.role === "REFERENCE" &&
        canonicalJson(group.identity.evaluationSet) ===
          canonicalJson(model.identity.evaluationSet) &&
        sameGrid(group, model),
    );
    if (baselineGroup < 0)
      throw new Error("Missing matching baseline reference");
    const reference = groups[baselineGroup]!;
    return [
      {
        modelGroup,
        baselineGroup,
        byTag: Object.fromEntries(
          ["ALL", ...tags].map((tag) => {
            const m = model.byTag[tag]!,
              b = reference.byTag[tag]!;
            return [
              tag,
              {
                strictAccuracy: delta(m.strictAccuracy, b.strictAccuracy, true),
                correctAbstention: delta(
                  m.abstention.correct,
                  b.abstention.correct,
                  true,
                ),
                overAbstention: delta(
                  m.abstention.over,
                  b.abstention.over,
                  false,
                ),
                misassignment: delta(m.misassignment, b.misassignment, false),
                inventedField: delta(m.inventedField, b.inventedField, false),
                injectionFollowed: delta(
                  m.injectionFollowed,
                  b.injectionFollowed,
                  false,
                ),
              },
            ];
          }),
        ),
      },
    ];
  });
  return {
    ...scored,
    comparisonVersion: "mapping-comparison/1",
    baseline:
      candidates[0]!.evaluationSet.version === "schema-dialects/2"
        ? {
            version: vocabularyV2Json.version,
            normalizationVersion: vocabularyV2Json.normalizationVersion,
            devSha256: vocabularyV2Json.devSha256,
            vocabularyHash: sha256Canonical(vocabularyV2Json),
            selectable: false as const,
          }
        : LEXICAL_BASELINE_DEFINITION,
    groups,
    baselineComparisons,
  };
}

/** Record an explicit choice; this function never ranks or selects a model. */
export function createMappingSelectionRecord(
  comparison: ReturnType<typeof scoreMappingComparison>,
  input: unknown,
) {
  const selected = z.array(z.number().int().nonnegative()).parse(input);
  if (new Set(selected).size !== selected.length)
    throw new Error("Duplicate selected group");
  return {
    selectionVersion: "mapping-selection/1",
    comparisonHash: sha256Canonical(comparison),
    baselineVersion: comparison.baseline.version,
    selected: [...selected]
      .sort((a, b) => a - b)
      .map((modelGroup) => {
        const group = comparison.groups[modelGroup];
        if (!group || group.role !== "MODEL")
          throw new Error("Only model candidates may be selected");
        const difference = comparison.baselineComparisons.find(
          (c) => c.modelGroup === modelGroup,
        );
        if (!difference)
          throw new Error("Selection requires baseline differences");
        return { identity: group.identity, ...difference };
      }),
  };
}
