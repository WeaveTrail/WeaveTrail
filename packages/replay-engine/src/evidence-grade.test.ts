import { describe, expect, it } from "vitest";

import {
  CalculatedEvidenceVerificationError,
  MissingEvidenceVerificationError,
  QuotedEvidenceVerificationError,
  verifyCalculatedEvidence,
  verifyQuotedEvidence,
  verifyUnconfirmableEvidence,
} from "./evidence-grade";
import { sha256Canonical } from "./canonical-hash";
import {
  deriveRawRowHash,
  sourceArtifactHash,
  type SourceRow,
} from "./source-ingest";

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
              displayedValueRange: { start: 0, end: 7 },
              calculation: {
                calculationId: "daily-close",
                calculationVersion: "1.0.0",
                displayTemplateId: "english-daily-close",
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

const sourceRow: SourceRow = {
  coordinate: {
    sourceArtifactHash: "a".repeat(64),
    rowNumber: "2",
  },
  values: { close: "1032.82" },
};
const rowHash = deriveRawRowHash(sourceRow);
const trustedRows = [
  {
    eventId: "event-1",
    sourceRow,
  },
] as const;
const closePrefix = "The close was ";
const displayTemplates = new Map([
  [
    "english-daily-close",
    ({ reportedValue }: { reportedValue: string }) => ({
      text: `${closePrefix}${reportedValue}.`,
      displayedValueRange: {
        start: closePrefix.length,
        end: closePrefix.length + reportedValue.length,
      },
    }),
  ],
]);
const registeredCalculation = {
  calculationVersion: "1.0.0",
  sourceRows: trustedRows,
  calculate: (rows: readonly SourceRow[]) => rows[0]!.values.close!,
  displayTemplates,
};
const calculations = new Map([
  ["daily-close", new Map([["1.0.0", registeredCalculation]])],
]);

function calculatedDisplay(reportedValue: string) {
  return {
    text: `${closePrefix}${reportedValue}.`,
    displayedValueRange: {
      start: closePrefix.length,
      end: closePrefix.length + reportedValue.length,
    },
  };
}

function calculatedSentence(
  grade: "COMPUTED" | "DIFFERS",
  reportedValue: string,
  computedValue = "1032.82",
) {
  const display = calculatedDisplay(reportedValue);
  return {
    evidenceVersion: "1.0",
    sentenceId: "calculated-1",
    text: display.text,
    grade,
    evidence: {
      reportedValue,
      displayedValueRange: display.displayedValueRange,
      calculation: {
        calculationId: "daily-close",
        calculationVersion: "1.0.0",
        displayTemplateId: "english-daily-close",
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

  it("rejects a calculated value that is not the value in the sentence", () => {
    const candidate = calculatedSentence("COMPUTED", "1032.82");
    candidate.text = "0";
    candidate.evidence.displayedValueRange = { start: 0, end: 1 };
    expectCalculatedCode(
      () => verifyCalculatedEvidence(candidate, { calculations }),
      "CONTRACT_INVALID",
    );
  });

  it("rejects an unverified claim appended to a calculated sentence", () => {
    const candidate = calculatedSentence("COMPUTED", "1032.82");
    candidate.text = "The close was 1032.82 and volume was 999999.";
    expectCalculatedCode(
      () => verifyCalculatedEvidence(candidate, { calculations }),
      "DISPLAY_TEMPLATE_MISMATCH",
    );
  });

  it("rejects changed source-row content that retains an old hash label", () => {
    const candidate = calculatedSentence("COMPUTED", "999", "999");
    const changedSourceRow: SourceRow = {
      ...sourceRow,
      values: { close: "999" },
    };
    const changedRows = [
      {
        eventId: "event-1",
        sourceRow: changedSourceRow,
      },
    ] as const;
    const changedCalculations = new Map([
      [
        "daily-close",
        new Map([
          [
            "1.0.0",
            {
              calculationVersion: "1.0.0",
              sourceRows: changedRows,
              calculate: (rows: readonly SourceRow[]) => rows[0]!.values.close!,
              displayTemplates,
            },
          ],
        ]),
      ],
    ]);

    expectCalculatedCode(
      () =>
        verifyCalculatedEvidence(candidate, {
          calculations: changedCalculations,
        }),
      "SOURCE_ROWS_MISMATCH",
    );
  });

  it("rejects unregistered calculations and altered source selections", () => {
    const unregistered = calculatedSentence("COMPUTED", "1032.82");
    unregistered.evidence.calculation.calculationId = "unknown";
    expectCalculatedCode(
      () =>
        verifyCalculatedEvidence(unregistered, {
          calculations,
        }),
      "CALCULATION_NOT_REGISTERED",
    );

    const wrongVersion = calculatedSentence("COMPUTED", "1032.82");
    wrongVersion.evidence.calculation.calculationVersion = "2.0.0";
    expectCalculatedCode(
      () => verifyCalculatedEvidence(wrongVersion, { calculations }),
      "CALCULATION_VERSION_MISMATCH",
    );

    const unknownTemplate = calculatedSentence("COMPUTED", "1032.82");
    unknownTemplate.evidence.calculation.displayTemplateId = "unknown";
    expectCalculatedCode(
      () => verifyCalculatedEvidence(unknownTemplate, { calculations }),
      "DISPLAY_TEMPLATE_NOT_REGISTERED",
    );

    const mismatchedRows = calculatedSentence("COMPUTED", "1032.82");
    mismatchedRows.evidence.calculation.sourceRows[0]!.eventId = "event-2";
    expectCalculatedCode(
      () => verifyCalculatedEvidence(mismatchedRows, { calculations }),
      "SOURCE_ROWS_MISMATCH",
    );
  });

  it("retains and resolves historical calculation versions independently", () => {
    const versionedCalculations = new Map([
      [
        "daily-close",
        new Map([
          ["1.0.0", registeredCalculation],
          [
            "2.0.0",
            {
              ...registeredCalculation,
              calculationVersion: "2.0.0",
            },
          ],
        ]),
      ],
    ]);

    expect(versionedCalculations.get("daily-close")?.size).toBe(2);
    expect(
      verifyCalculatedEvidence(calculatedSentence("COMPUTED", "1032.82"), {
        calculations: versionedCalculations,
      }),
    ).toMatchObject({
      grade: "COMPUTED",
      evidence: { calculation: { calculationVersion: "1.0.0" } },
    });
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

const datasetHash = sha256Canonical({ granularity: "daily" });

function unconfirmableSentence() {
  return {
    evidenceVersion: "1.0",
    sentenceId: "unconfirmable-1",
    text: "Public quotes do not contain a time of day.",
    grade: "UNCONFIRMABLE",
    evidence: {
      reasonCode: "DAILY_QUOTES_HAVE_NO_TIME_OF_DAY",
      missingEvidenceCheck: {
        checkId: "daily-quote-time-of-day",
        checkVersion: "1.0.0",
        approvedDatasetHash: datasetHash,
      },
    },
  };
}

function missingChecks(granularity: "daily" | "minute") {
  return new Map([
    [
      "daily-quote-time-of-day",
      new Map([
        [
          "1.0.0",
          {
            checkVersion: "1.0.0",
            reasonCode: "DAILY_QUOTES_HAVE_NO_TIME_OF_DAY" as const,
            dataset: { granularity },
            isMissing: (dataset: { granularity: "daily" | "minute" }) =>
              dataset.granularity === "daily",
          },
        ],
      ]),
    ],
  ]);
}

function expectMissingCode(run: () => unknown, code: string) {
  try {
    run();
    throw new Error("Expected missing-evidence verification to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(MissingEvidenceVerificationError);
    expect((error as MissingEvidenceVerificationError).code).toBe(code);
  }
}

describe("missing evidence verification", () => {
  it("reruns a registered absence check against its approved dataset", () => {
    expect(
      verifyUnconfirmableEvidence(unconfirmableSentence(), {
        checks: missingChecks("daily"),
      }),
    ).toMatchObject({ grade: "UNCONFIRMABLE" });
  });

  it("refuses UNCONFIRMABLE when the approved dataset has the evidence", () => {
    const candidate = unconfirmableSentence();
    candidate.evidence.missingEvidenceCheck.approvedDatasetHash =
      sha256Canonical({ granularity: "minute" });
    expectMissingCode(
      () =>
        verifyUnconfirmableEvidence(candidate, {
          checks: missingChecks("minute"),
        }),
      "EVIDENCE_AVAILABLE",
    );
  });

  it("rejects changed dataset content that retains an approved hash label", () => {
    const changedDataset = {
      granularity: "daily" as const,
      rows: [] as string[],
    };
    const checks = new Map([
      [
        "daily-quote-time-of-day",
        new Map([
          [
            "1.0.0",
            {
              checkVersion: "1.0.0",
              reasonCode: "DAILY_QUOTES_HAVE_NO_TIME_OF_DAY" as const,
              dataset: changedDataset,
              isMissing: (dataset: typeof changedDataset) =>
                dataset.granularity === "daily",
            },
          ],
        ]),
      ],
    ]);

    expectMissingCode(
      () =>
        verifyUnconfirmableEvidence<typeof changedDataset>(
          unconfirmableSentence(),
          { checks },
        ),
      "MISSING_EVIDENCE_CHECK_MISMATCH",
    );
  });

  it("rejects unregistered, reversioned, or rebound absence checks", () => {
    const unregistered = unconfirmableSentence();
    unregistered.evidence.missingEvidenceCheck.checkId = "unknown";
    expectMissingCode(
      () =>
        verifyUnconfirmableEvidence(unregistered, {
          checks: missingChecks("daily"),
        }),
      "MISSING_EVIDENCE_CHECK_NOT_REGISTERED",
    );

    for (const mutation of [
      { checkVersion: "2.0.0" },
      { approvedDatasetHash: "e".repeat(64) },
    ]) {
      const candidate = unconfirmableSentence();
      Object.assign(candidate.evidence.missingEvidenceCheck, mutation);
      expectMissingCode(
        () =>
          verifyUnconfirmableEvidence(candidate, {
            checks: missingChecks("daily"),
          }),
        "MISSING_EVIDENCE_CHECK_MISMATCH",
      );
    }
  });
});
