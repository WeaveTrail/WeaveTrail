import { z } from "zod";

import { ApprovalRecordSchema } from "./approval-record";
import { CaseManifestSchema } from "./case-manifest";
import { RapidPriceLiftResultSchema } from "./rapid-price-lift";
import { WorkflowStateSchema } from "./workflow";

export const ReplayReviewWorkflowStateSchema = WorkflowStateSchema.extract([
  "MAPPING_REVIEW_REQUIRED",
  "CASE_REVIEW_REQUIRED",
  "INPUT_REVIEW_REQUIRED",
]);

export const ReplayResultWorkflowStateSchema = WorkflowStateSchema.extract([
  "MAPPING_APPROVED",
  "REPLAYED",
]);

export const ReplayScenarioSchema = z.enum([
  "concentrated-buy-dialect-a.csv",
  "concentrated-buy-dialect-b.jsonl",
  "rapid-price-lift-supported.csv",
  "rapid-price-lift-broad-participation.csv",
  "rapid-price-lift-insufficient-evidence.csv",
]);

export const ReplayMutationSchema = z.enum([
  "baseline",
  "shuffle",
  "duplicate",
]);

export const ReplayRequestSchema = z
  .object({
    scenario: ReplayScenarioSchema,
    mutation: ReplayMutationSchema,
    rows: z
      .array(
        z
          .object({
            coordinate: z
              .object({
                sourceArtifactHash: z.string().regex(/^[a-f0-9]{64}$/),
                rowNumber: z.string().min(1),
              })
              .strict(),
            values: z.record(z.string(), z.string()),
          })
          .strict(),
      )
      .min(1)
      .max(64),
    mappingApproval: ApprovalRecordSchema.optional(),
    caseManifest: CaseManifestSchema.optional(),
  })
  .strict();

export const ReplayReviewIssueCodeSchema = z.enum([
  "INVALID_JSON",
  "INVALID_REQUEST",
  "APPROVAL_RECORD_REQUIRED",
  "APPROVAL_REJECTED",
  "APPROVED_ARTIFACT_HASH_MISMATCH",
  "MAPPING_OVERRIDE_REQUIRED",
  "SOURCE_ARTIFACT_NOT_APPROVED",
  "SOURCE_ROW_MISMATCH",
  "SOURCE_ROW_MISSING",
  "APPROVED_SOURCE_COLUMN_MISSING",
  "MAPPING_APPLICATION_REVIEW_REQUIRED",
  "CONFLICTING_EVENT_IDENTIFIER",
  "CONFLICTING_SOURCE_IDENTITY",
  "MIXED_SEQUENCE_PRESENCE",
  "NON_FINITE_NUMBER",
  "UNDEFINED_VALUE",
  "UNSUPPORTED_EVENT_TIME",
  "CANONICAL_DATASET_HASH_MISMATCH",
  "INSTRUMENT_OUTSIDE_DATASET_PROFILE",
  "ACTOR_OUTSIDE_DATASET_PROFILE",
  "TIME_WINDOW_OUTSIDE_DATASET_PROFILE",
  "RULE_CONFIGURATION_REQUIRED",
]);

export const InputReplayReviewIssueCodeSchema = z.enum([
  "INVALID_JSON",
  "INVALID_REQUEST",
  "SOURCE_ARTIFACT_NOT_APPROVED",
  "SOURCE_ROW_MISMATCH",
  "SOURCE_ROW_MISSING",
  "APPROVED_SOURCE_COLUMN_MISSING",
  "CONFLICTING_EVENT_IDENTIFIER",
  "CONFLICTING_SOURCE_IDENTITY",
  "MIXED_SEQUENCE_PRESENCE",
  "NON_FINITE_NUMBER",
  "UNDEFINED_VALUE",
  "UNSUPPORTED_EVENT_TIME",
  "MAPPING_APPLICATION_REVIEW_REQUIRED",
]);

export const MappingReplayReviewIssueCodeSchema = z.enum([
  "MAPPING_OVERRIDE_REQUIRED",
  "APPROVAL_RECORD_REQUIRED",
  "APPROVAL_REJECTED",
  "APPROVED_ARTIFACT_HASH_MISMATCH",
  "MAPPING_APPLICATION_REVIEW_REQUIRED",
]);

export const CaseReplayReviewIssueCodeSchema = z.enum([
  "CANONICAL_DATASET_HASH_MISMATCH",
  "INSTRUMENT_OUTSIDE_DATASET_PROFILE",
  "ACTOR_OUTSIDE_DATASET_PROFILE",
  "TIME_WINDOW_OUTSIDE_DATASET_PROFILE",
  "RULE_CONFIGURATION_REQUIRED",
  "APPROVAL_RECORD_REQUIRED",
  "APPROVAL_REJECTED",
  "APPROVED_ARTIFACT_HASH_MISMATCH",
]);

const replayReviewIssueSchema = <
  T extends
    | typeof InputReplayReviewIssueCodeSchema
    | typeof MappingReplayReviewIssueCodeSchema
    | typeof CaseReplayReviewIssueCodeSchema,
>(
  codeSchema: T,
) =>
  z
    .object({
      code: codeSchema,
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string().min(1),
    })
    .strict();

const replayReviewResponseBranch = <
  TState extends
    | "INPUT_REVIEW_REQUIRED"
    | "MAPPING_REVIEW_REQUIRED"
    | "CASE_REVIEW_REQUIRED",
  TIssue extends z.ZodType,
>(
  workflowState: TState,
  issueSchema: TIssue,
) =>
  z
    .object({
      status: z.literal("REVIEW_REQUIRED"),
      workflowState: z.literal(workflowState),
      issues: z.array(issueSchema).min(1),
    })
    .strict();

export const ReplayReviewResponseSchema = z.discriminatedUnion(
  "workflowState",
  [
    replayReviewResponseBranch(
      "INPUT_REVIEW_REQUIRED",
      replayReviewIssueSchema(InputReplayReviewIssueCodeSchema),
    ),
    replayReviewResponseBranch(
      "MAPPING_REVIEW_REQUIRED",
      replayReviewIssueSchema(MappingReplayReviewIssueCodeSchema),
    ),
    replayReviewResponseBranch(
      "CASE_REVIEW_REQUIRED",
      replayReviewIssueSchema(CaseReplayReviewIssueCodeSchema),
    ),
  ],
);

const ReplayResultResponseBaseSchema = z.object({
  mode: z.literal("fixture"),
  scenario: ReplayScenarioSchema,
  mutation: ReplayMutationSchema,
  boundary: z.string().min(1),
  replay: z
    .object({
      engineVersion: z.string().min(1),
      inputEventCount: z.number().int().nonnegative(),
      canonicalEventCount: z.number().int().nonnegative(),
      duplicateCount: z.number().int().nonnegative(),
      orderedEventIds: z.array(z.string().min(1)),
      canonicalResultHash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
});

export const ReplayResultResponseSchema = z.discriminatedUnion(
  "workflowState",
  [
    ReplayResultResponseBaseSchema.extend({
      workflowState: z.literal("MAPPING_APPROVED"),
    }).strict(),
    ReplayResultResponseBaseSchema.extend({
      workflowState: z.literal("REPLAYED"),
      evaluation: RapidPriceLiftResultSchema,
    }).strict(),
  ],
);

export type ReplayScenario = z.infer<typeof ReplayScenarioSchema>;
export type ReplayMutation = z.infer<typeof ReplayMutationSchema>;
export type ReplayRequest = z.infer<typeof ReplayRequestSchema>;
export type ReplayReviewResponse = z.infer<typeof ReplayReviewResponseSchema>;
export type ReplayResultResponse = z.infer<typeof ReplayResultResponseSchema>;
