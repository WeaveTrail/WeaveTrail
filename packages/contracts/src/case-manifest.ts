import { z } from "zod";

import { ApprovalRecordSchema } from "./approval-record";
import { RuleConfigurationSchema } from "./rule-parameters";

const CaseManifestFields = {
  manifestVersion: z.literal("1.2"),
  caseId: z.string().min(1),
  canonicalDatasetHash: z.string().regex(/^[a-f0-9]{64}$/),
  hypothesis: z
    .object({
      pattern: z.literal("RAPID_PRICE_LIFT"),
      instrumentId: z.string().min(1),
      actorIds: z.array(z.string().min(1)).min(1),
      startTime: z.iso.datetime({ offset: true }),
      endTime: z.iso.datetime({ offset: true }),
    })
    .strict(),
  rules: z.array(RuleConfigurationSchema),
  aiTrace: z
    .object({
      provider: z.string().min(1),
      model: z.string().min(1),
      promptVersion: z.string().min(1),
      confidence: z.number().min(0).max(1),
      referencedEventIds: z.array(z.string().min(1)),
    })
    .strict(),
} as const;

export const CaseManifestProposalSchema = z
  .object(CaseManifestFields)
  .strict()
  .refine(
    ({ hypothesis }) =>
      Date.parse(hypothesis.startTime) <= Date.parse(hypothesis.endTime),
    { message: "The case start time must not be after its end time" },
  );

export const CaseManifestSchema = z
  .object({
    ...CaseManifestFields,
    approval: ApprovalRecordSchema,
  })
  .strict()
  .refine(
    ({ hypothesis }) =>
      Date.parse(hypothesis.startTime) <= Date.parse(hypothesis.endTime),
    { message: "The case start time must not be after its end time" },
  );

export type CaseManifestProposal = z.infer<typeof CaseManifestProposalSchema>;
export type CaseManifest = z.infer<typeof CaseManifestSchema>;
