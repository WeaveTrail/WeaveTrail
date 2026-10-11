import {
  AllowedTransformSchema,
  MappedTargetFieldSchema,
  MAPPING_RUN_OUTPUT_MAX_BYTES,
  SchemaMappingProposalSchema,
  requiresMappingOverride,
  type AllowedTransform,
  type MappedTargetField,
  type MappingRunValidatorReason,
  type SchemaMappingProposal,
} from "@weavetrail/contracts";
import {
  applyApprovedMapping,
  approvedSourceMapping,
} from "@weavetrail/replay-engine";
import type { MappingInput } from "./provider";

export const MAPPING_VALIDATOR_VERSION = "mapping-validator/2";
/** ADR 0075: resolves opaque column IDs, then applies version 2 unchanged. */
export const MAPPING_COLUMN_ID_VALIDATOR_VERSION = "mapping-validator/3";

export const MAPPING_VALIDATOR_REASON_CODES = [
  "BODY_TOO_LARGE",
  "ENVELOPE_INVALID_JSON",
  "ENVELOPE_INVALID",
  "TOOL_CALL",
  "REFUSAL",
  "LENGTH_STOP",
  "OUTPUT_INVALID_JSON",
  "OUTPUT_CONTRACT",
  "UNKNOWN_TARGET",
  "UNKNOWN_TRANSFORM",
  "INPUT_BINDING_MISMATCH",
  "INVENTED_COLUMN",
  "DUPLICATE_COLUMN",
  "MISSING_COLUMN",
  "REORDERED_COLUMN",
  "DUPLICATE_TARGET",
  "MISSING_REQUIRED_TARGET",
  "TARGET_TRANSFORM_MISMATCH",
  "NO_SAMPLE_ROWS",
  "TRANSFORM_FAILED",
  "REVIEW_STATUS",
] as const;
export type MappingValidatorReasonCode =
  (typeof MAPPING_VALIDATOR_REASON_CODES)[number];

export type MappingValidationResult =
  | { status: "VALID"; proposal: SchemaMappingProposal; reasons: [] }
  | {
      status: "REVIEW_REQUIRED";
      reasons: [
        MappingRunValidatorReason & { code: MappingValidatorReasonCode },
      ];
    };

export type MappingOutput =
  | { kind: "envelope"; body: Uint8Array }
  | { kind: "fields"; value: unknown }
  | { kind: "proposal"; value: unknown };
/** Model output that names columns only by the IDs `mappingColumnIds` assigns. */
export type ColumnIdMappingOutput =
  { kind: "envelope"; body: Uint8Array } | { kind: "fields"; value: unknown };

function reject(
  code: MappingValidatorReasonCode,
  path: MappingRunValidatorReason["path"] = [],
): MappingValidationResult {
  return { status: "REVIEW_REQUIRED", reasons: [{ code, path }] };
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Compatibility is structural, never a guess about a column's meaning.
function compatible(target: MappedTargetField, transform: AllowedTransform) {
  switch (transform) {
    case "IDENTITY":
      return true;
    case "ISO_DATETIME":
    case "EPOCH_MS_TO_ISO":
      return target === "eventTime" || target === "receivedAt";
    case "DECIMAL_STRING":
      return target === "price" || target === "quantity";
    case "BUY_SELL_CODE":
      return target === "side";
    case "EVENT_TYPE_CODE":
      return target === "eventType";
    case "UPPERCASE":
      return ![
        "eventTime",
        "receivedAt",
        "sequence",
        "price",
        "quantity",
      ].includes(target);
    default:
      // The current model-output contract is mapping 1.4, not a daily or
      // composite execution mapping. Its Zod contract rejects these first.
      return false;
  }
}

/** The shared envelope stage: one assistant choice whose content parses as JSON. */
function envelopeContent(
  body: Uint8Array,
): { value: unknown } | { rejected: MappingValidationResult } {
  if (body.byteLength > MAPPING_RUN_OUTPUT_MAX_BYTES)
    return { rejected: reject("BODY_TOO_LARGE") };
  let envelope: unknown;
  try {
    envelope = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(body),
    );
  } catch {
    return { rejected: reject("ENVELOPE_INVALID_JSON") };
  }
  if (
    !object(envelope) ||
    !Array.isArray(envelope.choices) ||
    envelope.choices.length !== 1
  )
    return { rejected: reject("ENVELOPE_INVALID", ["choices"]) };
  const choice: unknown = envelope.choices[0];
  if (
    !object(choice) ||
    !object(choice.message) ||
    choice.message.role !== "assistant"
  )
    return { rejected: reject("ENVELOPE_INVALID", ["choices", 0]) };
  const message = choice.message;
  if (
    Object.hasOwn(message, "tool_calls") ||
    Object.hasOwn(message, "function_call")
  )
    return { rejected: reject("TOOL_CALL", ["choices", 0, "message"]) };
  if (message.refusal)
    return {
      rejected: reject("REFUSAL", ["choices", 0, "message", "refusal"]),
    };
  if (choice.finish_reason === "length")
    return { rejected: reject("LENGTH_STOP", ["choices", 0, "finish_reason"]) };
  if (choice.finish_reason !== "stop" || typeof message.content !== "string")
    return { rejected: reject("ENVELOPE_INVALID", ["choices", 0]) };
  try {
    return { value: JSON.parse(message.content) };
  } catch {
    return { rejected: reject("OUTPUT_INVALID_JSON", ["fields"]) };
  }
}

/**
 * Structural model-output gate, shared by adapter attempts and offline probes.
 * First failure wins: envelope -> contract -> columns -> targets -> transforms
 * (every supplied sample row). VALID is not approval. No provider text is a reason.
 * Parsed fields/proposals enter after the envelope stage for re-validation.
 */
export function validateMappingStructure(
  output: MappingOutput,
  input: MappingInput,
): MappingValidationResult {
  let value: unknown;
  if (output.kind === "envelope") {
    const content = envelopeContent(output.body);
    if ("rejected" in content) return content.rejected;
    value = content.value;
  } else {
    value = output.value;
  }

  if (output.kind !== "proposal") {
    if (
      !object(value) ||
      Object.keys(value).length !== 1 ||
      !Object.hasOwn(value, "fields")
    )
      return reject("OUTPUT_CONTRACT");
    value = {
      mappingVersion: "1.4",
      sourceArtifactHash: input.sourceArtifactHash,
      constants: input.constants,
      fields: value.fields,
    };
  }
  if (!object(value) || !Array.isArray(value.fields))
    return reject("OUTPUT_CONTRACT", ["fields"]);
  try {
    if (
      new TextEncoder().encode(JSON.stringify(value)).byteLength >
      MAPPING_RUN_OUTPUT_MAX_BYTES
    )
      return reject("BODY_TOO_LARGE");
  } catch {
    return reject("OUTPUT_CONTRACT");
  }
  for (const [index, field] of value.fields.entries()) {
    if (!object(field)) return reject("OUTPUT_CONTRACT", ["fields", index]);
    if (
      field.targetField !== null &&
      field.targetField !== undefined &&
      !MappedTargetFieldSchema.safeParse(field.targetField).success
    )
      return reject("UNKNOWN_TARGET", ["fields", index, "targetField"]);
    if (
      field.transform !== null &&
      field.transform !== undefined &&
      !AllowedTransformSchema.safeParse(field.transform).success
    )
      return reject("UNKNOWN_TRANSFORM", ["fields", index, "transform"]);
  }
  const parsed = SchemaMappingProposalSchema.safeParse(value);
  if (!parsed.success) return reject("OUTPUT_CONTRACT");
  const proposal = parsed.data;
  if (
    proposal.mappingVersion !== "1.4" ||
    input.constants.schemaVersion !== "1.1" ||
    proposal.sourceArtifactHash !== input.sourceArtifactHash ||
    JSON.stringify(proposal.constants) !==
      JSON.stringify({
        schemaVersion: input.constants.schemaVersion,
        datasetId: input.constants.datasetId,
        venueId: input.constants.venueId,
      })
  )
    return reject("INPUT_BINDING_MISMATCH");
  for (const [index, field] of proposal.fields.entries()) {
    if (!field.evidence.trim() || field.evidence.length > 1000)
      return reject("OUTPUT_CONTRACT", ["fields", index, "evidence"]);
  }

  const columns = proposal.fields.map((field) => field.sourceColumn);
  for (const [index, column] of columns.entries()) {
    if (!input.columns.includes(column))
      return reject("INVENTED_COLUMN", ["fields", index, "sourceColumn"]);
    if (columns.indexOf(column) !== index)
      return reject("DUPLICATE_COLUMN", ["fields", index, "sourceColumn"]);
  }
  if (new Set(input.columns).size !== input.columns.length)
    return reject("DUPLICATE_COLUMN", ["columns"]);
  if (columns.length !== input.columns.length)
    return reject("MISSING_COLUMN", ["fields"]);
  const reordered = columns.findIndex(
    (column, index) => column !== input.columns[index],
  );
  if (reordered >= 0)
    return reject("REORDERED_COLUMN", ["fields", reordered, "sourceColumn"]);

  const targets = new Set<MappedTargetField>();
  for (const [index, field] of proposal.fields.entries()) {
    if (field.targetField === null) continue;
    if (targets.has(field.targetField))
      return reject("DUPLICATE_TARGET", ["fields", index, "targetField"]);
    targets.add(field.targetField);
  }
  for (const required of [
    "sourceEventId",
    "eventTime",
    "instrumentId",
    "eventType",
  ] as const) {
    if (!targets.has(required))
      return reject("MISSING_REQUIRED_TARGET", ["fields"]);
  }

  for (const [index, field] of proposal.fields.entries()) {
    if (
      field.targetField !== null &&
      field.transform !== null &&
      !compatible(field.targetField, field.transform)
    )
      return reject("TARGET_TRANSFORM_MISMATCH", [
        "fields",
        index,
        "transform",
      ]);
  }
  if (input.sampleRows.length === 0)
    return reject("NO_SAMPLE_ROWS", ["sampleRows"]);
  const rows = [];
  for (const [rowIndex, row] of input.sampleRows.entries()) {
    const values: Record<string, string> = Object.create(null);
    for (const [columnIndex, column] of input.columns.entries()) {
      if (!Object.hasOwn(row, column) || typeof row[column] !== "string")
        return reject("TRANSFORM_FAILED", [
          "sampleRows",
          rowIndex,
          columnIndex,
        ]);
      values[column] = row[column];
    }
    rows.push({
      coordinate: {
        sourceArtifactHash: input.sourceArtifactHash,
        rowNumber: String(rowIndex + 1),
      },
      values,
    });
  }
  // Reuse the exact deterministic ingest transforms and resulting event contract.
  // These temporary events are discarded; this is neither approval nor replay.
  const dryRun = applyApprovedMapping(rows, approvedSourceMapping(proposal));
  if (dryRun.status === "REVIEW_REQUIRED") {
    const issue = dryRun.issues[0]!;
    return reject("TRANSFORM_FAILED", ["sampleRows", issue.rowIndex ?? 0]);
  }
  return { status: "VALID", proposal, reasons: [] };
}

function approvalReady(
  result: MappingValidationResult,
): MappingValidationResult {
  if (result.status !== "VALID") return result;
  const { proposal } = result;
  for (const [index, field] of proposal.fields.entries()) {
    if (requiresMappingOverride(field))
      return reject("REVIEW_STATUS", ["fields", index]);
  }
  return { status: "VALID", proposal, reasons: [] };
}

/** Approval-readiness gate: preserves the historical live fail-closed behavior. */
export function validateMappingOutput(
  output: MappingOutput,
  input: MappingInput,
): MappingValidationResult {
  return approvalReady(validateMappingStructure(output, input));
}

/** Opaque IDs `c01`, `c02`, … in supplied order; never derived from a header. */
export function mappingColumnIds(input: Pick<MappingInput, "columns">) {
  return input.columns.map(
    (_, index) => `c${String(index + 1).padStart(2, "0")}`,
  );
}

/**
 * `mapping-validator/3`: resolve each returned `columnId` to its supplied
 * column, then apply every `mapping-validator/2` check unchanged to the
 * resolved fields. An unknown, duplicated, missing or reordered ID is rejected
 * under the existing column reason codes. Nothing version 2 rejects passes.
 */
export function validateColumnIdStructure(
  output: ColumnIdMappingOutput,
  input: MappingInput,
): MappingValidationResult {
  let value: unknown;
  if (output.kind === "envelope") {
    const content = envelopeContent(output.body);
    if ("rejected" in content) return content.rejected;
    value = content.value;
  } else {
    value = output.value;
  }
  if (
    !object(value) ||
    Object.keys(value).length !== 1 ||
    !Object.hasOwn(value, "fields")
  )
    return reject("OUTPUT_CONTRACT");
  if (!Array.isArray(value.fields))
    return reject("OUTPUT_CONTRACT", ["fields"]);
  const ids = mappingColumnIds(input);
  const returned: string[] = [];
  for (const [index, field] of value.fields.entries()) {
    // A header is never output under this contract, so a returned
    // `sourceColumn` is an undeclared key, not a second way to name a column.
    if (
      !object(field) ||
      !Object.hasOwn(field, "columnId") ||
      Object.hasOwn(field, "sourceColumn")
    )
      return reject("OUTPUT_CONTRACT", ["fields", index]);
    const id = field.columnId;
    if (typeof id !== "string" || !ids.includes(id))
      return reject("INVENTED_COLUMN", ["fields", index, "columnId"]);
    if (returned.includes(id))
      return reject("DUPLICATE_COLUMN", ["fields", index, "columnId"]);
    returned.push(id);
  }
  if (returned.length !== ids.length)
    return reject("MISSING_COLUMN", ["fields"]);
  const reordered = returned.findIndex((id, index) => id !== ids[index]);
  if (reordered >= 0)
    return reject("REORDERED_COLUMN", ["fields", reordered, "columnId"]);
  const fields = (value.fields as Record<string, unknown>[]).map(
    ({ columnId, ...field }) => ({
      sourceColumn: input.columns[ids.indexOf(columnId as string)],
      ...field,
    }),
  );
  return validateMappingStructure({ kind: "fields", value: { fields } }, input);
}

/** Version 3 approval readiness: the same review gate after ID resolution. */
export function validateColumnIdOutput(
  output: ColumnIdMappingOutput,
  input: MappingInput,
): MappingValidationResult {
  return approvalReady(validateColumnIdStructure(output, input));
}
