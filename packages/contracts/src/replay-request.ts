import { z } from "zod";

import { ApprovalRecordSchema } from "./approval-record";

export const ReplayScenarioSchema = z.enum([
  "concentrated-buy-dialect-a.csv",
  "concentrated-buy-dialect-b.jsonl",
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
      .max(4),
    mappingApproval: ApprovalRecordSchema.optional(),
  })
  .strict();

export const ReplayReviewIssueCodeSchema = z.enum([
  "INVALID_JSON",
  "INVALID_REQUEST",
  "MAPPING_REVIEW_REQUIRED",
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
]);

export const ReplayReviewResponseSchema = z
  .object({
    status: z.literal("REVIEW_REQUIRED"),
    issues: z
      .array(
        z
          .object({
            code: ReplayReviewIssueCodeSchema,
            path: z.array(z.union([z.string(), z.number()])),
            message: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const ReplayResultResponseSchema = z
  .object({
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
  })
  .strict();

export type ReplayScenario = z.infer<typeof ReplayScenarioSchema>;
export type ReplayMutation = z.infer<typeof ReplayMutationSchema>;
export type ReplayRequest = z.infer<typeof ReplayRequestSchema>;
export type ReplayReviewResponse = z.infer<typeof ReplayReviewResponseSchema>;
export type ReplayResultResponse = z.infer<typeof ReplayResultResponseSchema>;
