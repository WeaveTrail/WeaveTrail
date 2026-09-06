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
});
