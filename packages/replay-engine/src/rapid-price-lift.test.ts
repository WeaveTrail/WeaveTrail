import { describe, expect, it } from "vitest";

import type { CaseManifest, TradeEvent } from "@weavetrail/contracts";
import { concentratedBuyEvents } from "@weavetrail/scenarios";

import {
  RuleEvaluationError,
  evaluateRapidPriceLift,
  replayRapidPriceLift,
} from "./rapid-price-lift";

const HASH = "a".repeat(64);

function event(index: number, overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    ...concentratedBuyEvents[0]!,
    eventId: `rule-event-${index}`,
    sourceEventId: `rule-source-${index}`,
    eventTime: `2026-08-25T00:00:0${index}Z`,
    sequence: String(index),
    instrumentId: "WT-RULE-SYNTH",
    eventType: "TRADE",
    side: "SELL",
    actorId: `other-${index}`,
    price: "100",
    quantity: "1",
    rawRowHash: index.toString(16).padStart(64, "0"),
    ...overrides,
  };
}

function manifest(
  overrides: Partial<CaseManifest["hypothesis"]> = {},
): CaseManifest {
  return {
    manifestVersion: "1.2",
    caseId: "rapid-price-lift-engine-test",
    canonicalDatasetHash: HASH,
    hypothesis: {
      pattern: "RAPID_PRICE_LIFT",
      instrumentId: "WT-RULE-SYNTH",
      actorIds: ["actor-approved"],
      startTime: "2026-08-25T00:00:00Z",
      endTime: "2026-08-25T00:00:09Z",
      ...overrides,
    },
    rules: [
      {
        ruleId: "RAPID_PRICE_LIFT",
        ruleVersion: "1.0",
        parameters: {
          minimumPriceChangeBps: "100",
          minimumAggressiveBuyShareBps: "7000",
          minimumActorConcentrationShareBps: "9000",
          minimumExecutionsAboveReference: "2",
          minimumRemovalSensitivityBps: "100",
        },
      },
    ],
    aiTrace: {
      provider: "fixture",
      model: "deterministic",
      promptVersion: "1",
      confidence: 1,
      referencedEventIds: [],
    },
    approval: {
      approvedArtifactHash: HASH,
      reviewerRef: "reviewer-fixture",
      decision: "APPROVED",
      overrides: [],
      approvedAt: "2026-09-03T00:00:00Z",
    },
  };
}

const supportedEvents = [
  event(1),
  event(2, {
    side: "BUY",
    actorId: "actor-approved",
    price: "101",
    quantity: "4",
  }),
  event(3, {
    side: "BUY",
    actorId: "actor-approved",
    price: "102",
    quantity: "4",
  }),
  event(4, { price: "100.5" }),
];

describe("evaluateRapidPriceLift", () => {
  it("evaluates all five gates with exact metrics and event references", () => {
    const replay = replayRapidPriceLift(supportedEvents, manifest());

    expect(replay.evaluation).toMatchObject({
      result: "SUPPORTED",
      nonComparableEventCount: 0,
      sensitivity: {
        comparison: "MECHANICAL_METRIC_COMPARISON",
        priceChangeBps: "200.0000",
        priceChangeBpsWithoutApprovedActors: "50.0000",
        removalSensitivityBps: "150.0000",
      },
    });
    expect(replay.evaluation.findings).toHaveLength(5);
    expect(replay.evaluation.findings.every(({ passed }) => passed)).toBe(true);
    expect(
      replay.evaluation.findings.every(
        ({ referencedEventIds }) => referencedEventIds.length > 0,
      ),
    ).toBe(true);
  });

  it.each([
    ["INSUFFICIENT_ELIGIBLE_EVENTS", [event(1)]],
    ["REFERENCE_PRICE_NOT_POSITIVE", [event(1, { price: "0" }), event(2)]],
    [
      "TOTAL_NOTIONAL_NOT_POSITIVE",
      [event(1, { quantity: "-1" }), event(2, { quantity: "1" })],
    ],
    ["NO_AGGRESSIVE_BUY_NOTIONAL", [event(1), event(2)]],
    [
      "REMOVAL_LEAVES_INSUFFICIENT_EVENTS",
      [event(1), event(2, { side: "BUY", actorId: "actor-approved" })],
    ],
  ] as const)(
    "abstains with %s at its first failed precondition",
    (reason, events) => {
      expect(evaluateRapidPriceLift(events, manifest())).toEqual({
        ruleId: "RAPID_PRICE_LIFT",
        ruleVersion: "1.0",
        result: "INCONCLUSIVE",
        reason,
        nonComparableEventCount: 0,
        findings: [],
        sensitivity: null,
      });
    },
  );

  it("counts an in-window trade without price as non-comparable and excludes it", () => {
    const missingPrice = event(5);
    delete missingPrice.price;
    const result = evaluateRapidPriceLift(
      [...supportedEvents, missingPrice],
      manifest(),
    );

    expect(result.nonComparableEventCount).toBe(1);
    expect(
      result.findings.every(
        ({ referencedEventIds }) =>
          !referencedEventIds.includes(missingPrice.eventId),
      ),
    ).toBe(true);
  });

  it("fails closed when the approved manifest has no rule configuration", () => {
    const configured = manifest();
    configured.rules = [];

    expect(() => evaluateRapidPriceLift([], configured)).toThrowError(
      expect.objectContaining<Partial<RuleEvaluationError>>({
        code: "RULE_CONFIGURATION_REQUIRED",
      }),
    );
  });

  it("fails closed when the approved manifest has duplicate rule configurations", () => {
    const configured = manifest();
    configured.rules.push({
      ...configured.rules[0]!,
      parameters: {
        ...configured.rules[0]!.parameters,
        minimumPriceChangeBps: "9999",
      },
    });

    expect(() =>
      evaluateRapidPriceLift(supportedEvents, configured),
    ).toThrowError(
      expect.objectContaining<Partial<RuleEvaluationError>>({
        code: "RULE_CONFIGURATION_REQUIRED",
      }),
    );
  });

  it("does not let rendering determine an exact gate outcome", () => {
    const configured = manifest();
    configured.rules[0]!.parameters.minimumRemovalSensitivityBps = "0.0000";
    const result = evaluateRapidPriceLift(
      [
        event(1, { actorId: "actor-approved", price: "100.000000001" }),
        event(2, {
          side: "BUY",
          actorId: "actor-approved",
          price: "101",
          quantity: "10",
        }),
        event(3, { side: "BUY", price: "100" }),
        event(4, { price: "101" }),
      ],
      configured,
    );
    const gate = result.findings.find(
      ({ gate }) => gate === "REMOVAL_SENSITIVITY",
    );

    expect(gate?.observedValue).toBe("0.0000");
    expect(gate?.threshold).toBe("0.0000");
    expect(gate?.passed).toBe(false);
  });
});
