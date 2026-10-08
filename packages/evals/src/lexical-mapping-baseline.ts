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
const vocabulary = z
  .object({
    version: z.literal(LEXICAL_BASELINE_VERSION),
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
  .strict()
  .parse(vocabularyJson);

export const LEXICAL_BASELINE_DEFINITION = {
  version: LEXICAL_BASELINE_VERSION,
  normalizationVersion: LEXICAL_NORMALIZATION_VERSION,
  devSha256: vocabulary.devSha256,
  vocabularyHash: sha256Canonical(vocabulary),
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
export function proposeLexicalMapping(input: MappingInput) {
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
) {
  const proposal = proposeLexicalMapping(input);
  const validation = validateMappingOutput(
    { kind: "proposal", value: proposal },
    input,
  );
  return MappingRunRecordSchema.parse({
    ...context,
    schemaVersion: "mapping-run/1",
    provider: LEXICAL_BASELINE_PROVIDER,
    requestedModel: LEXICAL_BASELINE_VERSION,
    reportedModel: null,
    adapterVersion: LEXICAL_BASELINE_VERSION,
    promptVersion: "non-model/no-prompt/1",
    outputSchemaVersion: MAPPING_OUTPUT_SCHEMA_VERSION,
    validatorVersion: MAPPING_VALIDATOR_VERSION,
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
