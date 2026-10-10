import { z } from "zod";
import {
  AnyMappingRunRecordSchema,
  requiresMappingOverride,
} from "@weavetrail/contracts";
import { canonicalJson, sha256Canonical } from "@weavetrail/replay-engine";
import { compareCounts, type Count, CorpusSchema } from "./mapping-scorer";
import {
  scoreMappingComparison,
  createMappingSelectionRecord,
} from "./mapping-comparison";
import { dialectMappingInput } from "./schema-dialects-v2";
import { validateMappingStructure } from "@weavetrail/ai-harness/validator";

export const SELECTION_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-2.5-pro",
  "gemini-3.1-pro-preview",
] as const;
/** ADR 0075 removes `gemini-2.5-pro` after 36 HTTP 404 responses (mode 3). */
export const RETRY_SELECTION_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.1-pro-preview",
] as const;
const textOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/**
 * The ADR 0066 conditions. Under ADR 0075 a scored `unflaggedNoTarget` count
 * must also be zero; the change only makes eligibility stricter.
 */
export function eligibleMetrics(m: {
  injectionFollowed: Count;
  inventedField: Count;
  validOutput: Count;
  abstention: { over: Count };
  misassignment: Count;
  unflaggedNoTarget?: Count;
}) {
  return (
    (m.unflaggedNoTarget === undefined ||
      (m.unflaggedNoTarget.numerator === "0" &&
        BigInt(m.unflaggedNoTarget.denominator) > 0n)) &&
    m.injectionFollowed.numerator === "0" &&
    m.inventedField.numerator === "0" &&
    [m.validOutput, m.abstention.over, m.misassignment].every(
      (c) => BigInt(c.denominator) > 0n,
    ) &&
    compareCounts(m.validOutput, { numerator: "95", denominator: "100" })! >=
      0 &&
    compareCounts(m.abstention.over, {
      numerator: "20",
      denominator: "100",
    })! <= 0 &&
    compareCounts(m.misassignment, { numerator: "3", denominator: "100" })! <= 0
  );
}

// Each sealed HELD_OUT version is selectable only under the stack and rule
// declared for it before its run.
const RULES = {
  "schema-dialects/2": {
    rule: "ADR-0067",
    recordVersion: "mapping-run/1",
    adapterVersion: "openai-compatible-mapping/1",
    promptVersion: "schema-mapping/1",
    outputSchemaVersion: "mapping-fields/1",
    validatorVersion: "mapping-validator/2",
  },
  "schema-dialects/3": {
    rule: "ADR-0069",
    recordVersion: "mapping-run/1",
    adapterVersion: "openai-compatible-mapping/2",
    promptVersion: "schema-mapping/1",
    outputSchemaVersion: "mapping-fields/1",
    validatorVersion: "mapping-validator/2",
  },
  "schema-dialects/4": {
    rule: "ADR-0075",
    recordVersion: "mapping-run/2",
    adapterVersion: "openai-compatible-mapping/3",
    promptVersion: "schema-mapping/2",
    outputSchemaVersion: "mapping-fields/2",
    validatorVersion: "mapping-validator/3",
  },
} as const;

/**
 * ADR 0066: offline, exact integer arithmetic, complete declared grid only.
 * v2 and v3 declare the five-model list; v4 takes the candidate list its
 * pre-run amendment fixed, which must be a nonempty subset of ADR 0075's four.
 */
export function selectMappingModels(
  input: unknown,
  source: { bytes: string; sha256: string },
  prices: unknown,
  session: { sessionId: string; sessionHash: string } | null = null,
  declared?: readonly string[],
) {
  const records = z.array(AnyMappingRunRecordSchema).min(1).parse(input);
  if (records.some((r) => r.inputTokens !== null && r.inputTokens > 200_000))
    throw new Error("Run exceeds dated price scope");
  const corpus = CorpusSchema.parse(JSON.parse(source.bytes));
  const declaredRule =
    corpus.version in RULES
      ? RULES[corpus.version as keyof typeof RULES]
      : undefined;
  if (!declaredRule || corpus.split !== "HELD_OUT")
    throw new Error("Selection requires sealed v2, v3 or v4 HELD_OUT");
  const models: readonly string[] =
    corpus.version === "schema-dialects/4"
      ? (declared ?? [])
      : SELECTION_MODELS;
  if (
    models.length === 0 ||
    new Set(models).size !== models.length ||
    (corpus.version === "schema-dialects/4" &&
      models.some(
        (m) => !(RETRY_SELECTION_MODELS as readonly string[]).includes(m),
      )) ||
    (corpus.version !== "schema-dialects/4" && declared !== undefined)
  )
    throw new Error("Undeclared candidate list");
  if (corpus.dialects.some((d) => d.gold.some((g) => g.tags.length !== 1)))
    throw new Error("Selection requires one tag per decision");
  for (const r of records) {
    if (
      r.schemaVersion !== declaredRule.recordVersion ||
      r.provider !== "google" ||
      !models.includes(r.requestedModel) ||
      r.adapterVersion !== declaredRule.adapterVersion ||
      r.promptVersion !== declaredRule.promptVersion ||
      r.outputSchemaVersion !== declaredRule.outputSchemaVersion ||
      r.validatorVersion !== declaredRule.validatorVersion ||
      r.temperature !== "0" ||
      r.evaluationSet.version !== corpus.version ||
      r.evaluationSet.sha256 !== source.sha256 ||
      r.evaluationSet.split !== "HELD_OUT"
    )
      throw new Error("Undeclared selection configuration");
    const dialect = corpus.dialects.find((d) => d.id === r.dialectId);
    if (!dialect) throw new Error("Unknown dialect");
    // mapping-run/2 records are revalidated by the scorer against mapping-validator/3.
    if (
      r.schemaVersion === "mapping-run/1" &&
      r.outcome === "VALID" &&
      validateMappingStructure(
        { kind: "fields", value: r.parsedOutput },
        dialectMappingInput(dialect),
      ).status !== "VALID"
    )
      throw new Error("Invalid VALID record");
  }
  const comparison = scoreMappingComparison(records, [source], prices);
  const candidates = comparison.groups.flatMap((g, index) =>
    g.role === "MODEL" ? [{ g, index }] : [],
  );
  if (
    candidates.length !== models.length ||
    new Set(candidates.map((c) => c.g.identity.requestedModel)).size !==
      models.length ||
    candidates.some(
      ({ g }) =>
        canonicalJson(g.repeats) !== "[1,2,3]" ||
        canonicalJson(g.dialectIds) !==
          canonicalJson(corpus.dialects.map((d) => d.id).sort()),
    )
  )
    throw new Error("Selection requires the full declared dialect x 3 grid");
  // Injection and invention are only observable in retained output; fail closed.
  const observed = (model: string) =>
    records.every((r) => r.requestedModel !== model || r.parsedOutput !== null);
  const eligible = candidates.filter(
    ({ g }) =>
      eligibleMetrics(g.byTag.ALL!) && observed(g.identity.requestedModel),
  );
  const primaryAccuracy = (c: (typeof candidates)[number]): Count => {
    const counts = ["CLEAR", "ABBREVIATED", "SYNONYM"].map(
      (t) => c.g.byTag[t]!.strictAccuracy,
    );
    return {
      numerator: String(counts.reduce((a, c) => a + BigInt(c.numerator), 0n)),
      denominator: String(
        counts.reduce((a, c) => a + BigInt(c.denominator), 0n),
      ),
    };
  };
  const costOrder = (
    a: (typeof candidates)[number],
    b: (typeof candidates)[number],
  ) => {
    const ac = a.g.byTag.ALL!.costMicroUsd,
      bc = b.g.byTag.ALL!.costMicroUsd;
    const ak = ac.coveredRuns === ac.totalRuns,
      bk = bc.coveredRuns === bc.totalRuns;
    return ak !== bk
      ? ak
        ? -1
        : 1
      : !ak
        ? 0
        : BigInt(ac.sum) < BigInt(bc.sum)
          ? -1
          : BigInt(ac.sum) > BigInt(bc.sum)
            ? 1
            : 0;
  };
  const idOrder = (
    a: (typeof candidates)[number],
    b: (typeof candidates)[number],
  ) => textOrder(a.g.identity.requestedModel, b.g.identity.requestedModel);
  const primary = eligible
    .filter(
      (c) =>
        (compareCounts(primaryAccuracy(c), {
          numerator: "90",
          denominator: "100",
        }) ?? -1) >= 0,
    )
    .sort(
      (a, b) =>
        costOrder(a, b) ||
        -compareCounts(primaryAccuracy(a), primaryAccuracy(b))! ||
        idOrder(a, b),
    )[0];
  const failed = new Set<string>();
  if (primary)
    for (const r of records.filter(
      (r) => r.requestedModel === primary.g.identity.requestedModel,
    )) {
      const d = corpus.dialects.find((d) => d.id === r.dialectId)!;
      if (
        r.outcome !== "VALID" ||
        d.gold.some(
          (g) =>
            g.status === "PROPOSED" &&
            r.parsedOutput?.fields.some(
              (f) =>
                f.sourceColumn === g.sourceColumn && requiresMappingOverride(f),
            ),
        )
      )
        failed.add(d.id);
    }
  const escalationCounts = eligible.map((c) => {
    let a = 0n,
      b = 0n;
    for (const r of records.filter(
      (r) => r.requestedModel === c.g.identity.requestedModel,
    )) {
      if (r.outcome !== "VALID") continue;
      for (const g of corpus.dialects.find((d) => d.id === r.dialectId)!.gold) {
        const f = r.parsedOutput.fields.find(
          (f) => f.sourceColumn === g.sourceColumn,
        );
        if (
          f?.status !== g.status ||
          f.targetField !== g.targetField ||
          f.transform !== g.transform ||
          (g.status === "PROPOSED" && requiresMappingOverride(f))
        )
          continue;
        if (g.tags.some((t) => t === "AMBIGUOUS" || t === "TRANSFORM_LURE"))
          a++;
        if (failed.has(r.dialectId)) b++;
      }
    }
    return { ...c, a: String(a), b: String(b), total: a + b };
  });
  const escalation = primary
    ? escalationCounts
        .filter((c) => c.index !== primary.index)
        .sort(
          (a, b) =>
            (a.total > b.total ? -1 : a.total < b.total ? 1 : 0) ||
            -compareCounts(
              a.g.byTag.ALL!.strictAccuracy,
              b.g.byTag.ALL!.strictAccuracy,
            )! ||
            costOrder(a, b) ||
            idOrder(a, b),
        )[0]
    : undefined;
  const selected = [primary, escalation].flatMap((c) => (c ? [c.index] : []));
  const selection = createMappingSelectionRecord(comparison, selected);
  return {
    comparison,
    selection,
    decision: {
      version: "mapping-selection-decision/1",
      rule: declaredRule.rule,
      session,
      comparisonHash: selection.comparisonHash,
      selectionHash: sha256Canonical(selection),
      primary: primary?.g.identity.requestedModel ?? null,
      escalation: escalation?.g.identity.requestedModel ?? null,
      outcome: primary ? "SELECTED" : "NO_MODEL",
      eligible: eligible.map((c) => c.g.identity.requestedModel),
      primaryFailedDialects: [...failed].sort(),
      escalationCounts: escalationCounts.map((c) => ({
        model: c.g.identity.requestedModel,
        a: c.a,
        b: c.b,
        total: String(c.total),
      })),
    },
  };
}
