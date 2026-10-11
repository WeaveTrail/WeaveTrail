import { z } from "zod";
import { DecimalStringSchema } from "./decimal-string";
import {
  AllowedTransformSchema,
  MappedTargetFieldSchema,
  MappingFieldSchema,
} from "./schema-mapping";

export const MAPPING_RUN_RECORD_VERSION = "mapping-run/1";
/** ADR 0075: retains the returned column ID and the header projected from it. */
export const MAPPING_RUN_RECORD_V2_VERSION = "mapping-run/2";
export const MAPPING_RUN_OUTPUT_MAX_BYTES = 65_536;

const Identifier = z.string().trim().min(1).max(256);
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const NonnegativeInteger = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const TokenCount = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();

/** Stable codes and coordinates only: no exception messages or provider errors. */
export const MappingRunValidatorReasonSchema = z
  .object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{0,127}$/),
    path: z.array(z.union([Identifier, NonnegativeInteger])).max(32),
  })
  .strict();

// Retain incorrect scalar values and missing fields for later validation, but
// never arbitrary JSON objects: those could contain transport data or secrets.
const Scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const RetainedField = z
  .object({
    sourceColumn: Scalar.optional(),
    targetField: Scalar.optional(),
    transform: Scalar.optional(),
    confidence: Scalar.optional(),
    evidence: Scalar.optional(),
    status: Scalar.optional(),
  })
  .strict();

// Version 2 keeps the returned `columnId` scalar as received. `sourceColumn` is
// never model output here: the runner projects it from the supplied column list,
// and offline revalidation recomputes it before any count reads it.
const RetainedFieldV2 = RetainedField.extend({
  columnId: Scalar.optional(),
  sourceColumn: z.string().optional(),
}).strict();

function boundedOutput<T extends z.ZodType>(schema: T) {
  return schema.refine(
    (output) =>
      new TextEncoder().encode(JSON.stringify(output)).byteLength <=
      MAPPING_RUN_OUTPUT_MAX_BYTES,
    { message: "Structured output exceeds 64 KiB of UTF-8 JSON" },
  );
}

/** The commit-safe projection is the model's field output, not an envelope. */
export const MappingRunStructuredOutputSchema = boundedOutput(
  z.object({ fields: z.array(RetainedField) }).strict(),
);
const ValidOutput = boundedOutput(
  z.object({ fields: z.array(MappingFieldSchema) }).strict(),
);
export const MappingRunStructuredOutputV2Schema = boundedOutput(
  z.object({ fields: z.array(RetainedFieldV2) }).strict(),
);
const ValidOutputV2 = boundedOutput(
  z
    .object({
      fields: z.array(
        z
          .object({
            columnId: z.string().min(1),
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
    .strict(),
);

const Observations = {
  evaluationSet: z
    .object({
      version: Identifier,
      sha256: Sha256,
      split: z.enum(["DEV", "HELD_OUT"]),
    })
    .strict(),
  dialectId: Identifier,
  repeat: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  provider: Identifier,
  requestedModel: Identifier,
  reportedModel: Identifier.nullable(),
  adapterVersion: Identifier,
  promptVersion: Identifier,
  outputSchemaVersion: Identifier,
  validatorVersion: Identifier,
  temperature: DecimalStringSchema.refine((value) => !value.startsWith("-"), {
    message: "Temperature must be nonnegative",
  }),
  latencyMs: NonnegativeInteger,
  // Additive observation; historical records keep their original bytes/hashes.
  httpStatus: z.number().int().min(100).max(599).nullable().optional(),
  inputTokens: TokenCount,
  outputTokens: TokenCount,
};
const Base = {
  schemaVersion: z.literal(MAPPING_RUN_RECORD_VERSION),
  ...Observations,
};
const BaseV2 = {
  schemaVersion: z.literal(MAPPING_RUN_RECORD_V2_VERSION),
  ...Observations,
};

export const MappingRunRecordSchema = z.discriminatedUnion("outcome", [
  z
    .object({
      ...Base,
      outcome: z.literal("VALID"),
      validatorReasons: z.array(MappingRunValidatorReasonSchema).max(0),
      failureClass: z.null(),
      parsedOutput: ValidOutput,
    })
    .strict(),
  z
    .object({
      ...Base,
      outcome: z.literal("CONTRACT_REJECTED"),
      validatorReasons: z.array(MappingRunValidatorReasonSchema).min(1),
      failureClass: z.enum([
        "OUTPUT_CONTRACT",
        "UNPARSEABLE_OUTPUT",
        "OUTPUT_NOT_RETAINABLE",
      ]),
      parsedOutput: MappingRunStructuredOutputSchema.nullable(),
    })
    .strict()
    .refine(
      ({ failureClass, parsedOutput }) =>
        failureClass === "OUTPUT_CONTRACT" || parsedOutput === null,
      {
        path: ["parsedOutput"],
        message: "Unparseable or non-retainable output must be null",
      },
    ),
  z
    .object({
      ...Base,
      outcome: z.literal("PROVIDER_FAILED"),
      validatorReasons: z.array(MappingRunValidatorReasonSchema).max(0),
      failureClass: z.enum([
        "TIMEOUT",
        "RATE_LIMITED",
        "AUTHENTICATION",
        "TRANSPORT",
        "HTTP_ERROR",
        "STRICT_MODE_UNSUPPORTED",
        "INVALID_RESPONSE",
        "UNKNOWN_PROVIDER_FAILURE",
      ]),
      parsedOutput: z.null(),
    })
    .strict(),
]);

/** The same outcomes and failure classes as version 1, over the ID-form output. */
export const MappingRunRecordV2Schema = z.discriminatedUnion("outcome", [
  MappingRunRecordSchema.options[0]
    .omit({ schemaVersion: true, parsedOutput: true })
    .extend({ ...BaseV2, parsedOutput: ValidOutputV2 })
    .strict(),
  z
    .object({
      ...BaseV2,
      outcome: z.literal("CONTRACT_REJECTED"),
      validatorReasons: z.array(MappingRunValidatorReasonSchema).min(1),
      failureClass: z.enum([
        "OUTPUT_CONTRACT",
        "UNPARSEABLE_OUTPUT",
        "OUTPUT_NOT_RETAINABLE",
      ]),
      parsedOutput: MappingRunStructuredOutputV2Schema.nullable(),
    })
    .strict()
    .refine(
      ({ failureClass, parsedOutput }) =>
        failureClass === "OUTPUT_CONTRACT" || parsedOutput === null,
      {
        path: ["parsedOutput"],
        message: "Unparseable or non-retainable output must be null",
      },
    ),
  MappingRunRecordSchema.options[2]
    .omit({ schemaVersion: true })
    .extend(BaseV2)
    .strict(),
]);
/** Either record version; scorers reject a mix of versions in one input set. */
export const AnyMappingRunRecordSchema = z.union([
  MappingRunRecordSchema,
  MappingRunRecordV2Schema,
]);

/** A record hash links actual run context without putting it in the summary. */
export const MappingRunReceiptSchema = z
  .object({
    schemaVersion: z.literal("mapping-run-receipt/1"),
    runId: Identifier,
    startedAt: z.iso.datetime(),
    recordHash: Sha256,
  })
  .strict();

export type MappingRunRecord = z.infer<typeof MappingRunRecordSchema>;
export type MappingRunRecordV2 = z.infer<typeof MappingRunRecordV2Schema>;
export type AnyMappingRunRecord = z.infer<typeof AnyMappingRunRecordSchema>;
export type MappingRunReceipt = z.infer<typeof MappingRunReceiptSchema>;
export type MappingRunValidatorReason = z.infer<
  typeof MappingRunValidatorReasonSchema
>;
