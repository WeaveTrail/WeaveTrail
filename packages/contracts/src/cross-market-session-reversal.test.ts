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
});
