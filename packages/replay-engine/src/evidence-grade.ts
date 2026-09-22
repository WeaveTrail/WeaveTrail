import {
  DecimalStringSchema,
  EvidenceGradedSentenceSchema,
  SourceTraceRowSchema,
  TradeEventSchema,
  type CalculatedEvidenceSentence,
  type InterpretationEvidenceSentence,
  type QuotedEvidenceSentence,
  type TradeEvent,
  type UnconfirmableEvidenceSentence,
  type UnconfirmableReasonCode,
} from "@weavetrail/contracts";

import { sha256Canonical } from "./canonical-hash";
import { canonicalJson, type CanonicalJsonInput } from "./canonical-json";
import { normalizeEventTime } from "./canonical-order";
import { canonicalizeEvents, projectCanonicalEvent } from "./canonicalize";
import {
  deriveEventId,
  deriveRawRowHash,
  requireUniqueSourceCoordinates,
  sourceArtifactHash,
  type SourceRow,
} from "./source-ingest";

export type QuotedEvidenceVerificationCode =
  | "CONTRACT_INVALID"
  | "GRADE_NOT_QUOTED"
  | "SOURCE_ARTIFACT_NOT_REGISTERED"
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

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

declare const verifiedEvidenceBrand: unique symbol;

type VerifiedEvidence<Sentence> = DeepReadonly<Sentence> & {
  readonly [verifiedEvidenceBrand]: true;
};

export type VerifiedQuotedEvidenceSentence =
  VerifiedEvidence<QuotedEvidenceSentence>;
export type VerifiedCalculatedEvidenceSentence =
  VerifiedEvidence<CalculatedEvidenceSentence>;
export type VerifiedUnconfirmableEvidenceSentence =
  VerifiedEvidence<UnconfirmableEvidenceSentence>;
export type ValidatedInterpretationEvidenceSentence =
  VerifiedEvidence<InterpretationEvidenceSentence>;

export type QuotedEvidenceVerificationContext = {
  /** Retained artifacts indexed by their immutable SHA-256. */
  sourceArtifacts: ReadonlyMap<string, Uint8Array>;
};

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
  | "COMPUTED_VALUE_MISMATCH"
  | "REPORTED_VALUE_NOT_REGISTERED"
  | "REPORTED_VALUE_FAILED"
  | "REPORTED_VALUE_MISMATCH";

export class CalculatedEvidenceVerificationError extends Error {
  constructor(
    readonly code: CalculatedEvidenceVerificationCode,
    message: string,
  ) {
    super(message);
    this.name = "CalculatedEvidenceVerificationError";
  }
}

export type TrustedEvidenceSourceRow = {
  event: TradeEvent;
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
  /** Required for DIFFERS; resolves the reported side from trusted rows. */
  reportedValueFromSourceRows?: EvidenceCalculator;
  displayTemplates: ReadonlyMap<string, EvidenceDisplayTemplate>;
};

export type MissingEvidenceVerificationCode =
  | "CONTRACT_INVALID"
  | "GRADE_NOT_UNCONFIRMABLE"
  | "MISSING_EVIDENCE_CHECK_NOT_REGISTERED"
  | "MISSING_EVIDENCE_CHECK_MISMATCH"
  | "MISSING_EVIDENCE_CHECK_FAILED"
  | "EVIDENCE_AVAILABLE"
  | "DISPLAY_TEMPLATE_NOT_REGISTERED"
  | "DISPLAY_TEMPLATE_FAILED"
  | "DISPLAY_TEMPLATE_MISMATCH";

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
    /** Versioned semantic projection used for the approved dataset hash. */
    canonicalDatasetForHash: (dataset: Dataset) => CanonicalJsonInput;
    isMissing: (dataset: Dataset) => boolean;
    displayTemplates: ReadonlyMap<string, () => string>;
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

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const child of value) deepFreeze(child);
    Object.freeze(value);
  } else if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function freezeVerifiedEvidence<Sentence>(
  sentence: Sentence,
): VerifiedEvidence<Sentence> {
  return deepFreeze(sentence) as unknown as VerifiedEvidence<Sentence>;
}

/** Canonical serialization creates the isolated snapshot that is then frozen. */
function immutableCanonicalSnapshot<T extends CanonicalJsonInput>(value: T): T {
  return deepFreeze(JSON.parse(canonicalJson(value)) as T);
}

/**
 * Re-match a quoted display sentence against the declared bytes. A valid
 * contract alone is not enough: the supplied artifact hash and exact byte
 * slice are checked again at the point that grants the QUOTED grade.
 */
export function verifyQuotedEvidence(
  candidate: unknown,
  context: QuotedEvidenceVerificationContext,
): VerifiedQuotedEvidenceSentence {
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
  const registeredBytes = context.sourceArtifacts.get(
    sentence.evidence.sourceArtifactHash,
  );
  if (registeredBytes === undefined) {
    throw new QuotedEvidenceVerificationError(
      "SOURCE_ARTIFACT_NOT_REGISTERED",
      "The declared source artifact is not available in the trusted store.",
    );
  }
  const sourceBytes = new Uint8Array(registeredBytes);
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

  return freezeVerifiedEvidence(sentence);
}

export type InterpretationEvidenceValidationCode =
  "CONTRACT_INVALID" | "GRADE_NOT_INTERPRETATION";

export class InterpretationEvidenceValidationError extends Error {
  constructor(
    readonly code: InterpretationEvidenceValidationCode,
    message: string,
  ) {
    super(message);
    this.name = "InterpretationEvidenceValidationError";
  }
}

/** Validate and freeze the audit declaration required by an interpretation. */
export function validateInterpretationEvidence(
  candidate: unknown,
): ValidatedInterpretationEvidenceSentence {
  const parsed = EvidenceGradedSentenceSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new InterpretationEvidenceValidationError(
      "CONTRACT_INVALID",
      "Interpretation evidence does not satisfy the evidence-grade contract.",
    );
  }
  if (parsed.data.grade !== "INTERPRETATION") {
    throw new InterpretationEvidenceValidationError(
      "GRADE_NOT_INTERPRETATION",
      "Only an INTERPRETATION evidence declaration can be validated here.",
    );
  }
  return freezeVerifiedEvidence(parsed.data);
}

/** Hash the complete semantic event while excluding volatile receipt metadata. */
export function canonicalEvidenceEventHash(event: TradeEvent): string {
  const parsed = TradeEventSchema.parse(event);
  return sha256Canonical(
    projectCanonicalEvent({
      ...parsed,
      eventTime: normalizeEventTime(parsed.eventTime),
    }),
  );
}

/**
 * Resolve an ID-and-version registry entry, re-hash every registered source
 * row, rerun its allowlisted calculation, and reconstruct the complete display
 * sentence from a code-owned template before a calculation grade is exposed.
 */
export function verifyCalculatedEvidence(
  candidate: unknown,
  context: CalculatedEvidenceVerificationContext,
): VerifiedCalculatedEvidenceSentence {
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
  let trustedRows: TrustedEvidenceSourceRow[];
  try {
    trustedRows = registered.sourceRows.map(({ event, sourceRow }) => ({
      event: deepFreeze(TradeEventSchema.parse(event)),
      sourceRow: immutableCanonicalSnapshot(
        SourceTraceRowSchema.parse(sourceRow),
      ),
    }));
    requireUniqueSourceCoordinates(
      trustedRows.map(({ sourceRow }) => sourceRow),
    );

    const duplicateIds =
      new Set(trustedRows.map(({ event }) => event.eventId)).size !==
      trustedRows.length;
    if (duplicateIds) {
      throw new Error(
        "Duplicate event identifiers are not calculation inputs.",
      );
    }

    const canonicalEvents = canonicalizeEvents(
      trustedRows.map(({ event }) => event),
    ).events;
    if (canonicalEvents.length !== trustedRows.length) {
      throw new Error("Calculation inputs must remain distinct.");
    }
    const sourceRowsByEventId = new Map(
      trustedRows.map(({ event, sourceRow }) => [event.eventId, sourceRow]),
    );
    trustedRows = canonicalEvents.map((event) => {
      const sourceRow = sourceRowsByEventId.get(event.eventId);
      if (sourceRow === undefined) {
        throw new Error("Canonical event lost its authenticated source row.");
      }
      return { event: deepFreeze(event), sourceRow };
    });
  } catch {
    throw new CalculatedEvidenceVerificationError(
      "SOURCE_ROWS_MISMATCH",
      "Registered calculation inputs are not unique canonical event traces.",
    );
  }

  const declaredRows = calculation.sourceRows;
  const rowsMatch =
    declaredRows.length === trustedRows.length &&
    declaredRows.every((declared, index) => {
      const trusted = trustedRows[index];
      const rawRowHash =
        trusted === undefined ? undefined : deriveRawRowHash(trusted.sourceRow);
      return (
        trusted !== undefined &&
        trusted.event.eventId ===
          deriveEventId({
            datasetId: trusted.event.datasetId,
            venueId: trusted.event.venueId,
            sourceEventId: trusted.event.sourceEventId,
          }) &&
        trusted.event.eventId === declared.eventId &&
        trusted.event.rawRowHash === rawRowHash &&
        rawRowHash === declared.rawRowHash &&
        canonicalEvidenceEventHash(trusted.event) ===
          declared.canonicalEventHash
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
      registered.calculate(trustedRows.map(({ sourceRow }) => sourceRow)),
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

  if (sentence.grade === "DIFFERS") {
    if (registered.reportedValueFromSourceRows === undefined) {
      throw new CalculatedEvidenceVerificationError(
        "REPORTED_VALUE_NOT_REGISTERED",
        "A DIFFERS grade requires a code-owned reported-value resolver.",
      );
    }
    let reportedValue: string;
    try {
      const output = DecimalStringSchema.safeParse(
        registered.reportedValueFromSourceRows(
          trustedRows.map(({ sourceRow }) => sourceRow),
        ),
      );
      if (!output.success) {
        throw new CalculatedEvidenceVerificationError(
          "REPORTED_VALUE_FAILED",
          "The registered reported-value resolver did not return an exact decimal string.",
        );
      }
      reportedValue = output.data;
    } catch (error) {
      if (error instanceof CalculatedEvidenceVerificationError) throw error;
      throw new CalculatedEvidenceVerificationError(
        "REPORTED_VALUE_FAILED",
        "The registered reported-value resolver failed.",
      );
    }
    if (reportedValue !== sentence.evidence.reportedValue) {
      throw new CalculatedEvidenceVerificationError(
        "REPORTED_VALUE_MISMATCH",
        "The reported value does not match the trusted source rows.",
      );
    }
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
  return freezeVerifiedEvidence(sentence);
}

/**
 * Resolve a versioned absence check, re-hash its actual approved dataset, and
 * rerun it before exposing an UNCONFIRMABLE grade and its closed reason code.
 */
export function verifyUnconfirmableEvidence<Dataset extends CanonicalJsonInput>(
  candidate: unknown,
  context: MissingEvidenceVerificationContext<Dataset>,
): VerifiedUnconfirmableEvidenceSentence {
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
    const dataset = immutableCanonicalSnapshot(registered.dataset);
    const canonicalDataset = immutableCanonicalSnapshot(
      registered.canonicalDatasetForHash(dataset),
    );
    if (sha256Canonical(canonicalDataset) !== reference.approvedDatasetHash) {
      throw new MissingEvidenceVerificationError(
        "MISSING_EVIDENCE_CHECK_MISMATCH",
        "The approved dataset content does not match its declared hash.",
      );
    }
    missing = registered.isMissing(dataset);
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

  const displayTemplate = registered.displayTemplates.get(
    reference.displayTemplateId,
  );
  if (displayTemplate === undefined) {
    throw new MissingEvidenceVerificationError(
      "DISPLAY_TEMPLATE_NOT_REGISTERED",
      "The declared missing-evidence display template is not registered.",
    );
  }
  let expectedText: string;
  try {
    expectedText = displayTemplate();
  } catch {
    throw new MissingEvidenceVerificationError(
      "DISPLAY_TEMPLATE_FAILED",
      "The registered missing-evidence display template failed.",
    );
  }
  if (sentence.text !== expectedText) {
    throw new MissingEvidenceVerificationError(
      "DISPLAY_TEMPLATE_MISMATCH",
      "The displayed sentence does not match its registered missing-evidence template.",
    );
  }
  return freezeVerifiedEvidence(sentence);
}
