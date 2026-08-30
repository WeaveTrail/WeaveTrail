import { z } from "zod";

export const ApprovalRecordSchema = z
  .object({
    approvedArtifactHash: z.string().regex(/^[a-f0-9]{64}$/),
    reviewerRef: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED"]),
    overrides: z.array(
      z
        .object({
          fieldPath: z.string().min(1),
          reason: z.string().min(1),
        })
        .strict(),
    ),
    approvedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
