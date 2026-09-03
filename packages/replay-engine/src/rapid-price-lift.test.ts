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
    manifestVersion: "1.3",
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
        ruleVersion: "1.1",
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
      ruleVersion: "1.1",
      result: "SUPPORTED",
      nonComparableEventCount: 0,
      sensitivity: {
        comparison: "MECHANICAL_METRIC_COMPARISON",
        priceChangeBps: "200.0000",
        priceChangeBpsWithoutApprovedActors: "50.0000",
        removalSensitivityBps: "150.0000",
      },
    });
    expect(replay.engineVersion).toBe("0.7.0-canonical-decimal");
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
        ruleVersion: "1.1",
        result: "INCONCLUSIVE",
        reason,
        nonComparableEventCount: 0,
        findings: [],
        sensitivity: null,
      });
    },
  );

  it.each([
    ["price", event(1, { price: "0" }), event(2)],
    ["quantity", event(1, { quantity: "-1" }), event(2)],
  ] as const)(
    "treats a non-positive %s as non-comparable before aggregate preconditions",
    (_field, nonComparable, comparable) => {
      expect(
        evaluateRapidPriceLift([nonComparable, comparable], manifest()),
      ).toMatchObject({
        result: "INCONCLUSIVE",
        reason: "INSUFFICIENT_ELIGIBLE_EVENTS",
        nonComparableEventCount: 1,
      });
    },
  );

  it.each(["price", "quantity"] as const)(
    "counts an in-window trade without %s as non-comparable and excludes it",
    (field) => {
      const incomplete = event(5);
      delete incomplete[field];
      const result = evaluateRapidPriceLift(
        [...supportedEvents, incomplete],
        manifest(),
      );

      expect(result.nonComparableEventCount).toBe(1);
      expect(
        result.findings.every(
          ({ referencedEventIds }) =>
            !referencedEventIds.includes(incomplete.eventId),
        ),
      ).toBe(true);
    },
  );

  it("excludes an in-window trade without side instead of reading negative evidence", () => {
    const missingSide = event(5, { quantity: "1000" });
    delete missingSide.side;
    const result = evaluateRapidPriceLift(
      [...supportedEvents, missingSide],
      manifest(),
    );

    expect(result.result).toBe("SUPPORTED");
    expect(result.nonComparableEventCount).toBe(1);
  });

  it("excludes an in-window buy without actor identity from concentration", () => {
    const missingActor = event(5, {
      side: "BUY",
      quantity: "1000",
    });
    delete missingActor.actorId;
    const result = evaluateRapidPriceLift(
      [...supportedEvents, missingActor],
      manifest(),
    );
    const concentration = result.findings.find(
      ({ gate }) => gate === "ACTOR_CONCENTRATION",
    );

    expect(result.result).toBe("SUPPORTED");
    expect(result.nonComparableEventCount).toBe(1);
    expect(concentration?.observedValue).toBe("10000.0000");
  });

  it("excludes a negative-price trade from metrics and finding references", () => {
    const negativePrice = event(5, { price: "-1" });
    const replay = replayRapidPriceLift(
      [...supportedEvents, negativePrice],
      manifest(),
    );
    const result = replay.evaluation;
    const aggressiveBuyShare = result.findings.find(
      ({ gate }) => gate === "AGGRESSIVE_BUY_SHARE",
    );

    expect(result.nonComparableEventCount).toBe(1);
    expect(result.ruleVersion).toBe("1.1");
    expect(replay.engineVersion).toBe("0.7.0-canonical-decimal");
    expect(aggressiveBuyShare?.observedValue).toBe("8019.7530");
    expect(
      result.findings.every(
        ({ referencedEventIds }) =>
          !referencedEventIds.includes(negativePrice.eventId),
      ),
    ).toBe(true);
  });

  it("excludes a zero-quantity trade from the peak price", () => {
    const zeroQuantity = event(5, { price: "99999", quantity: "0" });
    const result = evaluateRapidPriceLift(
      [...supportedEvents, zeroQuantity],
      manifest(),
    );
    const priceChange = result.findings.find(
      ({ gate }) => gate === "PRICE_CHANGE",
    );

    expect(result.nonComparableEventCount).toBe(1);
    expect(priceChange?.observedValue).toBe("200.0000");
  });

  it("abstains when every in-window trade has a non-positive value", () => {
    const result = evaluateRapidPriceLift(
      [
        event(1, { price: "0" }),
        event(2, { price: "-1" }),
        event(3, { quantity: "0" }),
        event(4, { quantity: "-1" }),
      ],
      manifest(),
    );

    expect(result).toMatchObject({
      result: "INCONCLUSIVE",
      reason: "INSUFFICIENT_ELIGIBLE_EVENTS",
      nonComparableEventCount: 4,
    });
  });

  it("abstains when every in-window trade is unclassifiable", () => {
    const missingSide = event(1);
    delete missingSide.side;
    const missingActor = event(2);
    delete missingActor.actorId;

    expect(
      evaluateRapidPriceLift([missingSide, missingActor], manifest()),
    ).toMatchObject({
      result: "INCONCLUSIVE",
      reason: "INSUFFICIENT_ELIGIBLE_EVENTS",
      nonComparableEventCount: 2,
    });
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

  it("rejects a superseded 1.0 rule configuration instead of reinterpreting it", () => {
    const current = manifest();
    const configured = {
      ...current,
      rules: [{ ...current.rules[0]!, ruleVersion: "1.0" }],
    } as unknown as CaseManifest;

    expect(() => evaluateRapidPriceLift([], configured)).toThrowError(
      "Exactly one approved RAPID_PRICE_LIFT 1.1 rule configuration is required",
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

  it.each(["0", "-1"])(
    "excludes a survivor candidate whose price is %s",
    (survivorPrice) => {
      const result = evaluateRapidPriceLift(
        [
          event(1, {
            side: "BUY",
            actorId: "actor-approved",
            price: "100",
          }),
          event(2, { price: survivorPrice }),
          event(3, { price: "100" }),
        ],
        manifest(),
      );

      expect(result).toMatchObject({
        result: "INCONCLUSIVE",
        reason: "REMOVAL_LEAVES_INSUFFICIENT_EVENTS",
        nonComparableEventCount: 1,
      });
    },
  );

  it("checks eligible count after excluding a non-positive value", () => {
    const result = evaluateRapidPriceLift(
      [
        event(1, {
          side: "BUY",
          actorId: "actor-approved",
          price: "100",
        }),
        event(2, { price: "0" }),
      ],
      manifest(),
    );

    expect(result).toMatchObject({
      result: "INCONCLUSIVE",
      reason: "INSUFFICIENT_ELIGIBLE_EVENTS",
      nonComparableEventCount: 1,
    });
  });
});
