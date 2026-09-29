import { deepStrictEqual, ok, strictEqual } from "node:assert";
import {
  requiresMappingOverride,
  RapidPriceLiftResultSchema,
  SchemaMappingProposalSchema,
  type ApprovalRecord,
  type SchemaMappingProposal,
  type TradeEvent,
} from "@weavetrail/contracts";
import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import {
  ENGINE_VERSION,
  CanonicalizationError,
  RequestWorkflow,
  buildFindingSourceTrace,
  caseManifestProposal,
  computeDatasetProfile,
  deriveRawRowHash,
  mappingApprovalArtifact,
  replayApproved,
  replayFoundation,
  replayRapidPriceLift,
  sha256Canonical,
} from "@weavetrail/replay-engine";
import expectations from "../../../apps/web/src/app/expectations/scenario-expectations.json";
import { evaluationCases, limitations } from "./cases";
import { committedRows, sources } from "./sources";

function approval(
  artifact: Parameters<typeof sha256Canonical>[0],
  overrides: ApprovalRecord["overrides"] = [],
): ApprovalRecord {
  return {
    approvedArtifactHash: sha256Canonical(artifact),
    reviewerRef: "evaluation-fixture-only",
    decision: "APPROVED",
    approvedAt: "2026-09-29T00:00:00Z",
    overrides,
  };
}

function mappingApproval(
  proposal: SchemaMappingProposal,
  includeOverrides = true,
) {
  const overrides = [
    ...proposal.fields.flatMap((field, index) =>
      requiresMappingOverride(field)
        ? [
            {
              fieldPath: `fields.${index}`,
              reason: `Evaluation fixture accepts ${field.sourceColumn}.`,
            },
          ]
        : [],
    ),
    ...("unmappedFields" in proposal
      ? proposal.unmappedFields.map((field, index) => ({
          fieldPath: `unmappedFields.${index}`,
          reason: `Evaluation fixture acknowledges absent ${field.targetField}.`,
        }))
      : []),
  ];
  return approval(
    mappingApprovalArtifact(proposal),
    includeOverrides ? overrides : [],
  );
}

export function mutateEvents(
  id: string,
  events: readonly TradeEvent[],
): TradeEvent[] {
  const first = events[0]!;
  switch (id) {
    case "repeat":
      return [...events];
    case "reverse":
      return [...events].reverse();
    case "duplicate":
      return [...events, first];
    case "equivalent-time":
      return events.map((event) => ({
        ...event,
        eventTime: event.eventTime.replace(/Z$/, "+00:00"),
      }));
    case "late-arrival":
      return [...events]
        .reverse()
        .map((event) => ({ ...event, receivedAt: "2026-09-30T00:00:00Z" }));
    case "source-conflict":
      return [...events, { ...first, price: "999999" }];
    case "event-id-conflict":
      return [
        ...events,
        { ...first, sourceEventId: "evaluation-distinct-source" },
      ];
    case "mixed-sequence":
      return events.map((event, index) => {
        const rest = { ...event };
        delete rest.sequence;
        return index === 0 ? { ...rest, sequence: "1" } : rest;
      });
    default:
      throw new Error(`Unknown mutation: ${id}`);
  }
}

export async function runEvaluation(
  cases = evaluationCases,
  scenarioOracles = expectations,
) {
  const provider = new FixtureSchemaMappingProvider();
  const mappings = [];
  for (const definition of cases.mappingCases) {
    const source = sources[definition.source]!;
    const rows = committedRows(definition.source, source);
    const proposal = SchemaMappingProposalSchema.parse(
      await provider.propose({
        sourceArtifactHash: source.mappingProposal.sourceArtifactHash,
        constants: source.mappingProposal.constants,
        columns: Object.keys(rows[0]!.values),
        sampleRows: rows.map((row) => row.values),
      }),
    );
    deepStrictEqual(proposal.constants, source.mappingProposal.constants);
    strictEqual(
      proposal.sourceArtifactHash,
      source.mappingProposal.sourceArtifactHash,
    );
    strictEqual(proposal.mappingVersion, source.mappingProposal.mappingVersion);
    deepStrictEqual(
      "compositeSourceEventId" in proposal
        ? proposal.compositeSourceEventId
        : undefined,
      "compositeSourceEventId" in source.mappingProposal
        ? source.mappingProposal.compositeSourceEventId
        : undefined,
    );
    const fields = proposal.fields.map((field) => [
      field.sourceColumn,
      field.targetField,
      field.transform,
      field.status,
    ]);
    // Compare by source column: provider input order is the committed file order.
    deepStrictEqual(
      [...fields].sort(),
      [...definition.fields].sort(),
      `Mapping oracle: ${definition.source}`,
    );
    const composite =
      "compositeEventTime" in proposal
        ? proposal.compositeEventTime
        : undefined;
    deepStrictEqual(
      composite
        ? {
            sourceColumns: composite.sourceColumns,
            transform: composite.transform,
            status: composite.status,
          }
        : null,
      definition.compositeEventTime,
    );
    deepStrictEqual(
      "unmappedFields" in proposal
        ? proposal.unmappedFields.map((field) => [
            field.targetField,
            field.status,
          ])
        : [],
      definition.absentFields,
    );
    const withoutOverrides = replayApproved(
      rows,
      rows,
      proposal,
      mappingApproval(proposal, false),
      undefined,
    );
    const reviewOutcome =
      "canonicalResultHash" in withoutOverrides
        ? "APPROVED"
        : withoutOverrides.status;
    strictEqual(
      reviewOutcome,
      definition.withoutOverrides,
      `Review oracle: ${definition.source}`,
    );
    ok(
      "canonicalResultHash" in
        replayApproved(
          rows,
          rows,
          proposal,
          mappingApproval(proposal),
          undefined,
        ),
    );
    mappings.push({
      source: definition.source,
      provider: provider.trace,
      mappingVersion: proposal.mappingVersion,
      fields: fields.map(([sourceColumn, targetField, transform, status]) => ({
        sourceColumn,
        targetField,
        transform,
        status,
        agrees: true,
      })),
      compositeEventTime: definition.compositeEventTime,
      absentFields: definition.absentFields,
      withoutOverrides: reviewOutcome,
      withFixtureOverrides: "APPROVED",
    });
  }

  deepStrictEqual(
    Object.keys(sources),
    scenarioOracles.scenarios.map((item) => item.scenario),
    "Scenario inventory",
  );
  const scenarios = [];
  const mutations = [];
  for (const [name, source] of Object.entries(sources)) {
    const rows = committedRows(name, source);
    const manifest = source.manifest
      ? {
          ...source.manifest,
          approval: approval(caseManifestProposal(source.manifest)),
        }
      : undefined;
    const workflow = new RequestWorkflow();
    const replay = replayApproved(
      rows,
      rows,
      source.mappingProposal,
      mappingApproval(source.mappingProposal),
      manifest,
      "baseline",
      workflow,
    );
    const expected = scenarioOracles.scenarios.find(
      (item) => item.scenario === name,
    )!;
    const common = {
      scenario: name,
      dataKind: name.startsWith("real/") ? "published" : "synthetic",
      datasetVersion: source.mappingProposal.constants.datasetId,
      eventContractVersion: source.mappingProposal.constants.schemaVersion,
      mappingVersion: source.mappingProposal.mappingVersion,
      sourceArtifactHash: source.mappingProposal.sourceArtifactHash,
      sourceRowCount: rows.length,
      manifestVersion: manifest?.manifestVersion ?? null,
      rules:
        manifest?.rules.map(({ ruleId, ruleVersion }) => ({
          ruleId,
          ruleVersion,
        })) ?? [],
    };
    const evaluation =
      "evaluation" in replay
        ? RapidPriceLiftResultSchema.parse(replay.evaluation)
        : undefined;
    const observed =
      "canonicalResultHash" in replay
        ? {
            workflowState: workflow.state,
            result: evaluation?.result ?? null,
            inconclusiveReason:
              evaluation?.result === "INCONCLUSIVE" ? evaluation.reason : null,
            nonComparableEventCount:
              evaluation?.nonComparableEventCount ?? null,
            reviewIssues: [],
            canonicalDatasetHash: computeDatasetProfile(replay.events)
              .canonicalDatasetHash,
            canonicalResultHash: replay.canonicalResultHash,
          }
        : {
            workflowState: workflow.state,
            result: null,
            inconclusiveReason: null,
            nonComparableEventCount: null,
            reviewIssues: replay.issues.map((issue) => issue.code),
            canonicalDatasetHash: null,
            canonicalResultHash: null,
          };
    deepStrictEqual(
      observed,
      Object.fromEntries(
        Object.keys(observed).map((key) => [
          key,
          expected[key as keyof typeof expected],
        ]),
      ),
      `Scenario oracle: ${name}`,
    );
    const findings = evaluation?.findings ?? [];
    for (const finding of findings)
      ok(finding.referencedEventIds.length > 0, `Empty finding: ${name}`);
    const trace =
      "canonicalResultHash" in replay
        ? buildFindingSourceTrace(replay.events, findings, rows)
        : { entries: [] };
    for (const entry of trace.entries)
      strictEqual(entry.event.rawRowHash, deriveRawRowHash(entry.sourceRow));
    const references = findings.flatMap(
      (finding) => finding.referencedEventIds,
    );
    scenarios.push({
      ...common,
      ...observed,
      trace: {
        findingCount: findings.length,
        referenceCount: references.length,
        resolvedReferenceCount: references.filter((id) =>
          trace.entries.some((entry) => entry.event.eventId === id),
        ).length,
        uniqueEventCount: trace.entries.length,
        entries: trace.entries.map((entry) => ({
          eventId: entry.event.eventId,
          rawRowHash: entry.event.rawRowHash,
          coordinate: entry.sourceRow.coordinate,
        })),
      },
    });
    if (!("canonicalResultHash" in replay) || name.startsWith("real/"))
      continue;
    for (const mutation of cases.mutations) {
      let outcome: string;
      let resultHash: string | null = null;
      try {
        const events = mutateEvents(mutation.id, replay.events);
        const result = manifest
          ? replayRapidPriceLift(events, manifest)
          : replayFoundation(events);
        resultHash = result.canonicalResultHash;
        outcome =
          resultHash === replay.canonicalResultHash ? "PRESERVED" : "CHANGED";
      } catch (error) {
        if (!(error instanceof CanonicalizationError)) throw error;
        outcome = error.code;
      }
      strictEqual(
        outcome,
        mutation.expected,
        `Mutation oracle: ${name}/${mutation.id}`,
      );
      mutations.push({
        source: name,
        mutation: mutation.id,
        expected: mutation.expected,
        outcome,
        canonicalResultHash: resultHash,
      });
    }
  }
  const ruleScenarios = scenarios.filter(
    (item) => item.dataKind === "synthetic" && item.result !== null,
  );
  return {
    schemaVersion: "1.0",
    evaluationVersion: cases.version,
    mutationVersion: cases.mutationVersion,
    engineVersion: ENGINE_VERSION,
    scenarioExpectationVersion: scenarioOracles.schemaVersion,
    scenarioExpectationPath:
      "apps/web/src/app/expectations/scenario-expectations.json",
    provider: provider.trace,
    command: "pnpm eval",
    aggregation:
      "Counts of declared cases; each synthetic rule scenario counted once; mutations and published normalizations are separate.",
    counts: {
      mappingCases: mappings.length,
      mappingFields: mappings.reduce(
        (sum, item) => sum + item.fields.length,
        0,
      ),
      scenarios: scenarios.length,
      publishedBaselines: scenarios.filter(
        (item) => item.dataKind === "published",
      ).length,
      syntheticRuleScenarios: ruleScenarios.length,
      results: Object.fromEntries(
        ["SUPPORTED", "NOT_SUPPORTED", "INCONCLUSIVE"].map((result) => [
          result,
          ruleScenarios.filter((item) => item.result === result).length,
        ]),
      ),
      mutations: mutations.length,
      preservedMutations: mutations.filter(
        (item) => item.outcome === "PRESERVED",
      ).length,
      rejectedMutations: mutations.filter(
        (item) => item.canonicalResultHash === null,
      ).length,
      findings: scenarios.reduce(
        (sum, item) => sum + item.trace.findingCount,
        0,
      ),
      findingReferences: scenarios.reduce(
        (sum, item) => sum + item.trace.referenceCount,
        0,
      ),
      resolvedFindingReferences: scenarios.reduce(
        (sum, item) => sum + item.trace.resolvedReferenceCount,
        0,
      ),
    },
    mappings,
    scenarios,
    mutations,
    limitations,
  };
}
