import { describe, expect, it } from "vitest";
import { format } from "prettier";

import {
  RapidPriceLiftResultSchema,
  requiresMappingOverride,
  type ApprovalRecord,
  type CaseManifest,
  type RapidPriceLiftGate,
  type SchemaMappingProposal,
} from "@weavetrail/contracts";
import { publishedReplaySources } from "@weavetrail/published-data";
import {
  actorlessMultiInstrumentMappingProposal,
  actorlessMultiInstrumentScenario,
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
  committedReplayScenarios,
  rapidPriceLiftScenarios,
} from "@weavetrail/scenarios";

import {
  caseManifestProposal,
  mappingApprovalArtifact,
  replayApproved,
} from "./approval-validation";
import { sha256Canonical } from "./canonical-hash";
import { computeDatasetProfile } from "./dataset-profile";
import { RequestWorkflow } from "./request-workflow";

const gateParameters = [
  ["PRICE_CHANGE", "minimumPriceChangeBps"],
  ["AGGRESSIVE_BUY_SHARE", "minimumAggressiveBuyShareBps"],
  ["ACTOR_CONCENTRATION", "minimumActorConcentrationShareBps"],
  ["REPEATED_EXECUTION", "minimumExecutionsAboveReference"],
  ["REMOVAL_SENSITIVITY", "minimumRemovalSensitivityBps"],
] as const satisfies readonly [RapidPriceLiftGate, string][];

type Source = {
  label: string;
  rows: Parameters<typeof replayApproved>[0];
  mappingProposal: SchemaMappingProposal;
  manifest?: CaseManifest;
};

const sources: Record<string, Source> = {
  "actorless-multi-instrument-quotes.jsonl": {
    ...actorlessMultiInstrumentScenario,
    mappingProposal: actorlessMultiInstrumentMappingProposal,
  },
  "concentrated-buy-dialect-a.csv": {
    ...committedReplayScenarios["concentrated-buy-dialect-a.csv"],
    mappingProposal: concentratedBuyDialectAProposal,
  },
  "concentrated-buy-dialect-b.jsonl": {
    ...committedReplayScenarios["concentrated-buy-dialect-b.jsonl"],
    mappingProposal: concentratedBuyDialectBProposal,
  },
  "published-execution-fix44.csv":
    committedReplayScenarios["published-execution-fix44.csv"],
  "published-execution-h0stcnt0.jsonl":
    committedReplayScenarios["published-execution-h0stcnt0.jsonl"],
  ...rapidPriceLiftScenarios,
  ...publishedReplaySources,
};

function approvalFor(
  artifact: Parameters<typeof sha256Canonical>[0],
  overrides: ApprovalRecord["overrides"] = [],
): ApprovalRecord {
  return {
    approvedArtifactHash: sha256Canonical(artifact),
    reviewerRef: "published-expectation-generator",
    decision: "APPROVED",
    approvedAt: "2026-09-07T00:00:00Z",
    overrides,
  };
}

function mappingApprovalFor(proposal: SchemaMappingProposal): ApprovalRecord {
  const fieldOverrides = proposal.fields.flatMap((field, index) =>
    requiresMappingOverride(field)
      ? [
          {
            fieldPath: `fields.${index}`,
            reason: `Accept the committed interpretation of ${field.sourceColumn}.`,
          },
        ]
      : [],
  );
  const absentFieldOverrides =
    "unmappedFields" in proposal
      ? proposal.unmappedFields.map((field, index) => ({
          fieldPath: `unmappedFields.${index}`,
          reason: `Acknowledge that ${field.targetField} is absent from the published source schema.`,
        }))
      : [];
  return approvalFor(mappingApprovalArtifact(proposal), [
    ...fieldOverrides,
    ...absentFieldOverrides,
  ]);
}

function publication() {
  return {
    schemaVersion: "1.0",
    scenarios: Object.entries(sources).map(([scenario, source]) => {
      const workflow = new RequestWorkflow();
      const manifest = source.manifest
        ? {
            ...source.manifest,
            approval: approvalFor(caseManifestProposal(source.manifest)),
          }
        : undefined;
      const replay = replayApproved(
        source.rows,
        source.rows,
        source.mappingProposal,
        mappingApprovalFor(source.mappingProposal),
        manifest,
        "baseline",
        workflow,
      );
      if (!("canonicalResultHash" in replay)) {
        throw new Error(`Expected committed source to replay: ${scenario}`);
      }

      const evaluation =
        "evaluation" in replay
          ? RapidPriceLiftResultSchema.parse(replay.evaluation)
          : undefined;
      const rule = manifest?.rules.find(
        ({ ruleId, ruleVersion }) =>
          ruleId === "RAPID_PRICE_LIFT" && ruleVersion === "1.1",
      );
      const findings = new Map(
        evaluation?.findings.map((finding) => [finding.gate, finding]),
      );

      return {
        scenario,
        label: source.label,
        workflowState: workflow.state,
        result: evaluation?.result ?? null,
        inconclusiveReason:
          evaluation?.result === "INCONCLUSIVE" ? evaluation.reason : null,
        canonicalDatasetHash: computeDatasetProfile(replay.events)
          .canonicalDatasetHash,
        canonicalResultHash: replay.canonicalResultHash,
        hypothesis: manifest
          ? {
              manifestVersion: manifest.manifestVersion,
              pattern: manifest.hypothesis.pattern,
              instrumentIds: [manifest.hypothesis.instrumentId],
              actorIds: manifest.hypothesis.actorIds,
              startTime: manifest.hypothesis.startTime,
              endTime: manifest.hypothesis.endTime,
              rules: manifest.rules.map(({ ruleId, ruleVersion }) => ({
                ruleId,
                ruleVersion,
              })),
            }
          : null,
        gates: rule
          ? gateParameters.map(([gate, parameter]) => {
              const finding = findings.get(gate);
              return {
                gate,
                observedValue: finding?.observedValue ?? null,
                threshold:
                  rule.parameters[parameter as keyof typeof rule.parameters],
                passed: finding?.passed ?? null,
              };
            })
          : [],
      };
    }),
  };
}

describe("published scenario expectations", () => {
  it("matches current output for every committed replay source", async () => {
    expect(Object.keys(sources)).toEqual([
      ...Object.keys(committedReplayScenarios),
      ...Object.keys(publishedReplaySources),
    ]);
    const output = await format(JSON.stringify(publication(), null, 2), {
      parser: "json",
    });
    await expect(output).toMatchFileSnapshot(
      "../../../apps/web/src/app/expectations/scenario-expectations.json",
    );
  });
});
