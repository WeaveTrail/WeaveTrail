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
  calculationRef: "daily-close@1.0.0",
  sourceRows: [{ eventId: "event-1", rawRowHash: hash }],
  computedValue: "1032.82",
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
        evidence: calculation,
      }).success,
    ).toBe(true);
    for (const evidence of [
      { ...calculation, calculationRef: "" },
      { ...calculation, sourceRows: [] },
    ])
      expect(
        EvidenceGradedSentenceSchema.safeParse({
          ...base,
          grade: "COMPUTED",
          evidence,
        }).success,
      ).toBe(false);
  });

  it("attaches the different recomputed value and rejects equal decimals", () => {
    expect(
      EvidenceGradedSentenceSchema.parse({
        ...base,
        grade: "DIFFERS",
        evidence: { reportedValue: "1031.5", calculation },
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
          reportedValue: "1032.820",
          calculation: { ...calculation, computedValue: "1032.82" },
        },
      }).success,
    ).toBe(false);
  });

  it("requires both localized reason fields for unconfirmable text", () => {
    const missing = {
      ko: "공개 시세는 하루 단위라 시각이 없습니다",
      en: "Public quotes are daily, so there is no time of day",
    };
    const wouldSettle = {
      ko: "분 단위 자료가 연결되면",
      en: "Minute-level data",
    };
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "UNCONFIRMABLE",
        evidence: { missing, wouldSettle },
      }).success,
    ).toBe(true);
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "UNCONFIRMABLE",
        evidence: { missing },
      }).success,
    ).toBe(false);
    expect(
      EvidenceGradedSentenceSchema.safeParse({
        ...base,
        grade: "UNCONFIRMABLE",
        evidence: {
          missing: { ...missing, ko: "자료 오류" },
          wouldSettle,
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
      evidence: calculation,
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
