import { z } from "zod";

export const MAPPING_CONFIDENCE_REVIEW_THRESHOLD = 1;

const LegacyAllowedTransformSchema = z.enum([
  "IDENTITY",
  "ISO_DATETIME",
  "EPOCH_MS_TO_ISO",
  "UPPERCASE",
  "DECIMAL_STRING",
  "BUY_SELL_CODE",
  "EVENT_TYPE_CODE",
]);

export const AllowedTransformSchema = z.enum([
  ...LegacyAllowedTransformSchema.options,
  "YYYYMMDD_TO_KST_DAY_START_ISO",
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

const MappingFieldSchema = z
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
  );

const LegacyConstantsSchema = z
  .object({
    schemaVersion: z.literal("1.1"),
    datasetId: z.string().min(1),
    venueId: z.string().min(1),
  })
  .strict();

const DailyConstantsSchema = LegacyConstantsSchema.extend({
  schemaVersion: z.literal("1.2"),
  eventType: z.literal("DAILY_QUOTE"),
}).strict();

export const SchemaMappingProposalSchema = z.discriminatedUnion(
  "mappingVersion",
  [
    z
      .object({
        mappingVersion: z.literal("1.4"),
        sourceArtifactHash: z.string().regex(/^[a-f0-9]{64}$/),
        constants: LegacyConstantsSchema,
        fields: z.array(
          MappingFieldSchema.refine(
            ({ transform }) =>
              transform === null ||
              LegacyAllowedTransformSchema.safeParse(transform).success,
            { message: "Legacy mappings accept only legacy transforms" },
          ),
        ),
      })
      .strict(),
    z
      .object({
        mappingVersion: z.literal("1.5"),
        sourceArtifactHash: z.string().regex(/^[a-f0-9]{64}$/),
        constants: DailyConstantsSchema,
        fields: z.array(
          MappingFieldSchema.refine(
            ({ targetField, transform }) =>
              transform !== "YYYYMMDD_TO_KST_DAY_START_ISO" ||
              targetField === "eventTime",
            {
              message:
                "The trading-date anchor transform is only valid for eventTime",
            },
          ),
        ),
      })
      .strict(),
  ],
);

export type AllowedTransform = z.infer<typeof AllowedTransformSchema>;
export type MappedTargetField = z.infer<typeof MappedTargetFieldSchema>;
export type SchemaMappingProposal = z.infer<typeof SchemaMappingProposalSchema>;

export function requiresMappingOverride(
  field: SchemaMappingProposal["fields"][number],
): boolean {
  return (
    field.status === "REVIEW_REQUIRED" ||
    field.confidence < MAPPING_CONFIDENCE_REVIEW_THRESHOLD
  );
}

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
