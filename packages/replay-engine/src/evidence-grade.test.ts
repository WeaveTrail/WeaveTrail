import { describe, expect, it } from "vitest";

import {
  CalculatedEvidenceVerificationError,
  QuotedEvidenceVerificationError,
  verifyCalculatedEvidence,
  verifyQuotedEvidence,
} from "./evidence-grade";
import { sourceArtifactHash } from "./source-ingest";

const encoder = new TextEncoder();
const sourceText = "머리말\n원문 해당 구간과 글자 그대로 같습니다.\n꼬리말";
const sourceBytes = encoder.encode(sourceText);
const quote = "원문 해당 구간과 글자 그대로 같습니다.";
const prefixBytes = encoder.encode("머리말\n");
const quoteBytes = encoder.encode(quote);

function quotedSentence() {
  return {
    evidenceVersion: "1.0",
    sentenceId: "quoted-1",
    text: quote,
    grade: "QUOTED",
    evidence: {
      sourceArtifactHash: sourceArtifactHash(sourceBytes),
      byteRange: {
        start: prefixBytes.byteLength,
        end: prefixBytes.byteLength + quoteBytes.byteLength,
      },
    },
  };
}

function expectCode(run: () => unknown, code: string) {
  try {
    run();
    throw new Error("Expected quotation verification to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(QuotedEvidenceVerificationError);
    expect((error as QuotedEvidenceVerificationError).code).toBe(code);
  }
}

describe("quoted evidence verification", () => {
  it("re-matches a Unicode sentence by byte offsets", () => {
    expect(verifyQuotedEvidence(quotedSentence(), sourceBytes)).toMatchObject({
      grade: "QUOTED",
      text: quote,
    });
  });

  it("fails closed when the source artifact bytes change", () => {
    const changed = encoder.encode(sourceText.replace("꼬리말", "다른 꼬리말"));
    expectCode(
      () => verifyQuotedEvidence(quotedSentence(), changed),
      "SOURCE_ARTIFACT_HASH_MISMATCH",
    );
  });

  it("fails closed when the span no longer names the exact display text", () => {
    const candidate = quotedSentence();
    candidate.evidence.byteRange.start += 1;
    expectCode(
      () => verifyQuotedEvidence(candidate, sourceBytes),
      "SOURCE_SPAN_TEXT_MISMATCH",
    );
  });

  it("rejects a range outside the artifact", () => {
    const candidate = quotedSentence();
    candidate.evidence.byteRange.end = sourceBytes.byteLength + 1;
    expectCode(
      () => verifyQuotedEvidence(candidate, sourceBytes),
      "SOURCE_SPAN_OUT_OF_BOUNDS",
    );
  });

  it("does not byte-verify another grade", () => {
    expectCode(
      () =>
        verifyQuotedEvidence(
          {
            evidenceVersion: "1.0",
            sentenceId: "computed-1",
            text: "1032.82",
            grade: "COMPUTED",
            evidence: {
              reportedValue: "1032.82",
              calculation: {
                calculationRef: "daily-close@1.0.0",
                sourceRows: [
                  { eventId: "event-1", rawRowHash: "a".repeat(64) },
                ],
                computedValue: "1032.82",
              },
            },
          },
          sourceBytes,
        ),
      "GRADE_NOT_QUOTED",
    );
  });
});

const rowHash = "b".repeat(64);
const trustedRows = [
  {
    eventId: "event-1",
    rawRowHash: rowHash,
    row: { close: "1032.82" },
  },
] as const;
const calculations = new Map([
  [
    "daily-close@1.0.0",
    {
      sourceRows: trustedRows,
      calculate: (rows: readonly { close: string }[]) => rows[0]!.close,
    },
  ],
]);

function calculatedSentence(
  grade: "COMPUTED" | "DIFFERS",
  reportedValue: string,
  computedValue = "1032.82",
) {
  return {
    evidenceVersion: "1.0",
    sentenceId: "calculated-1",
    text: reportedValue,
    grade,
    evidence: {
      reportedValue,
      calculation: {
        calculationRef: "daily-close@1.0.0",
        sourceRows: [{ eventId: "event-1", rawRowHash: rowHash }],
        computedValue,
      },
    },
  };
}

function expectCalculatedCode(run: () => unknown, code: string) {
  try {
    run();
    throw new Error("Expected calculation verification to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(CalculatedEvidenceVerificationError);
    expect((error as CalculatedEvidenceVerificationError).code).toBe(code);
  }
}

describe("calculated evidence verification", () => {
  it("reruns a registered calculation before granting COMPUTED", () => {
    expect(
      verifyCalculatedEvidence(calculatedSentence("COMPUTED", "1032.82"), {
        calculations,
      }),
    ).toMatchObject({ grade: "COMPUTED" });
  });

  it("reruns the same calculation before granting DIFFERS", () => {
    expect(
      verifyCalculatedEvidence(calculatedSentence("DIFFERS", "1031.5"), {
        calculations,
      }),
    ).toMatchObject({ grade: "DIFFERS" });
  });

  it("rejects a fabricated computed value", () => {
    expectCalculatedCode(
      () =>
        verifyCalculatedEvidence(
          calculatedSentence("DIFFERS", "1031.5", "1040"),
          { calculations },
        ),
      "COMPUTED_VALUE_MISMATCH",
    );
  });

  it("rejects unregistered calculations and altered source selections", () => {
    const unregistered = calculatedSentence("COMPUTED", "1032.82");
    unregistered.evidence.calculation.calculationRef = "unknown@1.0.0";
    expectCalculatedCode(
      () =>
        verifyCalculatedEvidence(unregistered, {
          calculations,
        }),
      "CALCULATION_NOT_REGISTERED",
    );

    const mismatchedRows = calculatedSentence("COMPUTED", "1032.82");
    mismatchedRows.evidence.calculation.sourceRows[0]!.eventId = "event-2";
    expectCalculatedCode(
      () => verifyCalculatedEvidence(mismatchedRows, { calculations }),
      "SOURCE_ROWS_MISMATCH",
    );
  });

  it("rejects a declared row hash outside the registered calculation", () => {
    const mismatchedRows = calculatedSentence("COMPUTED", "1032.82");
    mismatchedRows.evidence.calculation.sourceRows[0]!.rawRowHash = "c".repeat(
      64,
    );
    expectCalculatedCode(
      () => verifyCalculatedEvidence(mismatchedRows, { calculations }),
      "SOURCE_ROWS_MISMATCH",
    );
  });
});
