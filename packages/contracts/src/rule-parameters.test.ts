import { describe, expect, it } from "vitest";

import { RuleConfigurationSchema } from "./rule-parameters";

const parameters = {
  minimumPriceChangeBps: "1",
  minimumAggressiveBuyShareBps: "1",
  minimumActorConcentrationShareBps: "1",
  minimumExecutionsAboveReference: "1",
  minimumRemovalSensitivityBps: "1",
};

describe("rule parameter registry", () => {
  it("accepts the declared parameter names and shapes without defining defaults", () => {
    expect(
      RuleConfigurationSchema.safeParse({
        ruleId: "RAPID_PRICE_LIFT",
        ruleVersion: "1.0",
        parameters,
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown rule version", () => {
    expect(
      RuleConfigurationSchema.safeParse({
        ruleId: "RAPID_PRICE_LIFT",
        ruleVersion: "2.0",
        parameters,
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown parameter name", () => {
    expect(
      RuleConfigurationSchema.safeParse({
        ruleId: "RAPID_PRICE_LIFT",
        ruleVersion: "1.0",
        parameters: { ...parameters, modelSelectedThreshold: "1" },
      }).success,
    ).toBe(false);
  });
});
