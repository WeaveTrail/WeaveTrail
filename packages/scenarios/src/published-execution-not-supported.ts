import {
  CaseManifestSchema,
  SchemaMappingProposalSchema,
  deriveApprovedSourceMapping,
  type PromptVersion,
} from "@weavetrail/contracts";

import {
  publishedExecutionFixProposal,
  publishedExecutionManifest,
} from "./published-execution-schema";

const sourceArtifactHash =
  "aa7fb847474c978919160ae2d93ec4a6f157fd4e09759f497340649324303680";
const constants = {
  ...publishedExecutionFixProposal.constants,
  datasetId: "synthetic-published-execution-broad-v1",
};

export const publishedExecutionBroadProposal =
  SchemaMappingProposalSchema.parse({
    ...publishedExecutionFixProposal,
    sourceArtifactHash,
    constants,
  });

export const publishedExecutionBroadMapping = deriveApprovedSourceMapping(
  publishedExecutionBroadProposal,
);

const executions = [
  ["130000", "12000", "3", "2", "SYNTH-ACCOUNT-BASE"],
  ["130001", "12150", "1", "1", "SYNTH-ACCOUNT-FOCUS"],
  ["130002", "12300", "1", "1", "SYNTH-ACCOUNT-FOCUS"],
  ["130003", "12300", "5", "1", "SYNTH-ACCOUNT-WIDE-A"],
  ["130004", "12300", "5", "1", "SYNTH-ACCOUNT-WIDE-B"],
  ["130005", "12050", "1", "2", "SYNTH-ACCOUNT-WIDE-C"],
] as const;

export const publishedExecutionBroadRows = executions.map(
  ([sourceEventId, price, quantity, side, actorId], index) => ({
    coordinate: { sourceArtifactHash, rowNumber: String(index + 2) },
    values: {
      "ExecID(17)": sourceEventId,
      "TransactTime(60)": `20260903-01:03:${sourceEventId.slice(-2)}`,
      "Symbol(55)": "ZZ79X1",
      "Side(54)": side,
      "LastPx(31)": price,
      "LastQty(32)": quantity,
      "Account(1)": actorId,
    },
  }),
);

export const publishedExecutionBroadManifest = CaseManifestSchema.parse({
  ...publishedExecutionManifest,
  caseId: constants.datasetId,
  canonicalDatasetHash:
    "35785e7ed4c4ce9b1b4c7cb390d4c2117b9509ac5eefb951b82803bed2e2f33d",
  hypothesis: {
    ...publishedExecutionManifest.hypothesis,
    startTime: "2026-09-03T01:03:00Z",
    endTime: "2026-09-03T01:03:05Z",
  },
  aiTrace: {
    ...publishedExecutionManifest.aiTrace,
    promptVersion: "published-execution-broad-case-v1" satisfies PromptVersion,
  },
  approval: {
    ...publishedExecutionManifest.approval,
    approvedArtifactHash:
      "fa3b1b1136ac8f925dfd2b76caae9657e36845f7ad7a3c5f83c2cad944e8a094",
    approvedAt: "2026-09-29T00:00:00Z",
  },
});

export const publishedExecutionBroadScenario = {
  label: "Synthetic · published FIX 4.4 broad participation · CSV",
  sourceArtifactHash,
  constants,
  columns: publishedExecutionBroadProposal.fields.map(
    ({ sourceColumn }) => sourceColumn,
  ),
  rows: publishedExecutionBroadRows,
  mappingProposal: publishedExecutionBroadProposal,
  manifest: publishedExecutionBroadManifest,
  expectedResult: "NOT_SUPPORTED" as const,
  expectedWorkflowState: "REPLAYED" as const,
  expectedFailingGates: ["ACTOR_CONCENTRATION", "REMOVAL_SENSITIVITY"] as const,
  expectedNonComparableEventCount: 0,
  demonstrates:
    "Six FIX-shaped executions carry every comparable input. Broad buy participation fails ACTOR_CONCENTRATION (below 8000 bps), and removing the approved actor leaves the same price lift, failing REMOVAL_SENSITIVITY (0 bps below 100); the other three gates pass.",
} as const;
