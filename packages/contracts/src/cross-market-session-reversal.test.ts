import { describe, expect, it } from "vitest";

import { CrossMarketSessionReversalResultSchema } from "./cross-market-session-reversal";
import { RuleConfigurationSchema } from "./rule-parameters";

const parameters = {
  analysedDate: "2026-09-03",
  baselineRange: {
    startDate: "2026-07-01",
    endDateInclusive: "2026-09-03",
  },
  baselineLegId: "spot",
  legs: [
    {
      legId: "spot",
      instrumentId: "SPOT",
      minimumReversalMultiple: "10",
    },
    {
      legId: "future",
      instrumentId: "FUTURE",
      minimumReversalMultiple: "20",
    },
  ],
  maximumBaselineRank: "1",
  minimumAgreeingLegs: "2",
};

const denominator = {
  denominatorId: "published-net-change",
  meaning: "OBSERVED_PRICE_CHANGE" as const,
  source: { kind: "EVENT_FIELD" as const, field: "netChange" as const },
};
const minimumIncrement = {
  denominatorId: "minimum-price-increment",
  meaning:
    "INSTRUMENT_MINIMUM_PRICE_INCREMENT_NOT_TRADE_ESTABLISHED_LEVEL" as const,
  source: {
    kind: "DECLARED_VALUE" as const,
    value: "0.5",
    provenance: "Synthetic instrument specification fixture.",
  },
};
const sensitivityParameters = {
  ...parameters,
  legs: parameters.legs.map((leg) => ({
    ...leg,
    approvedDenominatorId: denominator.denominatorId,
    denominators: [denominator, minimumIncrement],
  })),
};

function conclusiveV11Result(
  options: {
    approvedDenominatorValue?: string;
    sensitivityDenominatorValue?: string;
    sensitivityMeaning?:
      | "OBSERVED_PRICE_CHANGE"
      | "OBSERVED_PRICE_LEVEL"
      | "INSTRUMENT_MINIMUM_PRICE_INCREMENT_NOT_TRADE_ESTABLISHED_LEVEL";
    sensitivitySource?:
      | { kind: "EVENT_FIELD"; field: "netChange" | "openPrice" }
      | { kind: "DECLARED_VALUE"; provenance: string };
    approvedMetricValue?: string;
    alternativeMetricValue?: string;
    ratioToApprovedMetric?: string | null;
    ratioUnavailableReason?: "BOTH_METRICS_ZERO";
  } = {},
) {
  const eventIds = ["event-spot", "event-future"];
  const legs = parameters.legs.map((leg, index) => ({
    legId: leg.legId,
    instrumentId: leg.instrumentId,
    eventId: eventIds[index]!,
    openPrice: "100",
    highPrice: "110",
    lowPrice: "90",
    closePrice: "95",
    sessionReversal: "15",
    netChange: "1",
    relation: "OPPOSED" as const,
    reversalMultiple: options.approvedMetricValue ?? "15",
    approvedDenominatorId: "published-net-change",
    approvedDenominatorValue: options.approvedDenominatorValue ?? "1",
  }));
  return {
    ruleId: "CROSS_MARKET_SESSION_REVERSAL",
    ruleVersion: "1.1",
    result: "SUPPORTED",
    findings: [
      {
        gate: "BASELINE_RANK",
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        observedValue: "1",
        threshold: "1",
        passed: true,
        referencedEventIds: eventIds,
      },
      ...parameters.legs.map((leg, index) => ({
        gate: "LEG_REVERSAL_MULTIPLE",
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        legId: leg.legId,
        instrumentId: leg.instrumentId,
        observedValue: "15",
        threshold: leg.minimumReversalMultiple,
        passed: true,
        referencedEventIds: [eventIds[index]!],
      })),
      {
        gate: "AGREEING_LEGS",
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        observedValue: "2",
        threshold: "2",
        passed: true,
        referencedEventIds: eventIds,
      },
    ],
    analysis: {
      analysedDate: parameters.analysedDate,
      baselineRange: parameters.baselineRange,
      rank: {
        position: "1",
        populationSize: "2",
        interpretation: "POSITION_WITHIN_DECLARED_RANGE_NOT_PROBABILITY",
      },
      legs,
      candidateSelection: "STATED_DATE_ONLY_NO_CANDIDATE_SCAN",
    },
    sensitivity: {
      comparison: "MECHANICAL_METRIC_COMPARISON",
      interpretation: "MECHANICAL_RECOMPUTATION_NOT_CAUSAL_CONCLUSION",
      legs: legs.map((leg) => ({
        legId: leg.legId,
        instrumentId: leg.instrumentId,
        eventId: leg.eventId,
        approved: {
          denominatorId: "published-net-change",
          denominatorValue: options.sensitivityDenominatorValue ?? "1",
          meaning: options.sensitivityMeaning ?? "OBSERVED_PRICE_CHANGE",
          source: options.sensitivitySource ?? {
            kind: "EVENT_FIELD",
            field: "netChange",
          },
          metricValue: options.approvedMetricValue ?? "15",
        },
        alternatives: [
          {
            denominatorId: "minimum-price-increment",
            denominatorValue: "0.5",
            meaning:
              "INSTRUMENT_MINIMUM_PRICE_INCREMENT_NOT_TRADE_ESTABLISHED_LEVEL",
            source: {
              kind: "DECLARED_VALUE",
              provenance: "Synthetic instrument specification fixture.",
            },
            metricValue: options.alternativeMetricValue ?? "30",
            ratioToApprovedMetric:
              options.ratioToApprovedMetric === undefined
                ? "2"
                : options.ratioToApprovedMetric,
            ...(options.ratioUnavailableReason === undefined
              ? {}
              : {
                  ratioUnavailableReason: options.ratioUnavailableReason,
                }),
          },
        ],
      })),
    },
  };
}

describe("cross-market session reversal contracts", () => {
  it("accepts the strict 1.0 parameter branch", () => {
    expect(
      RuleConfigurationSchema.parse({
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        ruleVersion: "1.0",
        parameters,
      }),
    ).toEqual({
      ruleId: "CROSS_MARKET_SESSION_REVERSAL",
      ruleVersion: "1.0",
      parameters,
    });
  });

  it("accepts the strict 1.1 denominator declaration", () => {
    expect(
      RuleConfigurationSchema.parse({
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        ruleVersion: "1.1",
        parameters: sensitivityParameters,
      }),
    ).toMatchObject({
      ruleVersion: "1.1",
      parameters: {
        legs: expect.arrayContaining([
          expect.objectContaining({
            approvedDenominatorId: "published-net-change",
          }),
        ]),
      },
    });
  });

  it.each([
    {
      ...sensitivityParameters,
      legs: sensitivityParameters.legs.map((leg) => ({
        ...leg,
        approvedDenominatorId: "missing",
      })),
    },
    {
      ...sensitivityParameters,
      legs: sensitivityParameters.legs.map((leg) => ({
        ...leg,
        denominators: [denominator, denominator],
      })),
    },
    {
      ...sensitivityParameters,
      legs: sensitivityParameters.legs.map((leg) => ({
        ...leg,
        denominators: [
          denominator,
          {
            ...minimumIncrement,
            source: { ...minimumIncrement.source, value: "0" },
          },
        ],
      })),
    },
  ])("rejects an incoherent 1.1 denominator declaration", (input) => {
    expect(
      RuleConfigurationSchema.safeParse({
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        ruleVersion: "1.1",
        parameters: input,
      }).success,
    ).toBe(false);
  });

  it.each([
    { ...parameters, baselineLegId: "missing" },
    { ...parameters, minimumAgreeingLegs: "3" },
    {
      ...parameters,
      legs: [
        { ...parameters.legs[0], minimumReversalMultiple: "-1" },
        parameters.legs[1],
      ],
    },
    {
      ...parameters,
      baselineRange: {
        startDate: "2026-09-04",
        endDateInclusive: "2026-09-03",
      },
    },
    { ...parameters, legs: [parameters.legs[0], parameters.legs[0]] },
  ])("rejects an incoherent parameter declaration", (input) => {
    expect(
      RuleConfigurationSchema.safeParse({
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        ruleVersion: "1.0",
        parameters: input,
      }).success,
    ).toBe(false);
  });

  it("requires an explicit reason and omits observations when inconclusive", () => {
    expect(
      CrossMarketSessionReversalResultSchema.parse({
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        ruleVersion: "1.0",
        result: "INCONCLUSIVE",
        reason: "ZERO_NET_CHANGE",
        findings: [],
        analysis: null,
      }),
    ).toMatchObject({ result: "INCONCLUSIVE", reason: "ZERO_NET_CHANGE" });
    expect(
      CrossMarketSessionReversalResultSchema.safeParse({
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        ruleVersion: "1.0",
        result: "INCONCLUSIVE",
        findings: [],
        analysis: null,
      }).success,
    ).toBe(false);
  });

  it("requires null sensitivity for an inconclusive 1.1 result", () => {
    expect(
      CrossMarketSessionReversalResultSchema.parse({
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        ruleVersion: "1.1",
        result: "INCONCLUSIVE",
        reason: "DECLARED_DENOMINATOR_FIELD_ABSENT",
        findings: [],
        analysis: null,
        sensitivity: null,
      }),
    ).not.toHaveProperty("sensitivity.comparison");
  });

  it("rejects denominator-specific abstention reasons from the 1.0 result branch", () => {
    for (const reason of [
      "DECLARED_DENOMINATOR_FIELD_ABSENT",
      "NON_POSITIVE_DECLARED_DENOMINATOR",
    ]) {
      expect(
        CrossMarketSessionReversalResultSchema.safeParse({
          ruleId: "CROSS_MARKET_SESSION_REVERSAL",
          ruleVersion: "1.0",
          result: "INCONCLUSIVE",
          reason,
          findings: [],
          analysis: null,
        }).success,
      ).toBe(false);
    }
  });

  it.each(["0", "-1"])(
    "rejects non-positive denominator value %s from conclusive 1.1 results",
    (value) => {
      expect(
        CrossMarketSessionReversalResultSchema.safeParse(
          conclusiveV11Result({ sensitivityDenominatorValue: value }),
        ).success,
      ).toBe(false);
      expect(
        CrossMarketSessionReversalResultSchema.safeParse(
          conclusiveV11Result({ approvedDenominatorValue: value }),
        ).success,
      ).toBe(false);
    },
  );

  it.each([
    {
      sensitivityMeaning:
        "INSTRUMENT_MINIMUM_PRICE_INCREMENT_NOT_TRADE_ESTABLISHED_LEVEL" as const,
      sensitivitySource: {
        kind: "EVENT_FIELD" as const,
        field: "netChange" as const,
      },
    },
    {
      sensitivityMeaning: "OBSERVED_PRICE_CHANGE" as const,
      sensitivitySource: {
        kind: "EVENT_FIELD" as const,
        field: "openPrice" as const,
      },
    },
  ])(
    "rejects incompatible denominator meaning/source pairs from conclusive results",
    (options) => {
      expect(
        CrossMarketSessionReversalResultSchema.safeParse(
          conclusiveV11Result(options),
        ).success,
      ).toBe(false);
    },
  );

  it.each([
    { approvedMetricValue: "15", alternativeMetricValue: "30" },
    { approvedMetricValue: "15", alternativeMetricValue: "0" },
    { approvedMetricValue: "0", alternativeMetricValue: "30" },
  ])(
    "rejects BOTH_METRICS_ZERO unless both reported metrics are zero",
    ({ approvedMetricValue, alternativeMetricValue }) => {
      expect(
        CrossMarketSessionReversalResultSchema.safeParse(
          conclusiveV11Result({
            approvedMetricValue,
            alternativeMetricValue,
            ratioToApprovedMetric: null,
            ratioUnavailableReason: "BOTH_METRICS_ZERO",
          }),
        ).success,
      ).toBe(false);
    },
  );

  it("accepts BOTH_METRICS_ZERO when both reported metrics are zero", () => {
    expect(
      CrossMarketSessionReversalResultSchema.safeParse(
        conclusiveV11Result({
          approvedMetricValue: "0",
          alternativeMetricValue: "0",
          ratioToApprovedMetric: null,
          ratioUnavailableReason: "BOTH_METRICS_ZERO",
        }),
      ).success,
    ).toBe(true);
  });

  it.each([
    {
      conflict: "the approved denominator",
      mutate: (result: ReturnType<typeof conclusiveV11Result>) => {
        result.sensitivity.legs[0]!.alternatives[0]!.denominatorId =
          "published-net-change";
      },
    },
    {
      conflict: "another alternative",
      mutate: (result: ReturnType<typeof conclusiveV11Result>) => {
        result.sensitivity.legs[0]!.alternatives.push(
          structuredClone(result.sensitivity.legs[0]!.alternatives[0]!),
        );
      },
    },
  ])("rejects an alternative ID that duplicates $conflict", ({ mutate }) => {
    const result = conclusiveV11Result();
    mutate(result);
    expect(
      CrossMarketSessionReversalResultSchema.safeParse(result).success,
    ).toBe(false);
  });

  it("rejects a negative alternative-to-approved metric ratio", () => {
    expect(
      CrossMarketSessionReversalResultSchema.safeParse(
        conclusiveV11Result({ ratioToApprovedMetric: "-1" }),
      ).success,
    ).toBe(false);
  });

  it.each([{ approvedMetricValue: "-15" }, { alternativeMetricValue: "-30" }])(
    "rejects negative approved and alternative denominator metrics",
    (options) => {
      expect(
        CrossMarketSessionReversalResultSchema.safeParse(
          conclusiveV11Result(options),
        ).success,
      ).toBe(false);
    },
  );

  it("rejects a ratio that contradicts the reported denominator values", () => {
    expect(
      CrossMarketSessionReversalResultSchema.safeParse(
        conclusiveV11Result({ ratioToApprovedMetric: "999" }),
      ).success,
    ).toBe(false);
  });

  it.each([
    {
      mismatch: "approved denominator identifier",
      mutate: (result: ReturnType<typeof conclusiveV11Result>) => {
        result.sensitivity.legs[0]!.approved.denominatorId = "other";
      },
    },
    {
      mismatch: "approved denominator value",
      mutate: (result: ReturnType<typeof conclusiveV11Result>) => {
        result.sensitivity.legs[0]!.approved.denominatorValue = "2";
      },
    },
    {
      mismatch: "approved metric value",
      mutate: (result: ReturnType<typeof conclusiveV11Result>) => {
        result.sensitivity.legs[0]!.approved.metricValue = "16";
      },
    },
    {
      mismatch: "instrument identifier",
      mutate: (result: ReturnType<typeof conclusiveV11Result>) => {
        result.sensitivity.legs[0]!.instrumentId = "OTHER";
      },
    },
    {
      mismatch: "event identifier",
      mutate: (result: ReturnType<typeof conclusiveV11Result>) => {
        result.sensitivity.legs[0]!.eventId = "event-other";
      },
    },
    {
      mismatch: "leg coverage",
      mutate: (result: ReturnType<typeof conclusiveV11Result>) => {
        result.sensitivity.legs[1] = structuredClone(
          result.sensitivity.legs[0]!,
        );
      },
    },
  ])(
    "rejects a $mismatch mismatch between analysis and sensitivity",
    ({ mutate }) => {
      const result = conclusiveV11Result();
      mutate(result);
      expect(
        CrossMarketSessionReversalResultSchema.safeParse(result).success,
      ).toBe(false);
    },
  );
});
