import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CaseManifestV14Schema,
  CaseManifestV14ProposalSchema,
  type CaseManifestV14,
  type TradeEvent,
} from "@weavetrail/contracts";
import { crossMarketSessionReversalSpecimens } from "@weavetrail/scenarios";

import { computeDatasetProfile } from "./dataset-profile";
import { caseManifestProposal } from "./approval-validation";
import { sha256Canonical } from "./canonical-hash";
import {
  CrossMarketRuleError,
  evaluateCrossMarketSessionReversal,
  replayCrossMarketSessionReversal,
} from "./cross-market-session-reversal";

function manifest(
  events: readonly TradeEvent[],
  overrides: Partial<
    Extract<
      CaseManifestV14["rules"][number],
      { ruleId: "CROSS_MARKET_SESSION_REVERSAL" }
    >["parameters"]
  > = {},
): CaseManifestV14 {
  const profile = computeDatasetProfile(events);
  const proposal = CaseManifestV14ProposalSchema.parse({
    manifestVersion: "1.4",
    caseId: "cross-market-session-reversal-test",
    canonicalDatasetHash: profile.canonicalDatasetHash,
    hypothesis: {
      pattern: "CROSS_MARKET_SESSION_REVERSAL",
      instrumentIds: ["SYNTH-PRIMARY", "SYNTH-CONFIRMING"],
      actorIds: [],
      startTime: profile.earliestEventTime,
      endTime: profile.latestEventTime,
    },
    rules: [
      {
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        ruleVersion: "1.0",
        parameters: {
          analysedDate: "2026-09-02",
          baselineRange: {
            startDate: "2026-08-31",
            endDateInclusive: "2026-09-02",
          },
          baselineLegId: "primary",
          legs: [
            {
              legId: "primary",
              instrumentId: "SYNTH-PRIMARY",
              minimumReversalMultiple: "5",
            },
            {
              legId: "confirming",
              instrumentId: "SYNTH-CONFIRMING",
              minimumReversalMultiple: "5",
            },
          ],
          maximumBaselineRank: "1",
          minimumAgreeingLegs: "2",
          ...overrides,
        },
      },
    ],
    aiTrace: {
      provider: "fixture",
      model: "deterministic",
      promptVersion: "cross-market-session-reversal-v1",
      confidence: 1,
      referencedEventIds: [],
    },
  });
  return CaseManifestV14Schema.parse({
    ...proposal,
    approval: {
      approvedArtifactHash: sha256Canonical(proposal),
      reviewerRef: "test-reviewer",
      decision: "APPROVED",
      overrides: [],
      approvedAt: "2026-09-07T00:00:00Z",
    },
  });
}

function sensitivityManifest(
  events: readonly TradeEvent[],
  approvedDenominatorId:
    "published-net-change" | "minimum-price-increment" = "published-net-change",
  alternativeField?: "price",
): CaseManifestV14 {
  const configured = manifest(events);
  const legacyRule = configured.rules[0]!;
  if (
    legacyRule.ruleId !== "CROSS_MARKET_SESSION_REVERSAL" ||
    legacyRule.ruleVersion !== "1.0"
  ) {
    throw new Error("Expected cross-market 1.0 fixture");
  }
  const proposal = CaseManifestV14ProposalSchema.parse({
    ...caseManifestProposal(configured),
    rules: [
      {
        ...legacyRule,
        ruleVersion: "1.1",
        parameters: {
          ...legacyRule.parameters,
          legs: legacyRule.parameters.legs.map((leg) => ({
            ...leg,
            approvedDenominatorId,
            denominators: [
              {
                denominatorId: "published-net-change",
                meaning: "OBSERVED_PRICE_CHANGE",
                source: { kind: "EVENT_FIELD", field: "netChange" },
              },
              alternativeField === undefined
                ? {
                    denominatorId: "minimum-price-increment",
                    meaning:
                      "INSTRUMENT_MINIMUM_PRICE_INCREMENT_NOT_TRADE_ESTABLISHED_LEVEL",
                    source: {
                      kind: "DECLARED_VALUE",
                      value: "0.5",
                      provenance: "Synthetic instrument specification fixture.",
                    },
                  }
                : {
                    denominatorId: "minimum-price-increment",
                    meaning: "OBSERVED_PRICE_LEVEL",
                    source: { kind: "EVENT_FIELD", field: alternativeField },
                  },
              {
                denominatorId: "published-open",
                meaning: "OBSERVED_PRICE_LEVEL",
                source: { kind: "EVENT_FIELD", field: "openPrice" },
              },
            ],
          })),
        },
      },
    ],
  });
  return CaseManifestV14Schema.parse({
    ...proposal,
    approval: {
      approvedArtifactHash: sha256Canonical(proposal),
      reviewerRef: "test-reviewer",
      decision: "APPROVED",
      overrides: [],
      approvedAt: "2026-09-07T00:00:00Z",
    },
  });
}

describe("cross-market session reversal", () => {
  it.each([
    ["supported", "SUPPORTED"],
    ["notSupported", "NOT_SUPPORTED"],
    ["inconclusive", "INCONCLUSIVE"],
  ] as const)(
    "reaches %s using a committed synthetic specimen",
    (name, result) => {
      const specimen = crossMarketSessionReversalSpecimens[name];
      expect(
        evaluateCrossMarketSessionReversal(
          specimen.events,
          manifest(specimen.events),
        ).result,
      ).toBe(result);
    },
  );

  it("reports every declared denominator as a neutral mechanical recomputation", () => {
    const specimen = crossMarketSessionReversalSpecimens.supported;
    const result = evaluateCrossMarketSessionReversal(
      specimen.events,
      sensitivityManifest(specimen.events),
    );
    expect(result).toMatchObject({
      ruleVersion: "1.1",
      result: "SUPPORTED",
      analysis: {
        legs: expect.arrayContaining([
          expect.objectContaining({
            legId: "primary",
            approvedDenominatorId: "published-net-change",
            approvedDenominatorValue: "1",
            reversalMultiple: "10",
          }),
        ]),
      },
      sensitivity: {
        comparison: "MECHANICAL_METRIC_COMPARISON",
        interpretation: "MECHANICAL_RECOMPUTATION_NOT_CAUSAL_CONCLUSION",
        legs: expect.arrayContaining([
          {
            legId: "primary",
            instrumentId: "SYNTH-PRIMARY",
            eventId: "event:synthetic-cross-market-v1:SYNTH:primary-2026-09-02",
            approved: expect.objectContaining({
              denominatorId: "published-net-change",
              denominatorValue: "1",
              metricValue: "10",
            }),
            alternatives: expect.arrayContaining([
              expect.objectContaining({
                denominatorId: "minimum-price-increment",
                denominatorValue: "0.5",
                meaning:
                  "INSTRUMENT_MINIMUM_PRICE_INCREMENT_NOT_TRADE_ESTABLISHED_LEVEL",
                metricValue: "20",
                ratioToApprovedMetric: "2",
              }),
              expect.objectContaining({
                denominatorId: "published-open",
                denominatorValue: "105",
                metricValue: "0.0952",
                ratioToApprovedMetric: "0.0095",
              }),
            ]),
          },
          expect.objectContaining({ legId: "confirming" }),
        ]),
      },
    });
  });

  it("derives zero-ratio handling from the rendered metric values", () => {
    const events = crossMarketSessionReversalSpecimens.supported.events.map(
      (event) =>
        event.tradingDate === "2026-09-02"
          ? {
              ...event,
              openPrice: "100",
              highPrice: "100",
              lowPrice: "99.998",
              closePrice: "99.999",
              netChange: "100",
            }
          : event,
    );
    expect(
      evaluateCrossMarketSessionReversal(events, sensitivityManifest(events)),
    ).toMatchObject({
      result: "NOT_SUPPORTED",
      sensitivity: {
        legs: expect.arrayContaining([
          expect.objectContaining({
            approved: expect.objectContaining({ metricValue: "0" }),
            alternatives: expect.arrayContaining([
              expect.objectContaining({
                denominatorId: "published-open",
                metricValue: "0",
                ratioToApprovedMetric: null,
                ratioUnavailableReason: "BOTH_METRICS_ZERO",
              }),
            ]),
          }),
        ]),
      },
    });
  });

  it("binds the approved denominator to approval and canonical result hashes only", () => {
    const events = crossMarketSessionReversalSpecimens.supported.events;
    const netChangeManifest = sensitivityManifest(
      events,
      "published-net-change",
    );
    const incrementManifest = sensitivityManifest(
      events,
      "minimum-price-increment",
    );
    const netChangeRule = netChangeManifest.rules[0]!;
    if (
      netChangeRule.ruleId !== "CROSS_MARKET_SESSION_REVERSAL" ||
      netChangeRule.ruleVersion !== "1.1"
    ) {
      throw new Error("Expected cross-market 1.1 fixture");
    }
    expect(() =>
      replayCrossMarketSessionReversal(events, {
        ...netChangeManifest,
        rules: [
          {
            ...netChangeRule,
            parameters: {
              ...netChangeRule.parameters,
              legs: netChangeRule.parameters.legs.map((leg) => ({
                ...leg,
                approvedDenominatorId: "minimum-price-increment",
              })),
            },
          },
        ],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CrossMarketRuleError>>({
        code: "APPROVED_ARTIFACT_HASH_MISMATCH",
      }),
    );
    const netChangeReplay = replayCrossMarketSessionReversal(
      events,
      netChangeManifest,
    );
    const incrementReplay = replayCrossMarketSessionReversal(
      events,
      incrementManifest,
    );

    expect(netChangeManifest.approval.approvedArtifactHash).not.toBe(
      incrementManifest.approval.approvedArtifactHash,
    );
    expect({
      ...netChangeManifest.approval,
      approvedArtifactHash: "comparison-placeholder",
    }).toEqual({
      ...incrementManifest.approval,
      approvedArtifactHash: "comparison-placeholder",
    });
    expect(netChangeReplay.canonicalResultHash).not.toBe(
      incrementReplay.canonicalResultHash,
    );
    expect(netChangeReplay.canonicalResultHash).toBe(
      "c04ceb716e9068fded87aa46a2c3ab5c94d4a5f3c7ce507dc314e631b4fafb27",
    );
    expect(netChangeReplay.events).toEqual(incrementReplay.events);
    expect(netChangeReplay.orderedEventIds).toEqual(
      incrementReplay.orderedEventIds,
    );
    expect(netChangeReplay.evaluation.result).toBe(
      incrementReplay.evaluation.result,
    );
    expect(netChangeReplay.evaluation.analysis?.legs[0]).toMatchObject({
      approvedDenominatorId: "published-net-change",
      reversalMultiple: "10",
    });
    expect(incrementReplay.evaluation.analysis?.legs[0]).toMatchObject({
      approvedDenominatorId: "minimum-price-increment",
      reversalMultiple: "20",
    });
  });

  it("omits comparison values when the result is inconclusive", () => {
    const events = crossMarketSessionReversalSpecimens.inconclusive.events;
    expect(
      evaluateCrossMarketSessionReversal(events, sensitivityManifest(events)),
    ).toMatchObject({
      ruleVersion: "1.1",
      result: "INCONCLUSIVE",
      sensitivity: null,
    });
  });

  it("fails closed when a declared denominator field is absent from the source event", () => {
    const events = crossMarketSessionReversalSpecimens.supported.events;
    expect(
      evaluateCrossMarketSessionReversal(
        events,
        sensitivityManifest(events, "published-net-change", "price"),
      ),
    ).toMatchObject({
      ruleVersion: "1.1",
      result: "INCONCLUSIVE",
      reason: "DECLARED_DENOMINATOR_FIELD_ABSENT",
      sensitivity: null,
    });
  });

  it("retains an event price used as a sensitivity denominator", () => {
    const events = crossMarketSessionReversalSpecimens.supported.events.map(
      (event) => ({ ...event, price: "0.5" }),
    );
    expect(
      evaluateCrossMarketSessionReversal(
        events,
        sensitivityManifest(events, "published-net-change", "price"),
      ),
    ).toMatchObject({
      analysis: {
        legs: [
          expect.objectContaining({ price: "0.5" }),
          expect.objectContaining({ price: "0.5" }),
        ],
      },
    });
  });

  it("fails closed instead of taking the magnitude of a negative price-level denominator", () => {
    const events = crossMarketSessionReversalSpecimens.supported.events.map(
      (event) => ({ ...event, price: "-0.5" }),
    );
    expect(
      evaluateCrossMarketSessionReversal(
        events,
        sensitivityManifest(events, "published-net-change", "price"),
      ),
    ).toMatchObject({
      ruleVersion: "1.1",
      result: "INCONCLUSIVE",
      reason: "NON_POSITIVE_DECLARED_DENOMINATOR",
      sensitivity: null,
    });
  });

  it("reports a failed leg gate even when the configured quorum supports the pattern", () => {
    const specimen = crossMarketSessionReversalSpecimens.notSupported;
    const result = evaluateCrossMarketSessionReversal(
      specimen.events,
      manifest(specimen.events, { minimumAgreeingLegs: "1" }),
    );
    expect(result.result).toBe("SUPPORTED");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        gate: "LEG_REVERSAL_MULTIPLE",
        legId: "confirming",
        passed: false,
      }),
    );
  });

  it("limits baseline observations to the approved case window", () => {
    const specimen = crossMarketSessionReversalSpecimens.supported;
    const configured = manifest(specimen.events);
    const narrowedAttempt = {
      ...configured,
      hypothesis: {
        ...configured.hypothesis,
        startTime: "2026-09-01T00:00:00Z",
      },
    } as CaseManifestV14;
    const narrowed = {
      ...narrowedAttempt,
      approval: {
        ...narrowedAttempt.approval,
        approvedArtifactHash: sha256Canonical(
          caseManifestProposal(narrowedAttempt),
        ),
      },
    };
    const replay = replayCrossMarketSessionReversal(specimen.events, narrowed);
    expect(replay.evaluation).toMatchObject({
      result: "SUPPORTED",
      analysis: { rank: { populationSize: "2" } },
    });
    expect(replay.evaluation.findings[0]!.referencedEventIds).not.toContain(
      specimen.events[0]!.eventId,
    );
  });

  it("covers empty and single-day baselines, zero change, a missing leg and an out-of-range date", () => {
    const supported = crossMarketSessionReversalSpecimens.supported.events;
    const configured = manifest(supported);
    const primary = supported.filter(
      ({ instrumentId }) => instrumentId === "SYNTH-PRIMARY",
    );
    expect(
      evaluateCrossMarketSessionReversal(
        supported.filter(
          ({ instrumentId }) => instrumentId !== "SYNTH-PRIMARY",
        ),
        configured,
      ),
    ).toMatchObject({ result: "INCONCLUSIVE", reason: "EMPTY_BASELINE" });
    expect(
      evaluateCrossMarketSessionReversal(
        [...primary.slice(-1), supported.at(-1)!],
        configured,
      ),
    ).toMatchObject({
      result: "INCONCLUSIVE",
      reason: "INSUFFICIENT_BASELINE_POPULATION",
    });
    expect(
      evaluateCrossMarketSessionReversal(
        crossMarketSessionReversalSpecimens.inconclusive.events,
        manifest(crossMarketSessionReversalSpecimens.inconclusive.events),
      ),
    ).toMatchObject({ result: "INCONCLUSIVE", reason: "ZERO_NET_CHANGE" });
    expect(
      evaluateCrossMarketSessionReversal(supported.slice(0, -1), configured),
    ).toMatchObject({ result: "INCONCLUSIVE", reason: "DECLARED_LEG_ABSENT" });
    expect(
      evaluateCrossMarketSessionReversal(
        supported,
        manifest(supported, { analysedDate: "2026-09-03" }),
      ),
    ).toMatchObject({
      result: "INCONCLUSIVE",
      reason: "ANALYSED_DATE_OUTSIDE_BASELINE_RANGE",
    });
  });

  it("refuses replay when a declared instrument is outside the dataset profile", () => {
    const specimen = crossMarketSessionReversalSpecimens.supported;
    const configured = manifest(specimen.events);
    const outsideAttempt = {
      ...configured,
      hypothesis: {
        ...configured.hypothesis,
        instrumentIds: ["SYNTH-PRIMARY", "OUTSIDE-PROFILE"],
      },
    } as CaseManifestV14;
    const outside = {
      ...outsideAttempt,
      approval: {
        ...outsideAttempt.approval,
        approvedArtifactHash: sha256Canonical(
          caseManifestProposal(outsideAttempt),
        ),
      },
    };
    expect(() =>
      replayCrossMarketSessionReversal(specimen.events, outside),
    ).toThrowError(
      expect.objectContaining<Partial<CrossMarketRuleError>>({
        code: "INSTRUMENT_OUTSIDE_DATASET_PROFILE",
      }),
    );
  });

  it("rejects rejected or hash-mismatched manifests before replay", () => {
    const specimen = crossMarketSessionReversalSpecimens.supported;
    const configured = manifest(specimen.events);
    const configuredRule = configured.rules[0]!;
    if (
      configuredRule.ruleId !== "CROSS_MARKET_SESSION_REVERSAL" ||
      configuredRule.ruleVersion !== "1.0"
    ) {
      throw new Error("Expected cross-market rule fixture");
    }
    expect(() =>
      replayCrossMarketSessionReversal(specimen.events, {
        ...configured,
        approval: { ...configured.approval, decision: "REJECTED" },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CrossMarketRuleError>>({
        code: "APPROVAL_REJECTED",
      }),
    );
    expect(() =>
      replayCrossMarketSessionReversal(specimen.events, {
        ...configured,
        rules: [
          {
            ...configuredRule,
            parameters: {
              ...configuredRule.parameters,
              maximumBaselineRank: "2",
            },
          },
        ],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CrossMarketRuleError>>({
        code: "APPROVED_ARTIFACT_HASH_MISMATCH",
      }),
    );
  });

  it("fails closed on duplicate or mismatched rule declarations", () => {
    const specimen = crossMarketSessionReversalSpecimens.supported;
    const configured = manifest(specimen.events);
    expect(() =>
      evaluateCrossMarketSessionReversal(specimen.events, {
        ...configured,
        rules: [...configured.rules, configured.rules[0]!],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CrossMarketRuleError>>({
        code: "RULE_CONFIGURATION_REQUIRED",
      }),
    );
    expect(() =>
      evaluateCrossMarketSessionReversal(specimen.events, {
        ...configured,
        hypothesis: {
          ...configured.hypothesis,
          instrumentIds: [...configured.hypothesis.instrumentIds, "EXTRA"],
        },
      }),
    ).toThrowError(/exactly match/);
  });

  it("decides a threshold from exact integers rather than the rendered multiple", () => {
    const specimen = crossMarketSessionReversalSpecimens.supported;
    const events = specimen.events.map((event) =>
      event.instrumentId === "SYNTH-CONFIRMING"
        ? {
            ...event,
            openPrice: "11",
            highPrice: "15.00009",
            lowPrice: "9",
            closePrice: "10",
            netChange: "1",
          }
        : event,
    );
    const result = evaluateCrossMarketSessionReversal(
      events,
      manifest(events, {
        legs: [
          {
            legId: "primary",
            instrumentId: "SYNTH-PRIMARY",
            minimumReversalMultiple: "5",
          },
          {
            legId: "confirming",
            instrumentId: "SYNTH-CONFIRMING",
            minimumReversalMultiple: "5.0001",
          },
        ],
      }),
    );
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        legId: "confirming",
        observedValue: "5",
        threshold: "5.0001",
        passed: false,
      }),
    );
  });

  it("keeps price and threshold arithmetic out of JavaScript numbers", () => {
    const source = readFileSync(
      new URL("./cross-market-session-reversal.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(
      /(?:Number|parseFloat|parseInt)\([^)]*(?:Price|netChange|threshold|multiple|reversal|denominator)/,
    );
    expect(source).not.toMatch(
      /(?:Price|netChange|threshold|multiple|reversal|denominator)[^\n;]*(?:\.toFixed|Math\.)/,
    );
  });
});
