import {
  RapidPriceLiftResultSchema,
  type CaseManifest,
  type RapidPriceLiftFinding,
  type RapidPriceLiftGate,
  type RapidPriceLiftResult,
  type TradeEvent,
} from "@weavetrail/contracts";

import { compareCanonicalEventTimes } from "./canonical-order";
import { canonicalizeEvents } from "./canonicalize";
import {
  canonicalReplayResultHash,
  ENGINE_VERSION,
  type FoundationReplay,
} from "./replay-foundation";
import {
  addScaledDecimals,
  compareExactRatioToDecimal,
  compareScaledDecimals,
  multiplyScaledDecimals,
  parseScaledDecimal,
  renderExactRatioTruncated,
  subtractScaledDecimals,
  type ExactRatio,
  type ScaledDecimal,
} from "./scaled-decimal";

const ZERO = parseScaledDecimal("0");
const BASIS_POINTS = 10_000n;
const REPORTED_FRACTIONAL_DIGITS = 4n;

export class RuleEvaluationError extends Error {
  constructor(
    readonly code: "RULE_CONFIGURATION_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "RuleEvaluationError";
  }
}

export type RapidPriceLiftReplay = FoundationReplay & {
  evaluation: RapidPriceLiftResult;
};

type EligibleEvent = TradeEvent & {
  price: string;
  quantity: string;
  side: "BUY" | "SELL";
  actorId: string;
};

function isComparableCandidate(
  event: TradeEvent,
  manifest: CaseManifest,
): boolean {
  return (
    event.instrumentId === manifest.hypothesis.instrumentId &&
    event.eventType === "TRADE" &&
    compareCanonicalEventTimes(
      event.eventTime,
      manifest.hypothesis.startTime,
    ) >= 0 &&
    compareCanonicalEventTimes(event.eventTime, manifest.hypothesis.endTime) <=
      0
  );
}

function hasComparableRuleInputs(event: TradeEvent): event is EligibleEvent {
  return (
    event.price !== undefined &&
    event.quantity !== undefined &&
    event.side !== undefined &&
    event.actorId !== undefined &&
    compareScaledDecimals(parseScaledDecimal(event.price), ZERO) > 0 &&
    compareScaledDecimals(parseScaledDecimal(event.quantity), ZERO) > 0
  );
}

function isEligible(
  event: TradeEvent,
  manifest: CaseManifest,
): event is EligibleEvent {
  return (
    isComparableCandidate(event, manifest) && hasComparableRuleInputs(event)
  );
}

function sum(values: readonly ScaledDecimal[]): ScaledDecimal {
  return values.reduce(addScaledDecimals, ZERO);
}

function notional(event: EligibleEvent): ScaledDecimal {
  return multiplyScaledDecimals(
    parseScaledDecimal(event.price),
    parseScaledDecimal(event.quantity),
  );
}

function priceChange(events: readonly EligibleEvent[]): ExactRatio {
  const referencePrice = parseScaledDecimal(events[0]!.price);
  const peakPrice = events.reduce((peak, event) => {
    const candidate = parseScaledDecimal(event.price);
    return compareScaledDecimals(candidate, peak) > 0 ? candidate : peak;
  }, referencePrice);
  const difference = subtractScaledDecimals(peakPrice, referencePrice);
  const scale =
    difference.scale > referencePrice.scale
      ? difference.scale
      : referencePrice.scale;
  const scaleDifference = (value: ScaledDecimal): bigint => {
    let coefficient = value.coefficient;
    let remaining = scale - value.scale;
    while (remaining > 0n) {
      coefficient *= 10n;
      remaining -= 1n;
    }
    return coefficient;
  };
  return {
    numerator: scaleDifference(difference) * BASIS_POINTS,
    denominator: scaleDifference(referencePrice),
  };
}

function decimalRatio(
  numerator: ScaledDecimal,
  denominator: ScaledDecimal,
  multiplier = 1n,
): ExactRatio {
  let numeratorCoefficient = numerator.coefficient;
  let denominatorCoefficient = denominator.coefficient;
  let numeratorScale = numerator.scale;
  let denominatorScale = denominator.scale;
  while (numeratorScale < denominatorScale) {
    numeratorCoefficient *= 10n;
    numeratorScale += 1n;
  }
  while (denominatorScale < numeratorScale) {
    denominatorCoefficient *= 10n;
    denominatorScale += 1n;
  }
  return {
    numerator: numeratorCoefficient * multiplier,
    denominator: denominatorCoefficient,
  };
}

function subtractRatios(left: ExactRatio, right: ExactRatio): ExactRatio {
  return {
    numerator:
      left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  };
}

function inconclusive(
  reason: Extract<RapidPriceLiftResult, { result: "INCONCLUSIVE" }>["reason"],
  nonComparableEventCount: number,
): RapidPriceLiftResult {
  return RapidPriceLiftResultSchema.parse({
    ruleId: "RAPID_PRICE_LIFT",
    ruleVersion: "1.1",
    result: "INCONCLUSIVE",
    reason,
    nonComparableEventCount,
    findings: [],
    sensitivity: null,
  });
}

export function evaluateRapidPriceLift(
  canonicalEvents: readonly TradeEvent[],
  manifest: CaseManifest,
): RapidPriceLiftResult {
  const matchingRules = manifest.rules.filter(
    ({ ruleId, ruleVersion }) =>
      ruleId === "RAPID_PRICE_LIFT" && ruleVersion === "1.1",
  );
  if (matchingRules.length !== 1) {
    throw new RuleEvaluationError(
      "RULE_CONFIGURATION_REQUIRED",
      "Exactly one approved RAPID_PRICE_LIFT 1.1 rule configuration is required",
    );
  }
  const rule = matchingRules[0]!;

  const eligible = canonicalEvents.filter((event) =>
    isEligible(event, manifest),
  );
  const nonComparableEventCount = canonicalEvents.filter(
    (event) =>
      isComparableCandidate(event, manifest) && !hasComparableRuleInputs(event),
  ).length;
  if (eligible.length < 2) {
    return inconclusive(
      "INSUFFICIENT_ELIGIBLE_EVENTS",
      nonComparableEventCount,
    );
  }

  const referencePrice = parseScaledDecimal(eligible[0]!.price);

  const totalNotional = sum(eligible.map(notional));
  const buys = eligible.filter(({ side }) => side === "BUY");
  const aggressiveBuyNotional = sum(buys.map(notional));
  if (compareScaledDecimals(aggressiveBuyNotional, ZERO) <= 0) {
    return inconclusive("NO_AGGRESSIVE_BUY_NOTIONAL", nonComparableEventCount);
  }

  const approvedActors = new Set(manifest.hypothesis.actorIds);
  const withoutApprovedActors = eligible.filter(
    ({ actorId }) => !approvedActors.has(actorId),
  );
  if (withoutApprovedActors.length < 2) {
    return inconclusive(
      "REMOVAL_LEAVES_INSUFFICIENT_EVENTS",
      nonComparableEventCount,
    );
  }
  const approvedActorBuys = buys.filter(
    ({ actorId }) => actorId !== undefined && approvedActors.has(actorId),
  );
  const approvedActorBuyNotional = sum(approvedActorBuys.map(notional));
  const priceChangeBps = priceChange(eligible);
  const aggressiveBuyShareBps = decimalRatio(
    aggressiveBuyNotional,
    totalNotional,
    BASIS_POINTS,
  );
  const actorConcentrationShareBps = decimalRatio(
    approvedActorBuyNotional,
    aggressiveBuyNotional,
    BASIS_POINTS,
  );
  const executionsAboveReferenceEvents = approvedActorBuys.filter(
    ({ price }) =>
      compareScaledDecimals(parseScaledDecimal(price), referencePrice) > 0,
  );
  const executionsAboveReference: ExactRatio = {
    numerator: BigInt(executionsAboveReferenceEvents.length),
    denominator: 1n,
  };
  const priceChangeBpsWithoutApprovedActors = priceChange(
    withoutApprovedActors,
  );
  const removalSensitivityBps = subtractRatios(
    priceChangeBps,
    priceChangeBpsWithoutApprovedActors,
  );
  const allEventIds = eligible.map(({ eventId }) => eventId);
  const buyEventIds = buys.map(({ eventId }) => eventId);
  const executionEventIds = [
    eligible[0]!.eventId,
    ...executionsAboveReferenceEvents.map(({ eventId }) => eventId),
  ];

  const finding = (
    gate: RapidPriceLiftGate,
    observed: ExactRatio,
    threshold: string,
    referencedEventIds: string[],
  ): RapidPriceLiftFinding => ({
    gate,
    ruleId: "RAPID_PRICE_LIFT",
    observedValue:
      gate === "REPEATED_EXECUTION"
        ? observed.numerator.toString()
        : renderExactRatioTruncated(observed, REPORTED_FRACTIONAL_DIGITS),
    threshold,
    passed:
      compareExactRatioToDecimal(observed, parseScaledDecimal(threshold)) >= 0,
    referencedEventIds,
  });

  const findings = [
    finding(
      "PRICE_CHANGE",
      priceChangeBps,
      rule.parameters.minimumPriceChangeBps,
      allEventIds,
    ),
    finding(
      "AGGRESSIVE_BUY_SHARE",
      aggressiveBuyShareBps,
      rule.parameters.minimumAggressiveBuyShareBps,
      allEventIds,
    ),
    finding(
      "ACTOR_CONCENTRATION",
      actorConcentrationShareBps,
      rule.parameters.minimumActorConcentrationShareBps,
      buyEventIds,
    ),
    finding(
      "REPEATED_EXECUTION",
      executionsAboveReference,
      rule.parameters.minimumExecutionsAboveReference,
      executionEventIds,
    ),
    finding(
      "REMOVAL_SENSITIVITY",
      removalSensitivityBps,
      rule.parameters.minimumRemovalSensitivityBps,
      allEventIds,
    ),
  ];

  return RapidPriceLiftResultSchema.parse({
    ruleId: "RAPID_PRICE_LIFT",
    ruleVersion: "1.1",
    result: findings.every(({ passed }) => passed)
      ? "SUPPORTED"
      : "NOT_SUPPORTED",
    nonComparableEventCount,
    findings,
    sensitivity: {
      comparison: "MECHANICAL_METRIC_COMPARISON",
      priceChangeBps: renderExactRatioTruncated(
        priceChangeBps,
        REPORTED_FRACTIONAL_DIGITS,
      ),
      priceChangeBpsWithoutApprovedActors: renderExactRatioTruncated(
        priceChangeBpsWithoutApprovedActors,
        REPORTED_FRACTIONAL_DIGITS,
      ),
      removalSensitivityBps: renderExactRatioTruncated(
        removalSensitivityBps,
        REPORTED_FRACTIONAL_DIGITS,
      ),
    },
  });
}

export function replayRapidPriceLift(
  input: readonly unknown[],
  manifest: CaseManifest,
): RapidPriceLiftReplay {
  const { events, duplicateCount } = canonicalizeEvents(input);
  const evaluation = evaluateRapidPriceLift(events, manifest);
  return {
    engineVersion: ENGINE_VERSION,
    inputEventCount: input.length,
    canonicalEventCount: events.length,
    duplicateCount,
    orderedEventIds: events.map(({ eventId }) => eventId),
    canonicalResultHash: canonicalReplayResultHash(events, evaluation),
    events,
    evaluation,
  };
}
