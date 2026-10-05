import { z } from "zod";
import { DecimalStringSchema } from "./decimal-string";
import { MappingFieldSchema } from "./schema-mapping";

export const MAPPING_RUN_RECORD_VERSION = "mapping-run/1";
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

const Base = {
  schemaVersion: z.literal(MAPPING_RUN_RECORD_VERSION),
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
  inputTokens: TokenCount,
  outputTokens: TokenCount,
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
export type MappingRunReceipt = z.infer<typeof MappingRunReceiptSchema>;
export type MappingRunValidatorReason = z.infer<
  typeof MappingRunValidatorReasonSchema
>;
