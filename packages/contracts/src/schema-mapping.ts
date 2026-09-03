import { z } from "zod";

export const MAPPING_CONFIDENCE_REVIEW_THRESHOLD = 1;

export const AllowedTransformSchema = z.enum([
  "IDENTITY",
  "ISO_DATETIME",
  "EPOCH_MS_TO_ISO",
  "UPPERCASE",
  "DECIMAL_STRING",
  "BUY_SELL_CODE",
  "EVENT_TYPE_CODE",
]);

export const MappedTargetFieldSchema = z.enum([
  "sourceEventId",
  "eventTime",
  "receivedAt",
  "sequence",
  "instrumentId",
  "eventType",
  "side",
  "actorId",
  "counterpartyId",
  "orderId",
  "price",
  "quantity",
]);

export const SchemaMappingProposalSchema = z
  .object({
    mappingVersion: z.literal("1.4"),
    sourceArtifactHash: z.string().regex(/^[a-f0-9]{64}$/),
    constants: z
      .object({
        schemaVersion: z.literal("1.1"),
        datasetId: z.string().min(1),
        venueId: z.string().min(1),
      })
      .strict(),
    fields: z.array(
      z
        .object({
          sourceColumn: z.string().min(1),
          targetField: MappedTargetFieldSchema.nullable(),
          transform: AllowedTransformSchema.nullable(),
          confidence: z.number().min(0).max(1),
          evidence: z.string().min(1),
          status: z.enum(["PROPOSED", "REVIEW_REQUIRED"]),
        })
        .strict()
        .refine(
          ({ targetField, transform }) =>
            (targetField === null) === (transform === null),
          {
            message:
              "targetField and transform must either both be null or both be set",
          },
        ),
    ),
  })
  .strict();

export type AllowedTransform = z.infer<typeof AllowedTransformSchema>;
export type MappedTargetField = z.infer<typeof MappedTargetFieldSchema>;
export type SchemaMappingProposal = z.infer<typeof SchemaMappingProposalSchema>;

export function deriveApprovedSourceMapping(proposal: SchemaMappingProposal) {
  return {
    mappingVersion: proposal.mappingVersion,
    sourceArtifactHash: proposal.sourceArtifactHash,
    constants: proposal.constants,
    fields: proposal.fields.map(
      ({ sourceColumn, targetField, transform }) =>
        [sourceColumn, targetField, transform] as const,
    ),
  };
}
