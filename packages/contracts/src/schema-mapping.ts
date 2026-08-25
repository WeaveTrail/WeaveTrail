import { z } from "zod";

export const AllowedTransformSchema = z.enum([
  "IDENTITY",
  "ISO_DATETIME",
  "EPOCH_MS_TO_ISO",
  "UPPERCASE",
  "DECIMAL_STRING",
  "BUY_SELL_CODE",
  "EVENT_TYPE_CODE",
]);

export const SchemaMappingProposalSchema = z
  .object({
    mappingVersion: z.literal("1.0"),
    datasetHash: z.string().regex(/^[a-f0-9]{64}$/),
    fields: z.array(
      z
        .object({
          sourceColumn: z.string().min(1),
          targetField: z.string().min(1).nullable(),
          transform: AllowedTransformSchema.optional(),
          confidence: z.number().min(0).max(1),
          evidence: z.string().min(1),
          status: z.enum(["PROPOSED", "REVIEW_REQUIRED"]),
        })
        .strict(),
    ),
  })
  .strict();

export type AllowedTransform = z.infer<typeof AllowedTransformSchema>;
export type SchemaMappingProposal = z.infer<typeof SchemaMappingProposalSchema>;
