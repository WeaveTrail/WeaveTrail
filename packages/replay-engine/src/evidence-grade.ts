import {
  DecimalStringSchema,
  EvidenceGradedSentenceSchema,
  type CalculatedEvidenceSentence,
  type EvidenceSourceRowReference,
  type QuotedEvidenceSentence,
} from "@weavetrail/contracts";

import { sourceArtifactHash } from "./source-ingest";

export type QuotedEvidenceVerificationCode =
  | "CONTRACT_INVALID"
  | "GRADE_NOT_QUOTED"
  | "SOURCE_ARTIFACT_HASH_MISMATCH"
  | "SOURCE_SPAN_OUT_OF_BOUNDS"
  | "SOURCE_SPAN_TEXT_MISMATCH";

export class QuotedEvidenceVerificationError extends Error {
  constructor(
    readonly code: QuotedEvidenceVerificationCode,
    message: string,
  ) {
    super(message);
    this.name = "QuotedEvidenceVerificationError";
  }
}

export type CalculatedEvidenceVerificationCode =
  | "CONTRACT_INVALID"
  | "GRADE_NOT_CALCULATED"
  | "SOURCE_ROWS_MISMATCH"
  | "CALCULATION_NOT_REGISTERED"
  | "CALCULATION_FAILED"
  | "COMPUTED_VALUE_MISMATCH";

export class CalculatedEvidenceVerificationError extends Error {
  constructor(
    readonly code: CalculatedEvidenceVerificationCode,
    message: string,
  ) {
    super(message);
    this.name = "CalculatedEvidenceVerificationError";
  }
}

export type TrustedEvidenceSourceRow<Row> = EvidenceSourceRowReference & {
  row: Row;
};

export type EvidenceCalculator<Row> = (sourceRows: readonly Row[]) => string;

export type RegisteredEvidenceCalculation<Row> = {
  sourceRows: readonly TrustedEvidenceSourceRow<Row>[];
  calculate: EvidenceCalculator<Row>;
};

export type CalculatedEvidenceVerificationContext<Row> = {
  /** Only versioned, code-owned calculations belong in this registry. */
  calculations: ReadonlyMap<string, RegisteredEvidenceCalculation<Row>>;
};

/**
 * Re-match a quoted display sentence against the declared bytes. A valid
 * contract alone is not enough: the supplied artifact hash and exact byte
 * slice are checked again at the point that grants the QUOTED grade.
 */
export function verifyQuotedEvidence(
  candidate: unknown,
  sourceBytes: Uint8Array,
): QuotedEvidenceSentence {
  const parsed = EvidenceGradedSentenceSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new QuotedEvidenceVerificationError(
      "CONTRACT_INVALID",
      "Quoted evidence does not satisfy the evidence-grade contract.",
    );
  }
  if (parsed.data.grade !== "QUOTED") {
    throw new QuotedEvidenceVerificationError(
      "GRADE_NOT_QUOTED",
      "Only a QUOTED evidence declaration can be byte-verified.",
    );
  }

  const sentence = parsed.data;
  if (
    sourceArtifactHash(sourceBytes) !== sentence.evidence.sourceArtifactHash
  ) {
    throw new QuotedEvidenceVerificationError(
      "SOURCE_ARTIFACT_HASH_MISMATCH",
      "The supplied source bytes do not match the declared artifact hash.",
    );
  }

  const { start, end } = sentence.evidence.byteRange;
  if (end > sourceBytes.byteLength) {
    throw new QuotedEvidenceVerificationError(
      "SOURCE_SPAN_OUT_OF_BOUNDS",
      "The declared quotation range falls outside the source artifact.",
    );
  }

  const displayedBytes = new TextEncoder().encode(sentence.text);
  const sourceSpan = sourceBytes.subarray(start, end);
  const matches =
    displayedBytes.byteLength === sourceSpan.byteLength &&
    displayedBytes.every((byte, index) => byte === sourceSpan[index]);
  if (!matches) {
    throw new QuotedEvidenceVerificationError(
      "SOURCE_SPAN_TEXT_MISMATCH",
      "The displayed sentence does not exactly match the declared source bytes.",
    );
  }

  return sentence;
}

/**
 * Resolve every declared row and rerun an allowlisted calculation before a
 * code-backed calculation grade is exposed. Data selects a registry key; it
 * never supplies executable calculation logic.
 */
export function verifyCalculatedEvidence<Row>(
  candidate: unknown,
  context: CalculatedEvidenceVerificationContext<Row>,
): CalculatedEvidenceSentence {
  const parsed = EvidenceGradedSentenceSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new CalculatedEvidenceVerificationError(
      "CONTRACT_INVALID",
      "Calculated evidence does not satisfy the evidence-grade contract.",
    );
  }
  if (parsed.data.grade !== "COMPUTED" && parsed.data.grade !== "DIFFERS") {
    throw new CalculatedEvidenceVerificationError(
      "GRADE_NOT_CALCULATED",
      "Only COMPUTED or DIFFERS evidence can be calculation-verified.",
    );
  }

  const sentence = parsed.data;
  const registered = context.calculations.get(
    sentence.evidence.calculation.calculationRef,
  );
  if (registered === undefined) {
    throw new CalculatedEvidenceVerificationError(
      "CALCULATION_NOT_REGISTERED",
      "The declared calculation is not registered in versioned code.",
    );
  }
  const declaredRows = sentence.evidence.calculation.sourceRows;
  const duplicateIds =
    new Set(registered.sourceRows.map(({ eventId }) => eventId)).size !==
    registered.sourceRows.length;
  const rowsMatch =
    !duplicateIds &&
    declaredRows.length === registered.sourceRows.length &&
    declaredRows.every((declared, index) => {
      const trusted = registered.sourceRows[index];
      return (
        trusted !== undefined &&
        trusted.eventId === declared.eventId &&
        trusted.rawRowHash === declared.rawRowHash
      );
    });
  if (!rowsMatch) {
    throw new CalculatedEvidenceVerificationError(
      "SOURCE_ROWS_MISMATCH",
      "The declared source rows do not match the registered calculation inputs.",
    );
  }

  let recalculated: string;
  try {
    const output = DecimalStringSchema.safeParse(
      registered.calculate(registered.sourceRows.map(({ row }) => row)),
    );
    if (!output.success) {
      throw new CalculatedEvidenceVerificationError(
        "CALCULATION_FAILED",
        "The registered calculation did not return an exact decimal string.",
      );
    }
    recalculated = output.data;
  } catch (error) {
    if (error instanceof CalculatedEvidenceVerificationError) throw error;
    throw new CalculatedEvidenceVerificationError(
      "CALCULATION_FAILED",
      "The registered calculation failed.",
    );
  }

  if (recalculated !== sentence.evidence.calculation.computedValue) {
    throw new CalculatedEvidenceVerificationError(
      "COMPUTED_VALUE_MISMATCH",
      "The attached computed value does not match versioned recalculation.",
    );
  }
  return sentence;
}
