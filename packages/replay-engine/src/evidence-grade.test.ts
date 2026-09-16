import { describe, expect, it } from "vitest";

import {
  QuotedEvidenceVerificationError,
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
              calculationRef: "daily-close@1.0.0",
              sourceRows: [{ eventId: "event-1", rawRowHash: "a".repeat(64) }],
              computedValue: "1032.82",
            },
          },
          sourceBytes,
        ),
      "GRADE_NOT_QUOTED",
    );
  });
});
