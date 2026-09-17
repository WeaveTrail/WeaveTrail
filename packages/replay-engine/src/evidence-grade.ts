import {
  DecimalStringSchema,
  EvidenceGradedSentenceSchema,
  type CalculatedEvidenceSentence,
  type EvidenceSourceRowReference,
  type QuotedEvidenceSentence,
  type UnconfirmableEvidenceSentence,
  type UnconfirmableReasonCode,
} from "@weavetrail/contracts";

import { sha256Canonical } from "./canonical-hash";
import type { CanonicalJsonInput } from "./canonical-json";
import {
  deriveRawRowHash,
  sourceArtifactHash,
  type SourceRow,
} from "./source-ingest";

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
  | "CALCULATION_VERSION_MISMATCH"
  | "DISPLAY_TEMPLATE_NOT_REGISTERED"
  | "DISPLAY_TEMPLATE_FAILED"
  | "DISPLAY_TEMPLATE_MISMATCH"
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

export type TrustedEvidenceSourceRow = Pick<
  EvidenceSourceRowReference,
  "eventId"
> & {
  sourceRow: SourceRow;
};

export type EvidenceCalculator = (sourceRows: readonly SourceRow[]) => string;

export type EvidenceDisplayTemplateInput = {
  grade: CalculatedEvidenceSentence["grade"];
  reportedValue: string;
  computedValue: string;
};

export type EvidenceDisplayTemplate = (input: EvidenceDisplayTemplateInput) => {
  text: string;
  displayedValueRange: { start: number; end: number };
};

export type RegisteredEvidenceCalculation = {
  calculationVersion: string;
  sourceRows: readonly TrustedEvidenceSourceRow[];
  calculate: EvidenceCalculator;
  displayTemplates: ReadonlyMap<string, EvidenceDisplayTemplate>;
};

export type MissingEvidenceVerificationCode =
  | "CONTRACT_INVALID"
  | "GRADE_NOT_UNCONFIRMABLE"
  | "MISSING_EVIDENCE_CHECK_NOT_REGISTERED"
  | "MISSING_EVIDENCE_CHECK_MISMATCH"
  | "MISSING_EVIDENCE_CHECK_FAILED"
  | "EVIDENCE_AVAILABLE";

export class MissingEvidenceVerificationError extends Error {
  constructor(
    readonly code: MissingEvidenceVerificationCode,
    message: string,
  ) {
    super(message);
    this.name = "MissingEvidenceVerificationError";
  }
}

export type RegisteredMissingEvidenceCheck<Dataset extends CanonicalJsonInput> =
  {
    checkVersion: string;
    reasonCode: UnconfirmableReasonCode;
    dataset: Dataset;
    isMissing: (dataset: Dataset) => boolean;
  };

export type MissingEvidenceVerificationContext<
  Dataset extends CanonicalJsonInput,
> = {
  /** Retain every code-owned check under its stable ID and explicit version. */
  checks: ReadonlyMap<
    string,
    ReadonlyMap<string, RegisteredMissingEvidenceCheck<Dataset>>
  >;
};

export type CalculatedEvidenceVerificationContext = {
  /** Retain every code-owned calculation under its stable ID and version. */
  calculations: ReadonlyMap<
    string,
    ReadonlyMap<string, RegisteredEvidenceCalculation>
  >;
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
 * Resolve an ID-and-version registry entry, re-hash every registered source
 * row, rerun its allowlisted calculation, and reconstruct the complete display
 * sentence from a code-owned template before a calculation grade is exposed.
 */
export function verifyCalculatedEvidence(
  candidate: unknown,
  context: CalculatedEvidenceVerificationContext,
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
  const calculation = sentence.evidence.calculation;
  const registeredVersions = context.calculations.get(
    calculation.calculationId,
  );
  if (registeredVersions === undefined) {
    throw new CalculatedEvidenceVerificationError(
      "CALCULATION_NOT_REGISTERED",
      "The declared calculation is not registered in versioned code.",
    );
  }
  const registered = registeredVersions.get(calculation.calculationVersion);
  if (
    registered === undefined ||
    registered.calculationVersion !== calculation.calculationVersion
  ) {
    throw new CalculatedEvidenceVerificationError(
      "CALCULATION_VERSION_MISMATCH",
      "The declared calculation version does not match registered code.",
    );
  }
  const declaredRows = calculation.sourceRows;
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
        deriveRawRowHash(trusted.sourceRow) === declared.rawRowHash
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
      registered.calculate(
        registered.sourceRows.map(({ sourceRow }) => sourceRow),
      ),
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

  if (recalculated !== calculation.computedValue) {
    throw new CalculatedEvidenceVerificationError(
      "COMPUTED_VALUE_MISMATCH",
      "The attached computed value does not match versioned recalculation.",
    );
  }

  const displayTemplate = registered.displayTemplates.get(
    calculation.displayTemplateId,
  );
  if (displayTemplate === undefined) {
    throw new CalculatedEvidenceVerificationError(
      "DISPLAY_TEMPLATE_NOT_REGISTERED",
      "The declared display template is not registered with the calculation.",
    );
  }
  let expectedDisplay: ReturnType<EvidenceDisplayTemplate>;
  try {
    expectedDisplay = displayTemplate({
      grade: sentence.grade,
      reportedValue: sentence.evidence.reportedValue,
      computedValue: calculation.computedValue,
    });
  } catch {
    throw new CalculatedEvidenceVerificationError(
      "DISPLAY_TEMPLATE_FAILED",
      "The registered display template failed.",
    );
  }
  const declaredRange = sentence.evidence.displayedValueRange;
  if (
    expectedDisplay.text !== sentence.text ||
    expectedDisplay.displayedValueRange.start !== declaredRange.start ||
    expectedDisplay.displayedValueRange.end !== declaredRange.end
  ) {
    throw new CalculatedEvidenceVerificationError(
      "DISPLAY_TEMPLATE_MISMATCH",
      "The displayed sentence does not match its registered template.",
    );
  }
  return sentence;
}

/**
 * Resolve a versioned absence check, re-hash its actual approved dataset, and
 * rerun it before exposing an UNCONFIRMABLE grade and its closed reason code.
 */
export function verifyUnconfirmableEvidence<Dataset extends CanonicalJsonInput>(
  candidate: unknown,
  context: MissingEvidenceVerificationContext<Dataset>,
): UnconfirmableEvidenceSentence {
  const parsed = EvidenceGradedSentenceSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new MissingEvidenceVerificationError(
      "CONTRACT_INVALID",
      "Missing evidence does not satisfy the evidence-grade contract.",
    );
  }
  if (parsed.data.grade !== "UNCONFIRMABLE") {
    throw new MissingEvidenceVerificationError(
      "GRADE_NOT_UNCONFIRMABLE",
      "Only UNCONFIRMABLE evidence can be absence-verified.",
    );
  }

  const sentence = parsed.data;
  const reference = sentence.evidence.missingEvidenceCheck;
  const registeredVersions = context.checks.get(reference.checkId);
  if (registeredVersions === undefined) {
    throw new MissingEvidenceVerificationError(
      "MISSING_EVIDENCE_CHECK_NOT_REGISTERED",
      "The declared missing-evidence check is not registered in versioned code.",
    );
  }
  const registered = registeredVersions.get(reference.checkVersion);
  if (
    registered === undefined ||
    registered.checkVersion !== reference.checkVersion ||
    registered.reasonCode !== sentence.evidence.reasonCode
  ) {
    throw new MissingEvidenceVerificationError(
      "MISSING_EVIDENCE_CHECK_MISMATCH",
      "The missing-evidence declaration does not match its registered check.",
    );
  }

  let missing: boolean;
  try {
    if (sha256Canonical(registered.dataset) !== reference.approvedDatasetHash) {
      throw new MissingEvidenceVerificationError(
        "MISSING_EVIDENCE_CHECK_MISMATCH",
        "The approved dataset content does not match its declared hash.",
      );
    }
    missing = registered.isMissing(registered.dataset);
  } catch (error) {
    if (error instanceof MissingEvidenceVerificationError) throw error;
    throw new MissingEvidenceVerificationError(
      "MISSING_EVIDENCE_CHECK_FAILED",
      "The registered missing-evidence check failed.",
    );
  }
  if (missing !== true) {
    throw new MissingEvidenceVerificationError(
      "EVIDENCE_AVAILABLE",
      "The approved dataset contains the evidence declared missing.",
    );
  }
  return sentence;
}
