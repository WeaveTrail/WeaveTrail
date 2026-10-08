import { z } from "zod";
import {
  AllowedTransformSchema,
  DecimalStringSchema,
  MappedTargetFieldSchema,
  MappingRunRecordSchema,
  SchemaMappingProposalSchema,
} from "@weavetrail/contracts";
import type { MappingInput } from "@weavetrail/ai-harness";
import {
  MAPPING_OUTPUT_SCHEMA_VERSION,
  MAPPING_VALIDATOR_VERSION,
  validateMappingOutput,
  validateMappingStructure,
} from "@weavetrail/ai-harness/server";
import vocabularyJson from "../fixtures/lexical-baseline-v1/vocabulary.json";
import {
  lexicalKey,
  LEXICAL_BASELINE_VERSION,
  LEXICAL_NORMALIZATION_VERSION,
} from "./lexical-baseline-vocabulary";
import type { MappingRunContext } from "./mapping-model-runner";
import { sha256Canonical } from "@weavetrail/replay-engine";

export const LEXICAL_BASELINE_PROVIDER = "deterministic-lexical-reference";
export const VocabularySchema = z
  .object({
    version: z.enum([LEXICAL_BASELINE_VERSION, "lexical-baseline/2"]),
    normalizationVersion: z.literal(LEXICAL_NORMALIZATION_VERSION),
    devSha256: z.string().regex(/^[a-f0-9]{64}$/),
    entries: z.array(
      z
        .object({
          key: z.string().min(1),
          targetField: MappedTargetFieldSchema,
          transform: AllowedTransformSchema,
        })
        .strict(),
    ),
  })
  .strict();
export const vocabularyV1 = VocabularySchema.parse(vocabularyJson);
export type LexicalVocabulary = typeof vocabularyV1;

export const LEXICAL_BASELINE_DEFINITION = {
  version: LEXICAL_BASELINE_VERSION,
  normalizationVersion: LEXICAL_NORMALIZATION_VERSION,
  devSha256: vocabularyV1.devSha256,
  vocabularyHash: sha256Canonical(vocabularyV1),
  selectable: false as const,
};

function sampleFits(transform: string, value: unknown) {
  if (typeof value !== "string" || value.length === 0) return false;
  switch (transform) {
    case "IDENTITY":
      return true;
    case "DECIMAL_STRING":
      return DecimalStringSchema.safeParse(value).success;
    case "ISO_DATETIME":
      return z.iso.datetime({ offset: true }).safeParse(value).success;
    default:
      return false;
  }
}

/** Only whole names and sample strings decide fields; binding is copied verbatim. */
export function proposeLexicalMapping(
  input: MappingInput,
  vocabulary: LexicalVocabulary = vocabularyV1,
) {
  const fields = input.columns.map((sourceColumn) => {
    const key = lexicalKey(sourceColumn);
    const candidates = vocabulary.entries.filter((entry) => entry.key === key);
    const candidate = candidates.length === 1 ? candidates[0] : undefined;
    const known =
      candidate !== undefined &&
      input.sampleRows.length > 0 &&
      input.sampleRows.every(
        (row) =>
          Object.hasOwn(row, sourceColumn) &&
          sampleFits(candidate.transform, row[sourceColumn]),
      );
    return {
      sourceColumn,
      targetField: known ? candidate.targetField : null,
      transform: known ? candidate.transform : null,
      confidence: known ? 1 : 0,
      evidence: known
        ? "Exact DEV vocabulary match; samples fit the registered transform."
        : "No unique DEV vocabulary match with compatible samples; human review required.",
      status: known ? ("PROPOSED" as const) : ("REVIEW_REQUIRED" as const),
    };
  });
  // Competing aliases do not get an arbitrary winner.
  const targets = fields.map((f) => f.targetField);
  for (const field of fields) {
    if (
      field.targetField !== null &&
      targets.filter((t) => t === field.targetField).length > 1
    ) {
      field.targetField = null;
      field.transform = null;
      field.confidence = 0;
      field.status = "REVIEW_REQUIRED";
      field.evidence =
        "Competing columns match one target; human review required.";
    }
  }
  return SchemaMappingProposalSchema.parse({
    mappingVersion: "1.4",
    sourceArtifactHash: input.sourceArtifactHash,
    constants: input.constants,
    fields,
  });
}

/** No clock, network, credentials or model. 0ms is a sentinel, not a measurement. */
export function runLexicalMapping(
  input: MappingInput,
  context: MappingRunContext,
  vocabulary: LexicalVocabulary = vocabularyV1,
) {
  const proposal = proposeLexicalMapping(input, vocabulary);
  const validation = (
    vocabulary.version === "lexical-baseline/2"
      ? validateMappingStructure
      : validateMappingOutput
  )({ kind: "proposal", value: proposal }, input);
  return MappingRunRecordSchema.parse({
    ...context,
    schemaVersion: "mapping-run/1",
    provider: LEXICAL_BASELINE_PROVIDER,
    requestedModel: vocabulary.version,
    reportedModel: null,
    adapterVersion: vocabulary.version,
    promptVersion: "non-model/no-prompt/1",
    outputSchemaVersion: MAPPING_OUTPUT_SCHEMA_VERSION,
    validatorVersion:
      vocabulary.version === "lexical-baseline/2"
        ? MAPPING_VALIDATOR_VERSION
        : "mapping-validator/1",
    temperature: "0",
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
    outcome: validation.status === "VALID" ? "VALID" : "CONTRACT_REJECTED",
    failureClass: validation.status === "VALID" ? null : "OUTPUT_CONTRACT",
    validatorReasons: validation.reasons,
    parsedOutput: { fields: proposal.fields },
  });
}
