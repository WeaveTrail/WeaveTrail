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
  "PUBLISHER_DECIMAL_STRING",
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
  "openPrice",
  "highPrice",
  "lowPrice",
  "closePrice",
  "netChange",
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

const CompositeSourceEventIdSchema = z
  .object({
    sourceColumns: z.array(z.string().min(1)).min(2),
    transform: z.literal("NUL_JOIN"),
    confidence: z.literal(1),
    evidence: z.string().min(1),
    status: z.literal("PROPOSED"),
  })
  .strict()
  .refine(
    ({ sourceColumns }) => new Set(sourceColumns).size === sourceColumns.length,
    {
      message: "Composite source identity columns must be unique",
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

const OhlcDailyConstantsSchema = LegacyConstantsSchema.extend({
  schemaVersion: z.literal("1.3"),
  eventType: z.literal("DAILY_QUOTE"),
}).strict();

const OHLC_TARGET_FIELDS = [
  "openPrice",
  "highPrice",
  "lowPrice",
  "closePrice",
  "netChange",
] as const;

function isOhlcTargetField(targetField: string | null): boolean {
  return OHLC_TARGET_FIELDS.some((field) => field === targetField);
}

const LegacyMappingProposalSchema = z
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
      ).refine(({ targetField }) => !isOhlcTargetField(targetField), {
        message: "Legacy mappings cannot target OHLC daily fields",
      }),
    ),
  })
  .strict();
const CompositeDailyMappingProposalSchema = z
  .object({
    mappingVersion: z.literal("1.6"),
    sourceArtifactHash: z.string().regex(/^[a-f0-9]{64}$/),
    constants: DailyConstantsSchema,
    compositeSourceEventId: CompositeSourceEventIdSchema,
    fields: z.array(
      MappingFieldSchema.refine(
        ({ targetField, transform }) =>
          targetField !== "sourceEventId" &&
          !isOhlcTargetField(targetField) &&
          transform !== "PUBLISHER_DECIMAL_STRING" &&
          (transform !== "YYYYMMDD_TO_KST_DAY_START_ISO" ||
            targetField === "eventTime"),
        {
          message:
            "Version 1.6 reserves sourceEventId for the composite declaration and restricts the trading-date anchor to eventTime",
        },
      ),
    ),
  })
  .strict();
const DailyMappingProposalSchema = z
  .object({
    mappingVersion: z.literal("1.5"),
    sourceArtifactHash: z.string().regex(/^[a-f0-9]{64}$/),
    constants: DailyConstantsSchema,
    fields: z.array(
      MappingFieldSchema.refine(
        ({ targetField, transform }) =>
          !isOhlcTargetField(targetField) &&
          transform !== "PUBLISHER_DECIMAL_STRING" &&
          (transform !== "YYYYMMDD_TO_KST_DAY_START_ISO" ||
            targetField === "eventTime"),
        {
          message:
            "The trading-date anchor transform is only valid for eventTime",
        },
      ),
    ),
  })
  .strict();
const OhlcDailyMappingProposalSchema = z
  .object({
    mappingVersion: z.literal("1.7"),
    sourceArtifactHash: z.string().regex(/^[a-f0-9]{64}$/),
    constants: OhlcDailyConstantsSchema,
    compositeSourceEventId: CompositeSourceEventIdSchema.optional(),
    fields: z.array(
      MappingFieldSchema.refine(
        ({ targetField, transform }) =>
          (transform !== "YYYYMMDD_TO_KST_DAY_START_ISO" ||
            targetField === "eventTime") &&
          !(
            isOhlcTargetField(targetField) &&
            transform !== "PUBLISHER_DECIMAL_STRING"
          ) &&
          !(
            transform === "PUBLISHER_DECIMAL_STRING" &&
            !isOhlcTargetField(targetField)
          ),
        {
          message:
            "Version 1.7 restricts the trading-date anchor and requires publisher-decimal transforms for OHLC/net-change fields",
        },
      ),
    ),
  })
  .strict()
  .superRefine((proposal, context) => {
    const mapsSourceEventId = proposal.fields.some(
      ({ targetField }) => targetField === "sourceEventId",
    );
    if (mapsSourceEventId === (proposal.compositeSourceEventId !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["fields"],
        message:
          "Version 1.7 requires exactly one direct or composite source event identity",
      });
    }
  });

export const PreOhlcSchemaMappingProposalSchema = z.discriminatedUnion(
  "mappingVersion",
  [
    LegacyMappingProposalSchema,
    CompositeDailyMappingProposalSchema,
    DailyMappingProposalSchema,
  ],
);

export const SchemaMappingProposalSchema = z.discriminatedUnion(
  "mappingVersion",
  [
    LegacyMappingProposalSchema,
    CompositeDailyMappingProposalSchema,
    DailyMappingProposalSchema,
    OhlcDailyMappingProposalSchema,
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
    ...("compositeSourceEventId" in proposal &&
    proposal.compositeSourceEventId !== undefined
      ? { compositeSourceEventId: proposal.compositeSourceEventId }
      : {}),
  };
}
