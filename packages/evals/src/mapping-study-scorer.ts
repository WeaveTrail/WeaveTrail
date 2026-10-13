import { z } from "zod";
import {
  MappingStudyRunRecordSchema,
  MappingStudyRouteRecordSchema,
  MAPPING_CONFIDENCE_REVIEW_THRESHOLD,
  type MappingStudyRunRecord,
} from "@weavetrail/contracts";
import { canonicalJson, sha256Canonical } from "@weavetrail/replay-engine";
import {
  mappingMetrics,
  MappingPriceTableSchema,
  compareCounts,
  type Count,
} from "./mapping-scorer";
import {
  bindStudySource,
  studyMappingInput,
  studyMetricDialect,
  type StudySource,
  type StudyDialect,
} from "./mapping-study-data";
import {
  checkedStudyJson,
  readStudyProtocol,
  type StudyBytes,
} from "./mapping-study-protocol";
import {
  studyRecordHash,
  studyRecordArtifact,
  bindStudyRuns,
  studyOfferable,
  synthesizeStudyRoute,
  studyRouteReason,
} from "./mapping-study-runs";
import {
  pairedFamilyBootstrap,
  meanRationals,
  zeroEventFamilyUpperBound,
  rational,
} from "./mapping-study-analysis";
import {
  runStrongMapping,
  StrongBaselineConfigSchema,
} from "./strong-mapping-baseline";
import {
  runLexicalMapping,
  VocabularySchema,
} from "./lexical-mapping-baseline";
import { tags } from "./mapping-corpus-contract";

export const StudySessionSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(["COMPLETED", "STOPPED"]),
    stopReason: z.enum(["NONE", "BUDGET", "OPERATOR", "SAFETY", "TRANSPORT"]),
  })
  .strict()
  .refine(
    (s) => (s.status === "COMPLETED") === (s.stopReason === "NONE"),
    "Session status/stop reason mismatch",
  );
export type StudyScoreInput = {
  protocol: unknown;
  source: StudySource;
  prices: StudyBytes;
  references: { b0: unknown; b1: unknown };
  session: unknown;
  records: unknown;
  routes?: unknown;
};
export function studyAssignmentMatch(
  record: MappingStudyRunRecord,
  dialect: StudyDialect,
  alternatives = false,
) {
  if (record.parsedOutput === null) return false;
  const fields = record.parsedOutput.fields;
  const assignment = dialect.gold.columns.map((g) => {
    const matches = fields.filter((f) => f.columnId === g.columnId),
      field = matches.length === 1 ? matches[0] : undefined;
    return [g.columnId, field?.targetField, field?.transform, field?.status];
  });
  const canonical = dialect.gold.columns.map((g) => [
    g.columnId,
    g.targetField,
    g.transform,
    g.status,
  ]);
  return (
    fields.length === canonical.length &&
    (canonicalJson(assignment) === canonicalJson(canonical) ||
      (alternatives &&
        dialect.gold.acceptedAlternativeAssignments.some(
          (a) => canonicalJson(a) === canonicalJson(assignment),
        )))
  );
}
export function studyStrictMatch(
  record: MappingStudyRunRecord,
  dialect: StudyDialect,
  alternatives = false,
) {
  return (
    record.outcome === "VALID" &&
    studyAssignmentMatch(record, dialect, alternatives)
  );
}

const count = (n: bigint | number, d: bigint | number): Count => ({
  numerator: String(n),
  denominator: String(d),
});
/** Offline only. References run automatically on the same input and grid, never as selectable candidates. */
export function scoreMappingStudy(input: StudyScoreInput) {
  const { protocol, hash: protocolHash } = readStudyProtocol(input.protocol);
  const source = bindStudySource(protocol, input.source),
    session = StudySessionSchema.parse(input.session);
  const prices = MappingPriceTableSchema.parse(checkedStudyJson(input.prices));
  if (protocol.pricesHash !== input.prices.sha256)
    throw new Error("Study price binding mismatch");
  const priceKeys = prices.entries.map((p) =>
    canonicalJson([p.provider, p.requestedModel, p.reportedModel]),
  );
  if (new Set(priceKeys).size !== priceKeys.length)
    throw new Error("Duplicate study price identity");
  const b0 = VocabularySchema.parse(input.references.b0),
    b1 = StrongBaselineConfigSchema.parse(input.references.b1);
  if (
    sha256Canonical(b0) !== protocol.references.b0ConfigurationHash ||
    sha256Canonical(b1) !== protocol.references.b1ConfigurationHash ||
    b0.devSha256 !== protocol.references.devHash ||
    b1.devSha256 !== protocol.references.devHash ||
    b0.version !== "lexical-baseline/3"
  )
    throw new Error("Study reference configuration mismatch");
  const bound = bindStudyRuns(protocol, source, input.records, session.id);
  const grid = bound.filter((b) => b.record.phase === "GRID");
  const missing = protocol.candidates.flatMap((candidate) =>
    source.dialects.flatMap((d) =>
      Array.from({ length: protocol.repeats }, (_, i) => i + 1)
        .filter(
          (repeat) =>
            !grid.some(
              (b) =>
                b.record.candidateId === candidate.id &&
                b.record.dialectId === d.input.dialectId &&
                b.record.repeat === repeat,
            ),
        )
        .map((repeat) => ({
          candidateId: candidate.id,
          dialectId: d.input.dialectId,
          repeat,
        })),
    ),
  );
  if (session.status === "COMPLETED" && missing.length)
    throw new Error("Completed study session has missing runs");
  const references = source.dialects.flatMap((dialect) =>
    Array.from({ length: protocol.repeats }, (_, i) => i + 1).flatMap(
      (repeat) => {
        // Reference functions' historical context is replaced before records leave this local call.
        const context = {
          evaluationSet: {
            version: "mapping-study-inputs/1",
            split: "DEV" as const,
            sha256: source.hash,
          },
          dialectId: dialect.input.dialectId,
          repeat,
        };
        return [
          runLexicalMapping(studyMappingInput(dialect), context, b0),
          runStrongMapping(studyMappingInput(dialect), context, b1),
        ].map((r, i) => ({
          dialect,
          record: MappingStudyRunRecordSchema.parse({
            ...r,
            schemaVersion: "mapping-study-run/1",
            protocolHash,
            sessionId: session.id,
            phase: "GRID",
            candidateId: i === 0 ? "B0" : "B1",
            familyId: dialect.family.id,
            inputHash: dialect.input.inputHash,
            evaluationSet: {
              version: "mapping-study-inputs/1",
              split: source.split,
              sha256: source.hash,
            },
          }),
        }));
      },
    ),
  );
  type Bound = (typeof bound)[number] & { forcedReview?: boolean };
  function armSummary(
    id: string,
    runs: Bound[],
    role: "MODEL" | "REFERENCE" | "ROUTED",
  ) {
    const byTag = Object.fromEntries(
      ["ALL", ...tags, "UNMATCHED"].map((tag) => [
        tag,
        mappingMetrics(
          runs
            .filter(
              (b) =>
                tag === "ALL" ||
                tag === "UNMATCHED" ||
                b.dialect.gold.columns.some((g) => g.tag === tag),
            )
            .map((b) => ({
              record: b.record,
              dialect: studyMetricDialect(b.dialect),
            })),
          tag,
          prices,
          "mapping-score/2",
        ),
      ]),
    );
    const familyIds = [...new Set(runs.map((d) => d.dialect.family.id))].sort();
    const outcomes = runs.map(({ record, dialect, forcedReview }) => {
      const offerable = !forcedReview && studyOfferable(record, dialect),
        strict = studyStrictMatch(record, dialect);
      return {
        recordHash: studyRecordHash(record),
        familyId: dialect.family.id,
        dialectId: record.dialectId,
        repeat: record.repeat,
        offerable,
        safeCompletion: strict && offerable,
        correctTermination:
          dialect.gold.expectedDisposition === "REVIEW_REQUIRED"
            ? !offerable
            : strict && offerable,
        wrongAttempt:
          record.parsedOutput !== null &&
          !studyAssignmentMatch(record, dialect),
        wrongValidated:
          record.outcome === "VALID" && !studyAssignmentMatch(record, dialect),
        wrongExposure: offerable && !strict,
        equivalentAssignment: studyStrictMatch(record, dialect, true),
      };
    });
    const families = familyIds.map((familyId) => {
      const subset = runs.filter((r) => r.dialect.family.id === familyId),
        observations = outcomes.filter((o) => o.familyId === familyId);
      const metrics = mappingMetrics(
        subset.map((r) => ({
          record: r.record,
          dialect: studyMetricDialect(r.dialect),
        })),
        "ALL",
        prices,
        "mapping-score/2",
      );
      return {
        familyId,
        stratum: source.dialects.find((d) => d.family.id === familyId)!.family
          .stratum,
        strictAccuracy: metrics.strictAccuracy,
        safeCompletion: count(
          observations.filter((o) => o.safeCompletion).length,
          observations.length,
        ),
        correctTermination: count(
          observations.filter((o) => o.correctTermination).length,
          observations.length,
        ),
        wrongExposure: observations.some((o) => o.wrongExposure),
      };
    });
    const rate = (
      key:
        | "safeCompletion"
        | "correctTermination"
        | "wrongExposure"
        | "offerable"
        | "wrongAttempt"
        | "wrongValidated",
    ) => count(outcomes.filter((o) => o[key]).length, outcomes.length);
    return {
      id,
      role,
      selectable: role === "MODEL" && source.split === "SELECT",
      resourceSemantics:
        role === "REFERENCE" ? "NON_MODEL_SENTINEL" : "RECORDED_OBSERVATIONS",
      byTag,
      reviewLoadProxy: {
        label: "COLUMNS_AND_FIELDS_NOT_HUMAN_TIME",
        columnsToInspect: String(
          runs.reduce(
            (n, r) => n + r.dialect.input.projection.columns.length,
            0,
          ),
        ),
        flaggedFields: String(
          runs.reduce(
            (n, r) =>
              n +
              (r.record.parsedOutput?.fields.filter(
                (f) =>
                  f.status === "REVIEW_REQUIRED" ||
                  typeof f.confidence !== "number" ||
                  f.confidence < MAPPING_CONFIDENCE_REVIEW_THRESHOLD,
              ).length ?? 0),
            0,
          ),
        ),
        outputsWithoutFields: String(
          runs.filter((r) => r.record.parsedOutput === null).length,
        ),
      },
      costMicroUsdPerDialectRun:
        runs.length &&
        byTag.ALL!.costMicroUsd.coveredRuns ===
          byTag.ALL!.costMicroUsd.totalRuns
          ? rational(BigInt(byTag.ALL!.costMicroUsd.sum), BigInt(runs.length))
          : null,
      costCoverageComplete:
        byTag.ALL!.costMicroUsd.coveredRuns ===
          byTag.ALL!.costMicroUsd.totalRuns && runs.length > 0,
      safeCompletion: rate("safeCompletion"),
      correctTermination: rate("correctTermination"),
      reviewRequired: count(
        outcomes.filter((o) => !o.offerable).length,
        outcomes.length,
      ),
      wrongAttempts: rate("wrongAttempt"),
      wrongValidated: rate("wrongValidated"),
      wrongExposure: rate("wrongExposure"),
      diagnosticEquivalentAssignment: count(
        outcomes.filter((o) => o.equivalentAssignment).length,
        outcomes.length,
      ),
      familyMacroStrictAccuracy:
        families.length > 0 &&
        families.every((f) => f.strictAccuracy.denominator !== "0")
          ? meanRationals(families.map((f) => f.strictAccuracy))
          : null,
      zeroWrongExposureFamilyBound:
        missing.length === 0 &&
        families.length > 0 &&
        families.every((f) => !f.wrongExposure)
          ? zeroEventFamilyUpperBound(families.length)
          : null,
      families,
      observations: outcomes,
    };
  }
  const arms = protocol.candidates.map((c) =>
    armSummary(
      c.id,
      grid.filter((b) => b.record.candidateId === c.id),
      "MODEL",
    ),
  );
  const referenceArms = ["B0", "B1"].map((id) =>
    armSummary(
      id,
      references.filter((b) => b.record.candidateId === id),
      "REFERENCE",
    ),
  );
  const routes = z
    .array(MappingStudyRouteRecordSchema)
    .parse(input.routes ?? [])
    .sort((a, b) => (canonicalJson(a) < canonicalJson(b) ? -1 : 1));
  const routeSeen = new Set<string>();
  const byHash = new Map(bound.map((b) => [studyRecordHash(b.record), b]));
  const routeGroups = new Map<
    string,
    { routes: typeof routes; runs: Bound[] }
  >();
  for (const route of routes) {
    if (
      source.split !== "AUDIT" ||
      route.protocolHash !== protocolHash ||
      route.sessionId !== session.id
    )
      throw new Error("Study route context mismatch");
    const p = byHash.get(route.primaryRunHash),
      e = route.escalationRunHash
        ? byHash.get(route.escalationRunHash)
        : undefined;
    const phase = route.mode === "SYNTHETIC" ? "GRID" : "LIVE_ROUTE";
    if (
      !p ||
      p.record.phase !== phase ||
      p.record.candidateId !== protocol.routingPair?.primary ||
      (e &&
        (e.record.phase !== phase ||
          e.record.candidateId !== protocol.routingPair?.escalation)) ||
      route.reason !== studyRouteReason(p.record, p.dialect) ||
      route.familyId !== p.record.familyId ||
      route.dialectId !== p.record.dialectId ||
      route.repeat !== p.record.repeat ||
      route.inputHash !== p.record.inputHash ||
      route.attemptedCalls < 1 ||
      route.reservations < route.attemptedCalls
    )
      throw new Error("Study route reference/reason mismatch");
    if (
      e &&
      (e.record.candidateId === p.record.candidateId ||
        e.record.dialectId !== p.record.dialectId ||
        e.record.repeat !== p.record.repeat)
    )
      throw new Error("Unpaired route escalation");
    if (route.escalationRunHash && !e)
      throw new Error("Unknown escalation run hash");
    if (
      route.reason === "PRIMARY_OFFERABLE" &&
      (e ||
        route.attemptedCalls !== 1 ||
        (route.stop !== "NONE" && route.stop !== "DEADLINE") ||
        (route.stop === "NONE" &&
          route.selectedRunHash !== route.primaryRunHash))
    )
      throw new Error("Offerable primary must be returned directly");
    if (route.attemptedCalls === 1 && e)
      throw new Error("Unexpected escalation reference without an attempt");
    if (route.attemptedCalls === 2 && !e)
      throw new Error("Missing attempted escalation record");
    if (route.reason !== "PRIMARY_OFFERABLE" && route.stop === "NONE" && !e)
      throw new Error("Missing required escalation record");
    if (
      route.selectedRunHash !== null &&
      route.selectedRunHash !==
        (route.reason === "PRIMARY_OFFERABLE"
          ? route.primaryRunHash
          : route.escalationRunHash)
    )
      throw new Error("Route selected the wrong run");
    const selected = route.selectedRunHash
      ? byHash.get(route.selectedRunHash)
      : undefined;
    if (
      route.finalStatus !==
        (selected ? "PROPOSAL_OFFERABLE" : "REVIEW_REQUIRED") ||
      (selected &&
        (!studyOfferable(selected.record, selected.dialect) ||
          route.stop !== "NONE" ||
          route.latencyMs > protocol.routeTimeoutMs))
    )
      throw new Error("Route final gate mismatch");
    if (
      route.stop === "NONE" &&
      route.reason !== "PRIMARY_OFFERABLE" &&
      e &&
      studyOfferable(e.record, e.dialect) &&
      !selected
    )
      throw new Error("Route dropped offerable escalation");
    if (
      route.mode === "LIVE_SAMPLE" &&
      BigInt(route.latencyMs) <
        BigInt(p.record.latencyMs) + BigInt(e?.record.latencyMs ?? 0)
    )
      throw new Error(
        "Observed route latency is shorter than its sequential attempts",
      );
    if (route.mode === "SYNTHETIC") {
      // A rejected primary still needs the paired E record to reproduce routing and deadline handling.
      const other =
        e ??
        grid.find(
          (b) =>
            b.record.candidateId === protocol.routingPair?.escalation &&
            b.record.dialectId === p.record.dialectId &&
            b.record.repeat === p.record.repeat,
        );
      if (
        !other ||
        canonicalJson(
          synthesizeStudyRoute(protocol, p.record, other.record, p.dialect),
        ) !== canonicalJson(route)
      )
        throw new Error("Synthetic route replay mismatch");
    }
    const key = canonicalJson([route.mode, route.dialectId, route.repeat]);
    if (routeSeen.has(key)) throw new Error("Duplicate study route");
    routeSeen.add(key);
    const group = routeGroups.get(route.mode) ?? { routes: [], runs: [] };
    group.routes.push(route);
    // Keep the actual final attempted output for structural metrics. A deadline or
    // limiter stop changes presentation disposition, never invents a provider failure.
    const result = selected?.record ?? e?.record ?? p.record;
    group.runs.push({
      dialect: p.dialect,
      record: { ...result, candidateId: "ROUTED", latencyMs: route.latencyMs },
      forcedReview: route.finalStatus === "REVIEW_REQUIRED",
    });
    routeGroups.set(route.mode, group);
  }
  const referencedLiveRuns = new Set(
    routes
      .filter((r) => r.mode === "LIVE_SAMPLE")
      .flatMap((r) => [
        r.primaryRunHash,
        ...(r.escalationRunHash ? [r.escalationRunHash] : []),
      ]),
  );
  if (
    bound.some(
      (b) =>
        b.record.phase === "LIVE_ROUTE" &&
        !referencedLiveRuns.has(studyRecordHash(b.record)),
    )
  )
    throw new Error("Unreferenced live route attempt");
  const routeSummaries = [...routeGroups]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([mode, group]) => {
      const summary = armSummary(`ROUTED_${mode}`, group.runs, "ROUTED");
      const conditionalCalls = group.routes.flatMap((r) => [
        byHash.get(r.primaryRunHash)!,
        ...(r.escalationRunHash ? [byHash.get(r.escalationRunHash)!] : []),
      ]);
      const resources = mappingMetrics(
        conditionalCalls.map((b) => ({
          record: b.record,
          dialect: studyMetricDialect(b.dialect),
        })),
        "ALL",
        prices,
        "mapping-score/2",
      );
      const transitions = group.routes.map((r) => {
        const primary = byHash.get(r.primaryRunHash)!;
        const primarySafe =
          studyStrictMatch(primary.record, primary.dialect) &&
          studyOfferable(primary.record, primary.dialect);
        const routedSafe = summary.observations.find(
          (o) => o.dialectId === r.dialectId && o.repeat === r.repeat,
        )!.safeCompletion;
        return {
          escalated: r.reason !== "PRIMARY_OFFERABLE",
          rescue: !primarySafe && routedSafe,
          harm: primarySafe && !routedSafe,
        };
      });
      const expectedDialectIds =
        mode === "SYNTHETIC"
          ? source.dialects.map((d) => d.input.dialectId)
          : protocol.liveSampleDialectIds;
      const fullGrid =
        group.routes.length === expectedDialectIds.length * protocol.repeats &&
        expectedDialectIds.every((id) =>
          group.routes.some((r) => r.dialectId === id),
        );
      const comparisons =
        mode === "SYNTHETIC" && fullGrid && !missing.length
          ? arms.map((arm) => ({
              against: arm.id,
              safeCompletionDifference: pairedFamilyBootstrap(
                summary.families.map((f) => ({
                  familyId: f.familyId,
                  stratum: f.stratum,
                  left: f.safeCompletion,
                  right: arm.families.find((a) => a.familyId === f.familyId)!
                    .safeCompletion,
                })),
                protocol.analysis,
              ),
            }))
          : [];
      const primaryResources = mappingMetrics(
        group.routes
          .map((r) => byHash.get(r.primaryRunHash)!)
          .map((b) => ({
            record: b.record,
            dialect: studyMetricDialect(b.dialect),
          })),
        "ALL",
        prices,
        "mapping-score/2",
      );
      const additionalSuccesses =
        BigInt(transitions.filter((t) => t.rescue).length) -
        BigInt(transitions.filter((t) => t.harm).length);
      const costKnown =
        resources.costMicroUsd.coveredRuns ===
          resources.costMicroUsd.totalRuns &&
        primaryResources.costMicroUsd.coveredRuns ===
          primaryResources.costMicroUsd.totalRuns;
      const byTag = Object.fromEntries(
        Object.entries(summary.byTag).map(([tag, metrics]) => {
          const subset = conditionalCalls.filter(
            (b) =>
              tag === "ALL" ||
              tag === "UNMATCHED" ||
              b.dialect.gold.columns.some((g) => g.tag === tag),
          );
          const conditional = mappingMetrics(
            subset.map((b) => ({
              record: b.record,
              dialect: studyMetricDialect(b.dialect),
            })),
            tag,
            prices,
            "mapping-score/2",
          );
          return [
            tag,
            {
              ...metrics,
              tokens: conditional.tokens,
              costMicroUsd: conditional.costMicroUsd,
            },
          ];
        }),
      );
      return {
        ...summary,
        selectable: false,
        byTag,
        costCoverageComplete: costKnown,
        costMicroUsdPerDialectRun: costKnown
          ? rational(
              BigInt(resources.costMicroUsd.sum),
              BigInt(group.routes.length),
            )
          : null,
        incrementalCostPerSafeCompletion: {
          valueMicroUsd:
            costKnown && additionalSuccesses > 0n
              ? rational(
                  BigInt(resources.costMicroUsd.sum) -
                    BigInt(primaryResources.costMicroUsd.sum),
                  additionalSuccesses,
                )
              : null,
          reason: !costKnown
            ? "UNKNOWN_COST"
            : additionalSuccesses <= 0n
              ? "NO_ADDITIONAL_SAFE_COMPLETION"
              : "AVAILABLE",
        },
        mode,
        fullGrid,
        latencySemantics:
          mode === "SYNTHETIC"
            ? "SUM_OF_PAIRED_RECORDED_LATENCIES_ESTIMATE"
            : "OBSERVED_ROUTE_LATENCY",
        conditionalResources: {
          tokens: resources.tokens,
          costMicroUsd: resources.costMicroUsd,
        },
        attemptedSafety: {
          injectionFollowed: resources.injectionFollowed,
          inventedField: resources.inventedField,
          unflaggedNoTarget: resources.unflaggedNoTarget,
        },
        missedSilentErrors: count(
          group.routes.filter(
            (r) =>
              r.reason === "PRIMARY_OFFERABLE" &&
              !studyStrictMatch(
                byHash.get(r.primaryRunHash)!.record,
                byHash.get(r.primaryRunHash)!.dialect,
              ),
          ).length,
          group.routes.filter((r) => r.reason === "PRIMARY_OFFERABLE").length,
        ),
        rescueAmongEscalations: count(
          transitions.filter((t) => t.rescue).length,
          transitions.filter((t) => t.escalated).length,
        ),
        harmAmongEscalations: count(
          transitions.filter((t) => t.harm).length,
          transitions.filter((t) => t.escalated).length,
        ),
        escalation: count(
          transitions.filter((t) => t.escalated).length,
          transitions.length,
        ),
        rescue: count(
          transitions.filter((t) => t.rescue).length,
          transitions.length,
        ),
        harm: count(
          transitions.filter((t) => t.harm).length,
          transitions.length,
        ),
        unproductiveEscalation: count(
          transitions.filter((t) => t.escalated && !t.rescue).length,
          transitions.filter((t) => t.escalated).length,
        ),
        blockedEscalations: count(
          group.routes.filter(
            (r) => r.reason !== "PRIMARY_OFFERABLE" && r.attemptedCalls === 1,
          ).length,
          group.routes.length,
        ),
        deadlineViolations: count(
          group.routes.filter((r) => r.latencyMs > protocol.routeTimeoutMs)
            .length,
          group.routes.length,
        ),
        comparisons,
      };
    });
  const allArms = [...referenceArms, ...arms];
  const referenceComparisons = referenceArms.flatMap((reference) =>
    arms.map((arm) => ({
      reference: reference.id,
      candidate: arm.id,
      strictAccuracyOrder: compareCounts(
        reference.byTag.ALL!.strictAccuracy,
        arm.byTag.ALL!.strictAccuracy,
      ),
      byTag: Object.fromEntries(
        tags.map((tag) => [
          tag,
          compareCounts(
            reference.byTag[tag]!.strictAccuracy,
            arm.byTag[tag]!.strictAccuracy,
          ),
        ]),
      ),
    })),
  );
  return {
    version: "mapping-study-score/1",
    protocolHash,
    session,
    split: source.split,
    status:
      protocol.status === "AUDITED" && source.status === "SEALED"
        ? "REGISTERED_INPUTS"
        : "EXPLORATORY_ONLY",
    bindings: {
      inputsHash: input.source.inputs.sha256,
      goldHash: input.source.gold.sha256,
      familiesHash: input.source.families.sha256,
      pricesHash: input.prices.sha256,
      ...protocol.references,
    },
    recordsHash: sha256Canonical(
      bound.map((b) => studyRecordArtifact(b.record)),
    ),
    routesHash: sha256Canonical(
      [...routes]
        .map(studyRecordArtifact)
        .sort((a, b) => (canonicalJson(a) < canonicalJson(b) ? -1 : 1)),
    ),
    grid: {
      expectedRuns: String(
        protocol.candidates.length * source.dialects.length * protocol.repeats,
      ),
      recordedRuns: String(grid.length),
      missing,
      complete: missing.length === 0 && session.status === "COMPLETED",
    },
    arms: allArms,
    referenceComparisons,
    routes: routeSummaries,
    liveRouteRecordedCalls: String(bound.length - grid.length),
    researchResources: mappingMetrics(
      bound.map((b) => ({
        record: b.record,
        dialect: studyMetricDialect(b.dialect),
      })),
      "ALL",
      prices,
      "mapping-score/2",
    ).costMicroUsd,
    limitation:
      "Synthetic evaluation; reference latency is a sentinel. Review-required fields are a proxy, not measured human time. This tool creates no approval and enables no live path.",
  };
}
