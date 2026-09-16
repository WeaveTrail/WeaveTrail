import { describe, expect, it } from "vitest";

import {
  EVIDENCE_GRADES,
  EvidenceGradedPageSchema,
  EvidenceGradedSentenceSchema,
} from "./evidence-grade";

const hash = "a".repeat(64);
const base = {
  evidenceVersion: "1.0",
  sentenceId: "sentence-1",
  text: "The close was 1032.82.",
} as const;
const calculation = {
  calculationId: "daily-close",
  calculationVersion: "1.0.0",
  sourceRows: [{ eventId: "event-1", rawRowHash: hash }],
  computedValue: "1032.82",
};
const computedEvidence = {
  reportedValue: "1032.82",
  displayedValueRange: { start: 14, end: 21 },
  calculation,
};
const missingEvidenceCheck = {
  checkId: "daily-quote-time-of-day",
  checkVersion: "1.0.0",
  approvedDatasetHash: hash,
};

describe("evidence grade contracts", () => {
  it("keeps the grade set closed and in display order", () => {
    expect(EVIDENCE_GRADES).toEqual([
      "QUOTED",
      "COMPUTED",
      "DIFFERS",
      "UNCONFIRMABLE",
      "INTERPRETATION",
    ]);
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "SUPPORTED",
        evidence: calculation,
      }).success,
    ).toBe(false);
  });

  it("requires a source span for quoted text", () => {
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "QUOTED",
        evidence: {
          sourceArtifactHash: hash,
          byteRange: { start: 4, end: 25 },
        },
      }).success,
    ).toBe(true);
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "QUOTED",
        evidence: { sourceArtifactHash: hash },
      }).success,
    ).toBe(false);
  });

  it("requires source rows and a calculation reference for computed grades", () => {
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "COMPUTED",
        evidence: computedEvidence,
      }).success,
    ).toBe(true);
    for (const invalidCalculation of [
      { ...calculation, calculationId: "" },
      { ...calculation, calculationVersion: "daily" },
      { ...calculation, sourceRows: [] },
    ])
      expect(
        EvidenceGradedSentenceSchema.safeParse({
          ...base,
          grade: "COMPUTED",
          evidence: {
            ...computedEvidence,
            calculation: invalidCalculation,
          },
        }).success,
      ).toBe(false);
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "COMPUTED",
        evidence: { ...computedEvidence, reportedValue: "1031.5" },
      }).success,
    ).toBe(false);
  });

  it("binds a calculated grade to the value inside the displayed sentence", () => {
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        text: "The close was 0.",
        grade: "COMPUTED",
        evidence: {
          ...computedEvidence,
          displayedValueRange: { start: 14, end: 15 },
        },
      }).success,
    ).toBe(false);
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "COMPUTED",
        evidence: {
          ...computedEvidence,
          displayedValueRange: { start: 14, end: 200 },
        },
      }).success,
    ).toBe(false);
  });

  it("attaches the different recomputed value and rejects equal decimals", () => {
    expect(
      EvidenceGradedSentenceSchema.parse({
        ...base,
        text: "The close was 1031.5.",
        grade: "DIFFERS",
        evidence: {
          reportedValue: "1031.5",
          displayedValueRange: { start: 14, end: 20 },
          calculation,
        },
      }).evidence,
    ).toMatchObject({
      reportedValue: "1031.5",
      calculation: { computedValue: "1032.82" },
    });
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "DIFFERS",
        evidence: {
          ...computedEvidence,
          reportedValue: "1032.820",
          calculation: { ...calculation, computedValue: "1032.82" },
        },
      }).success,
    ).toBe(false);
  });

  it("accepts only closed reason codes with a versioned absence check", () => {
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "UNCONFIRMABLE",
        evidence: {
          reasonCode: "DAILY_QUOTES_HAVE_NO_TIME_OF_DAY",
          missingEvidenceCheck,
        },
      }).success,
    ).toBe(true);
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "UNCONFIRMABLE",
        evidence: {
          reasonCode: "CALLER_AUTHORED_REASON",
          missingEvidenceCheck,
        },
      }).success,
    ).toBe(false);
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "UNCONFIRMABLE",
        evidence: {
          reasonCode: "DAILY_QUOTES_HAVE_NO_TIME_OF_DAY",
          missing: "The trades prove illegal market manipulation",
          wouldSettle: "Minute-level data",
          missingEvidenceCheck,
        },
      }).success,
    ).toBe(false);
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "UNCONFIRMABLE",
        evidence: {
          reasonCode: "DAILY_QUOTES_HAVE_NO_TIME_OF_DAY",
          missingEvidenceCheck: {
            ...missingEvidenceCheck,
            checkVersion: "daily",
          },
        },
      }).success,
    ).toBe(false);
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "UNCONFIRMABLE",
        evidence: {
          reasonCode: "DAILY_QUOTES_HAVE_NO_TIME_OF_DAY",
        },
      }).success,
    ).toBe(false);
  });

  it("requires a proposal reference only for model-authored interpretation", () => {
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "INTERPRETATION",
        evidence: { basis: "MODEL_AUTHORED", proposalRef: "proposal-1" },
      }).success,
    ).toBe(true);
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "INTERPRETATION",
        evidence: { basis: "MODEL_AUTHORED" },
      }).success,
    ).toBe(false);
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "INTERPRETATION",
        evidence: { basis: "NOT_A_DATA_QUESTION" },
      }).success,
    ).toBe(true);
  });

  it("prevents one sentence ID from receiving two grades", () => {
    const computed = EvidenceGradedSentenceSchema.parse({
      ...base,
      grade: "COMPUTED",
      evidence: computedEvidence,
    });
    const interpreted = EvidenceGradedSentenceSchema.parse({
      ...base,
      grade: "INTERPRETATION",
      evidence: { basis: "NOT_A_DATA_QUESTION" },
    });
    expect(
      EvidenceGradedPageSchema.safeParse({
        evidenceVersion: "1.0",
        sentences: [computed, interpreted],
      }).success,
    ).toBe(false);
  });
});
