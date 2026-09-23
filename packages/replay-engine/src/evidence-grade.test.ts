import { describe, expect, it } from "vitest";

import {
  CalculatedEvidenceVerificationError,
  assertAuthenticatedEvidence,
  canonicalEvidenceEventHash,
  InterpretationEvidenceValidationError,
  MissingEvidenceVerificationError,
  QuotedEvidenceVerificationError,
  verifyCalculatedEvidence,
  verifyQuotedEvidence,
  verifyUnconfirmableEvidence,
  validateInterpretationEvidence,
} from "./evidence-grade";
import { sha256Canonical } from "./canonical-hash";
import {
  deriveEventId,
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

function quotationContext(bytes: Uint8Array = sourceBytes) {
  return {
    sourceArtifacts: new Map([[sourceArtifactHash(sourceBytes), bytes]]),
  };
}

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
    expect(
      verifyQuotedEvidence(quotedSentence(), quotationContext()),
    ).toMatchObject({ grade: "QUOTED", text: quote });
  });

  it("returns a deeply frozen verified quotation", () => {
    const verified = verifyQuotedEvidence(quotedSentence(), quotationContext());

    expect(Object.isFrozen(verified)).toBe(true);
    expect(Object.isFrozen(verified.evidence)).toBe(true);
    expect(Object.isFrozen(verified.evidence.byteRange)).toBe(true);
    expect(() =>
      Object.defineProperty(verified, "text", { value: "Changed text" }),
    ).toThrow(TypeError);
    expect(verified.text).toBe(quote);
  });

  it("authenticates only the original verifier result", () => {
    const verified = verifyQuotedEvidence(quotedSentence(), quotationContext());
    expect(() => assertAuthenticatedEvidence(verified)).not.toThrow();
    expect(() =>
      assertAuthenticatedEvidence({ ...verified, text: "Changed text" }),
    ).toThrow("Evidence sentence was not authenticated by a verifier.");
    expect(() =>
      assertAuthenticatedEvidence({
        ...verified,
        evidence: { ...verified.evidence },
      }),
    ).toThrow("Evidence sentence was not authenticated by a verifier.");
  });

  it("fails closed when the source artifact bytes change", () => {
    const changed = encoder.encode(sourceText.replace("꼬리말", "다른 꼬리말"));
    expectCode(
      () => verifyQuotedEvidence(quotedSentence(), quotationContext(changed)),
      "SOURCE_ARTIFACT_HASH_MISMATCH",
    );
  });

  it("fails closed when the span no longer names the exact display text", () => {
    const candidate = quotedSentence();
    candidate.evidence.byteRange.start += 1;
    expectCode(
      () => verifyQuotedEvidence(candidate, quotationContext()),
      "SOURCE_SPAN_TEXT_MISMATCH",
    );
  });

  it("rejects a range outside the artifact", () => {
    const candidate = quotedSentence();
    candidate.evidence.byteRange.end = sourceBytes.byteLength + 1;
    expectCode(
      () => verifyQuotedEvidence(candidate, quotationContext()),
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
                  {
                    eventId: "event-1",
                    rawRowHash: "a".repeat(64),
                    canonicalEventHash: "b".repeat(64),
                  },
                ],
                computedValue: "1032.82",
              },
            },
          },
          quotationContext(),
        ),
      "GRADE_NOT_QUOTED",
    );
  });

  it("does not trust caller-supplied bytes outside the artifact registry", () => {
    expectCode(
      () =>
        verifyQuotedEvidence(quotedSentence(), {
          sourceArtifacts: new Map(),
        }),
      "SOURCE_ARTIFACT_NOT_REGISTERED",
    );
  });
});

describe("interpretation evidence validation", () => {
  it("requires the model proposal audit reference", () => {
    const candidate = {
      evidenceVersion: "1.0",
      sentenceId: "interpretation-1",
      text: "This is a model-authored summary.",
      grade: "INTERPRETATION",
      evidence: { basis: "MODEL_AUTHORED" },
    };

    expect(() => validateInterpretationEvidence(candidate)).toThrow(
      InterpretationEvidenceValidationError,
    );
  });

  it("returns a frozen validated interpretation declaration", () => {
    const validated = validateInterpretationEvidence({
      evidenceVersion: "1.0",
      sentenceId: "interpretation-1",
      text: "This is a model-authored summary.",
      grade: "INTERPRETATION",
      evidence: { basis: "MODEL_AUTHORED", proposalRef: "proposal-1" },
    });

    expect(validated).toMatchObject({ grade: "INTERPRETATION" });
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.evidence)).toBe(true);
  });
});

const sourceRow: SourceRow = {
  coordinate: {
    sourceArtifactHash: "a".repeat(64),
    rowNumber: "2",
  },
  values: { close: "1032.82", reportedClose: "1031.5" },
};
const rowHash = deriveRawRowHash(sourceRow);
const eventId = deriveEventId({
  datasetId: "dataset-1",
  venueId: "venue-1",
  sourceEventId: "source-1",
});
const canonicalEvent = {
  schemaVersion: "1.1",
  eventId,
  sourceEventId: "source-1",
  datasetId: "dataset-1",
  venueId: "venue-1",
  eventTime: "2026-09-03T00:00:00Z",
  instrumentId: "instrument-1",
  eventType: "TRADE",
  rawRowHash: rowHash,
} as const;
const eventHash = canonicalEvidenceEventHash(canonicalEvent);
const trustedRows = [
  {
    event: canonicalEvent,
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
  reportedValueFromSourceRows: (rows: readonly SourceRow[]) =>
    rows[0]!.values.reportedClose!,
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
        sourceRows: [
          { eventId, rawRowHash: rowHash, canonicalEventHash: eventHash },
        ],
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

  it("returns a deeply frozen verified calculation", () => {
    const verified = verifyCalculatedEvidence(
      calculatedSentence("COMPUTED", "1032.82"),
      { calculations },
    );

    expect(Object.isFrozen(verified)).toBe(true);
    expect(Object.isFrozen(verified.evidence)).toBe(true);
    expect(Object.isFrozen(verified.evidence.calculation)).toBe(true);
    expect(Object.isFrozen(verified.evidence.calculation.sourceRows)).toBe(
      true,
    );
    expect(() =>
      Object.defineProperty(verified, "grade", { value: "DIFFERS" }),
    ).toThrow(TypeError);
    expect(verified.grade).toBe("COMPUTED");
  });

  it("calculates with canonical event order instead of registry insertion order", () => {
    const laterSourceRow: SourceRow = {
      coordinate: {
        sourceArtifactHash: "a".repeat(64),
        rowNumber: "3",
      },
      values: { close: "999" },
    };
    const laterEventId = deriveEventId({
      datasetId: "dataset-1",
      venueId: "venue-1",
      sourceEventId: "source-2",
    });
    const laterEvent = {
      ...canonicalEvent,
      eventId: laterEventId,
      sourceEventId: "source-2",
      eventTime: "2026-09-03T00:01:00Z",
      rawRowHash: deriveRawRowHash(laterSourceRow),
    };
    const outOfOrderCalculations = new Map([
      [
        "daily-close",
        new Map([
          [
            "1.0.0",
            {
              ...registeredCalculation,
              sourceRows: [
                { event: laterEvent, sourceRow: laterSourceRow },
                trustedRows[0],
              ],
              calculate: (rows: readonly SourceRow[]) => rows[0]!.values.close!,
            },
          ],
        ]),
      ],
    ]);
    const candidate = calculatedSentence("COMPUTED", "1032.82");
    candidate.evidence.calculation.sourceRows.push({
      eventId: laterEventId,
      rawRowHash: deriveRawRowHash(laterSourceRow),
      canonicalEventHash: canonicalEvidenceEventHash(laterEvent),
    });

    expect(
      verifyCalculatedEvidence(candidate, {
        calculations: outOfOrderCalculations,
      }),
    ).toMatchObject({ grade: "COMPUTED" });
  });

  it("rejects changed event ordering fields under the same row identity", () => {
    const changedOrderingCalculations = new Map([
      [
        "daily-close",
        new Map([
          [
            "1.0.0",
            {
              ...registeredCalculation,
              sourceRows: [
                {
                  event: {
                    ...canonicalEvent,
                    eventTime: "2026-09-03T00:02:00Z",
                    sequence: "2",
                  },
                  sourceRow,
                },
              ],
            },
          ],
        ]),
      ],
    ]);

    expectCalculatedCode(
      () =>
        verifyCalculatedEvidence(calculatedSentence("COMPUTED", "1032.82"), {
          calculations: changedOrderingCalculations,
        }),
      "SOURCE_ROWS_MISMATCH",
    );
  });

  it("rejects calculation inputs with mixed sequence presence", () => {
    const secondSourceRow: SourceRow = {
      coordinate: {
        sourceArtifactHash: "a".repeat(64),
        rowNumber: "3",
      },
      values: { close: "999" },
    };
    const secondEventId = deriveEventId({
      datasetId: "dataset-1",
      venueId: "venue-1",
      sourceEventId: "source-2",
    });
    const secondEvent = {
      ...canonicalEvent,
      eventId: secondEventId,
      sourceEventId: "source-2",
      eventTime: "2026-09-03T00:01:00Z",
      sequence: "2",
      rawRowHash: deriveRawRowHash(secondSourceRow),
    };
    const mixedSequenceCalculations = new Map([
      [
        "daily-close",
        new Map([
          [
            "1.0.0",
            {
              ...registeredCalculation,
              sourceRows: [
                trustedRows[0],
                { event: secondEvent, sourceRow: secondSourceRow },
              ],
            },
          ],
        ]),
      ],
    ]);
    const candidate = calculatedSentence("COMPUTED", "1032.82");
    candidate.evidence.calculation.sourceRows.push({
      eventId: secondEventId,
      rawRowHash: deriveRawRowHash(secondSourceRow),
      canonicalEventHash: canonicalEvidenceEventHash(secondEvent),
    });

    expectCalculatedCode(
      () =>
        verifyCalculatedEvidence(candidate, {
          calculations: mixedSequenceCalculations,
        }),
      "SOURCE_ROWS_MISMATCH",
    );
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
        event: canonicalEvent,
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

  it("rejects a registered event ID that is rebound to another source row", () => {
    const reboundRows = [
      {
        event: { ...canonicalEvent, eventId: "event-rebound" },
        sourceRow,
      },
    ] as const;
    const reboundCalculations = new Map([
      [
        "daily-close",
        new Map([
          ["1.0.0", { ...registeredCalculation, sourceRows: reboundRows }],
        ]),
      ],
    ]);
    const candidate = calculatedSentence("COMPUTED", "1032.82");
    candidate.evidence.calculation.sourceRows[0]!.eventId = "event-rebound";

    expectCalculatedCode(
      () =>
        verifyCalculatedEvidence(candidate, {
          calculations: reboundCalculations,
        }),
      "SOURCE_ROWS_MISMATCH",
    );
  });

  it("rejects duplicate registered source coordinates under distinct event IDs", () => {
    const secondEventId = deriveEventId({
      datasetId: "dataset-1",
      venueId: "venue-1",
      sourceEventId: "source-2",
    });
    const duplicateRows = [
      { event: canonicalEvent, sourceRow },
      {
        event: {
          ...canonicalEvent,
          eventId: secondEventId,
          sourceEventId: "source-2",
        },
        sourceRow,
      },
    ] as const;
    const duplicateCalculations = new Map([
      [
        "daily-close",
        new Map([
          ["1.0.0", { ...registeredCalculation, sourceRows: duplicateRows }],
        ]),
      ],
    ]);
    const candidate = calculatedSentence("COMPUTED", "1032.82");
    candidate.evidence.calculation.sourceRows.push({
      eventId: secondEventId,
      rawRowHash: rowHash,
      canonicalEventHash: canonicalEvidenceEventHash(duplicateRows[1]!.event),
    });

    expectCalculatedCode(
      () =>
        verifyCalculatedEvidence(candidate, {
          calculations: duplicateCalculations,
        }),
      "SOURCE_ROWS_MISMATCH",
    );
  });

  it("rejects padded row numbers before source-coordinate deduplication", () => {
    const paddedSourceRow: SourceRow = {
      ...sourceRow,
      coordinate: { ...sourceRow.coordinate, rowNumber: "02" },
    };
    const paddedRowHash = deriveRawRowHash(paddedSourceRow);
    const secondEventId = deriveEventId({
      datasetId: "dataset-1",
      venueId: "venue-1",
      sourceEventId: "source-2",
    });
    const paddedRows = [
      { event: canonicalEvent, sourceRow },
      {
        event: {
          ...canonicalEvent,
          eventId: secondEventId,
          sourceEventId: "source-2",
          eventTime: "2026-09-03T00:01:00Z",
          rawRowHash: paddedRowHash,
        },
        sourceRow: paddedSourceRow,
      },
    ] as const;
    const paddedCalculations = new Map([
      [
        "daily-close",
        new Map([
          [
            "1.0.0",
            {
              ...registeredCalculation,
              sourceRows: paddedRows,
              calculate: (rows: readonly SourceRow[]) => String(rows.length),
            },
          ],
        ]),
      ],
    ]);
    const candidate = calculatedSentence("COMPUTED", "2", "2");
    candidate.evidence.calculation.sourceRows.push({
      eventId: secondEventId,
      rawRowHash: paddedRowHash,
      canonicalEventHash: canonicalEvidenceEventHash(paddedRows[1]!.event),
    });

    expectCalculatedCode(
      () =>
        verifyCalculatedEvidence(candidate, {
          calculations: paddedCalculations,
        }),
      "SOURCE_ROWS_MISMATCH",
    );
  });

  it("does not let a calculator mutate authenticated source rows", () => {
    const mutableRow: SourceRow = structuredClone(sourceRow);
    const mutatingCalculations = new Map([
      [
        "daily-close",
        new Map([
          [
            "1.0.0",
            {
              ...registeredCalculation,
              sourceRows: [{ event: canonicalEvent, sourceRow: mutableRow }],
              calculate: (rows: readonly SourceRow[]) => {
                rows[0]!.values.close = "999";
                return rows[0]!.values.close!;
              },
            },
          ],
        ]),
      ],
    ]);
    const candidate = calculatedSentence("COMPUTED", "999", "999");
    candidate.evidence.calculation.sourceRows[0]!.rawRowHash =
      deriveRawRowHash(mutableRow);

    expectCalculatedCode(
      () =>
        verifyCalculatedEvidence(candidate, {
          calculations: mutatingCalculations,
        }),
      "CALCULATION_FAILED",
    );
  });

  it("rejects a DIFFERS value that no trusted source row reported", () => {
    expectCalculatedCode(
      () =>
        verifyCalculatedEvidence(calculatedSentence("DIFFERS", "999"), {
          calculations,
        }),
      "REPORTED_VALUE_MISMATCH",
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
        displayTemplateId: "english-daily-quote-time-of-day",
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
            canonicalDatasetForHash: (dataset: {
              granularity: "daily" | "minute";
            }) => dataset,
            isMissing: (dataset: { granularity: "daily" | "minute" }) =>
              dataset.granularity === "daily",
            displayTemplates: new Map([
              [
                "english-daily-quote-time-of-day",
                () => "Public quotes do not contain a time of day.",
              ],
            ]),
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

  it("excludes volatile metadata through the versioned hash projection", () => {
    const dataset = {
      granularity: "daily" as const,
      receivedAt: "2026-09-22T00:00:00Z",
      runId: "run-later",
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
              dataset,
              canonicalDatasetForHash: (input: typeof dataset) => ({
                granularity: input.granularity,
              }),
              isMissing: (input: typeof dataset) =>
                input.granularity === "daily",
              displayTemplates: new Map([
                [
                  "english-daily-quote-time-of-day",
                  () => "Public quotes do not contain a time of day.",
                ],
              ]),
            },
          ],
        ]),
      ],
    ]);

    expect(
      verifyUnconfirmableEvidence(unconfirmableSentence(), { checks }),
    ).toMatchObject({ grade: "UNCONFIRMABLE" });
  });

  it("returns a deeply frozen verified absence declaration", () => {
    const verified = verifyUnconfirmableEvidence(unconfirmableSentence(), {
      checks: missingChecks("daily"),
    });

    expect(Object.isFrozen(verified)).toBe(true);
    expect(Object.isFrozen(verified.evidence)).toBe(true);
    expect(Object.isFrozen(verified.evidence.missingEvidenceCheck)).toBe(true);
    expect(() =>
      Object.defineProperty(verified.evidence, "reasonCode", {
        value: "CHANGED",
      }),
    ).toThrow(TypeError);
    expect(verified.evidence.reasonCode).toBe(
      "DAILY_QUOTES_HAVE_NO_TIME_OF_DAY",
    );
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
              canonicalDatasetForHash: (dataset: typeof changedDataset) =>
                dataset,
              isMissing: (dataset: typeof changedDataset) =>
                dataset.granularity === "daily",
              displayTemplates: new Map([
                [
                  "english-daily-quote-time-of-day",
                  () => "Public quotes do not contain a time of day.",
                ],
              ]),
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

  it("does not let an absence check remove evidence from its authenticated dataset", () => {
    const dataset = { granularity: "minute" as const, rows: ["09:00"] };
    const candidate = unconfirmableSentence();
    candidate.evidence.missingEvidenceCheck.approvedDatasetHash =
      sha256Canonical(dataset);
    const checks = new Map([
      [
        "daily-quote-time-of-day",
        new Map([
          [
            "1.0.0",
            {
              checkVersion: "1.0.0",
              reasonCode: "DAILY_QUOTES_HAVE_NO_TIME_OF_DAY" as const,
              dataset,
              canonicalDatasetForHash: (input: typeof dataset) => input,
              isMissing: (input: typeof dataset) => {
                input.rows.splice(0);
                return input.rows.length === 0;
              },
              displayTemplates: new Map([
                [
                  "english-daily-quote-time-of-day",
                  () => "Public quotes do not contain a time of day.",
                ],
              ]),
            },
          ],
        ]),
      ],
    ]);

    expectMissingCode(
      () => verifyUnconfirmableEvidence(candidate, { checks }),
      "MISSING_EVIDENCE_CHECK_FAILED",
    );
  });

  it("rejects a displayed claim unrelated to the registered absence check", () => {
    const candidate = unconfirmableSentence();
    candidate.text = "The close was 0.";

    expectMissingCode(
      () =>
        verifyUnconfirmableEvidence(candidate, {
          checks: missingChecks("daily"),
        }),
      "DISPLAY_TEMPLATE_MISMATCH",
    );
  });
});
