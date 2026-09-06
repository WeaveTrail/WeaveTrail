import {
  CrossMarketSessionReversalResultSchema,
  type CaseManifestV14,
  type CrossMarketSessionReversalFinding,
  type CrossMarketSessionReversalInconclusiveReason,
  type CrossMarketSessionReversalResult,
  type RuleConfiguration,
  type TradeEvent,
} from "@weavetrail/contracts";

import { canonicalizeEvents } from "./canonicalize";
import { computeDatasetProfile } from "./dataset-profile";
import {
  canonicalReplayResultHash,
  type FoundationReplay,
} from "./replay-foundation";
import {
  type ApprovalIssueCode,
  validateCaseManifestApproval,
} from "./approval-validation";
import {
  compareExactRatioToDecimal,
  compareScaledDecimals,
  parseScaledDecimal,
  renderExactRatioTruncated,
  renderScaledDecimal,
  subtractScaledDecimals,
  type ExactRatio,
  type ScaledDecimal,
} from "./scaled-decimal";
import {
  validateCaseAgainstProfile,
  type CaseProfileIssueCode,
} from "./case-validation";

export const CROSS_MARKET_ENGINE_VERSION =
  "0.8.0-cross-market-session-reversal";
const ZERO = parseScaledDecimal("0");
const REPORTED_FRACTIONAL_DIGITS = 4n;

type Rule = Extract<
  RuleConfiguration,
  { ruleId: "CROSS_MARKET_SESSION_REVERSAL" }
>;
type DailyQuote = Extract<TradeEvent, { schemaVersion: "1.3" }>;
type Leg = Rule["parameters"]["legs"][number];

type DerivedObservation = {
  event: DailyQuote;
  reversal: ScaledDecimal;
  multiple: ExactRatio;
  relation: "OPPOSED" | "ALIGNED" | "FLAT";
};

export class CrossMarketRuleError extends Error {
  constructor(
    readonly code:
      "RULE_CONFIGURATION_REQUIRED" | ApprovalIssueCode | CaseProfileIssueCode,
    message: string,
  ) {
    super(message);
    this.name = "CrossMarketRuleError";
  }
}

export type CrossMarketSessionReversalReplay = FoundationReplay & {
  evaluation: CrossMarketSessionReversalResult;
};

function absolute(value: ScaledDecimal): ScaledDecimal {
  return value.coefficient < 0n
    ? { coefficient: -value.coefficient, scale: value.scale }
    : value;
}

function ratio(
  numerator: ScaledDecimal,
  denominator: ScaledDecimal,
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
    numerator: numeratorCoefficient,
    denominator: denominatorCoefficient,
  };
}

function compareRatios(left: ExactRatio, right: ExactRatio): -1 | 0 | 1 {
  const difference =
    left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function dailyQuoteIsValid(event: DailyQuote): boolean {
  const open = parseScaledDecimal(event.openPrice);
  const high = parseScaledDecimal(event.highPrice);
  const low = parseScaledDecimal(event.lowPrice);
  const close = parseScaledDecimal(event.closePrice);
  return (
    compareScaledDecimals(open, ZERO) > 0 &&
    compareScaledDecimals(high, open) >= 0 &&
    compareScaledDecimals(high, close) >= 0 &&
    compareScaledDecimals(low, open) <= 0 &&
    compareScaledDecimals(low, close) <= 0 &&
    compareScaledDecimals(low, ZERO) > 0
  );
}

function deriveObservation(event: DailyQuote): DerivedObservation | undefined {
  if (!dailyQuoteIsValid(event)) return undefined;
  const open = parseScaledDecimal(event.openPrice);
  const high = parseScaledDecimal(event.highPrice);
  const low = parseScaledDecimal(event.lowPrice);
  const close = parseScaledDecimal(event.closePrice);
  const netChange = parseScaledDecimal(event.netChange);
  if (compareScaledDecimals(netChange, ZERO) === 0) return undefined;

  const sessionDirection = compareScaledDecimals(close, open);
  const netDirection = compareScaledDecimals(netChange, ZERO);
  const reversal =
    sessionDirection < 0
      ? subtractScaledDecimals(high, close)
      : sessionDirection > 0
        ? subtractScaledDecimals(close, low)
        : ZERO;
  const relation =
    sessionDirection === 0
      ? "FLAT"
      : sessionDirection === netDirection
        ? "ALIGNED"
        : "OPPOSED";
  return {
    event,
    reversal,
    multiple: ratio(reversal, absolute(netChange)),
    relation,
  };
}

function inconclusive(
  reason: CrossMarketSessionReversalInconclusiveReason,
): CrossMarketSessionReversalResult {
  return CrossMarketSessionReversalResultSchema.parse({
    ruleId: "CROSS_MARKET_SESSION_REVERSAL",
    ruleVersion: "1.0",
    result: "INCONCLUSIVE",
    reason,
    findings: [],
    analysis: null,
  });
}

function configuredRule(manifest: CaseManifestV14): Rule {
  const rules = manifest.rules.filter(
    (rule): rule is Rule =>
      rule.ruleId === "CROSS_MARKET_SESSION_REVERSAL" &&
      rule.ruleVersion === "1.0",
  );
  if (
    manifest.hypothesis.pattern !== "CROSS_MARKET_SESSION_REVERSAL" ||
    rules.length !== 1 ||
    manifest.rules.length !== 1
  ) {
    throw new CrossMarketRuleError(
      "RULE_CONFIGURATION_REQUIRED",
      "Exactly one approved CROSS_MARKET_SESSION_REVERSAL 1.0 rule configuration is required",
    );
  }
  const rule = rules[0]!;
  const declared = new Set(manifest.hypothesis.instrumentIds);
  const configured = new Set(
    rule.parameters.legs.map(({ instrumentId }) => instrumentId),
  );
  if (
    configured.size !== declared.size ||
    [...configured].some((instrumentId) => !declared.has(instrumentId))
  ) {
    throw new CrossMarketRuleError(
      "RULE_CONFIGURATION_REQUIRED",
      "Configured legs must exactly match the manifest instrument declaration",
    );
  }
  return rule;
}

function quoteGroups(events: readonly TradeEvent[]): Map<string, DailyQuote[]> {
  const groups = new Map<string, DailyQuote[]>();
  for (const event of events) {
    if (event.schemaVersion !== "1.3" || event.eventType !== "DAILY_QUOTE")
      continue;
    const key = `${event.instrumentId}\0${event.tradingDate}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return groups;
}

function group(
  groups: Map<string, DailyQuote[]>,
  instrumentId: string,
  date: string,
) {
  return groups.get(`${instrumentId}\0${date}`) ?? [];
}

export function evaluateCrossMarketSessionReversal(
  canonicalEvents: readonly TradeEvent[],
  manifest: CaseManifestV14,
): CrossMarketSessionReversalResult {
  const rule = configuredRule(manifest);
  const { analysedDate, baselineRange } = rule.parameters;
  if (
    analysedDate < baselineRange.startDate ||
    analysedDate > baselineRange.endDateInclusive
  ) {
    return inconclusive("ANALYSED_DATE_OUTSIDE_BASELINE_RANGE");
  }

  const groups = quoteGroups(canonicalEvents);
  const baselineLeg = rule.parameters.legs.find(
    ({ legId }) => legId === rule.parameters.baselineLegId,
  )!;
  const baselineEvents = canonicalEvents.filter(
    (event): event is DailyQuote =>
      event.schemaVersion === "1.3" &&
      event.instrumentId === baselineLeg.instrumentId &&
      event.tradingDate >= baselineRange.startDate &&
      event.tradingDate <= baselineRange.endDateInclusive,
  );
  if (baselineEvents.length === 0) return inconclusive("EMPTY_BASELINE");
  if (new Set(baselineEvents.map(({ tradingDate }) => tradingDate)).size < 2) {
    return inconclusive("INSUFFICIENT_BASELINE_POPULATION");
  }
  for (const date of new Set(
    baselineEvents.map(({ tradingDate }) => tradingDate),
  )) {
    if (group(groups, baselineLeg.instrumentId, date).length !== 1) {
      return inconclusive("AMBIGUOUS_DAILY_OBSERVATION");
    }
  }

  const analysed: { leg: Leg; observation: DerivedObservation }[] = [];
  for (const leg of rule.parameters.legs) {
    const matches = group(groups, leg.instrumentId, analysedDate);
    if (matches.length === 0) {
      return inconclusive(
        leg.legId === baselineLeg.legId
          ? "ANALYSED_DATE_ABSENT"
          : "DECLARED_LEG_ABSENT",
      );
    }
    if (matches.length > 1) return inconclusive("AMBIGUOUS_DAILY_OBSERVATION");
    const event = matches[0]!;
    if (!dailyQuoteIsValid(event))
      return inconclusive("INVALID_DAILY_QUOTE_RANGE");
    if (
      compareScaledDecimals(parseScaledDecimal(event.netChange), ZERO) === 0
    ) {
      return inconclusive("ZERO_NET_CHANGE");
    }
    const observation = deriveObservation(event);
    if (!observation) return inconclusive("INCOMPLETE_DAILY_QUOTE");
    analysed.push({ leg, observation });
  }

  const population: DerivedObservation[] = [];
  for (const event of baselineEvents) {
    if (!dailyQuoteIsValid(event))
      return inconclusive("INVALID_DAILY_QUOTE_RANGE");
    if (compareScaledDecimals(parseScaledDecimal(event.netChange), ZERO) === 0)
      continue;
    const observation = deriveObservation(event);
    if (observation) population.push(observation);
  }
  if (population.length < 2)
    return inconclusive("INSUFFICIENT_BASELINE_POPULATION");
  const target = analysed.find(
    ({ leg }) => leg.legId === baselineLeg.legId,
  )!.observation;
  if (!population.some(({ event }) => event.eventId === target.event.eventId)) {
    return inconclusive("ANALYSED_DATE_ABSENT");
  }
  const rank =
    1 +
    population.filter(
      ({ multiple }) => compareRatios(multiple, target.multiple) > 0,
    ).length;

  const rankFinding: CrossMarketSessionReversalFinding = {
    gate: "BASELINE_RANK",
    ruleId: "CROSS_MARKET_SESSION_REVERSAL",
    legId: baselineLeg.legId,
    instrumentId: baselineLeg.instrumentId,
    observedValue: String(rank),
    threshold: rule.parameters.maximumBaselineRank,
    passed: BigInt(rank) <= BigInt(rule.parameters.maximumBaselineRank),
    referencedEventIds: population.map(({ event }) => event.eventId),
  };
  const legFindings: CrossMarketSessionReversalFinding[] = analysed.map(
    ({ leg, observation }) => ({
      gate: "LEG_REVERSAL_MULTIPLE",
      ruleId: "CROSS_MARKET_SESSION_REVERSAL",
      legId: leg.legId,
      instrumentId: leg.instrumentId,
      observedValue: renderExactRatioTruncated(
        observation.multiple,
        REPORTED_FRACTIONAL_DIGITS,
      ),
      threshold: leg.minimumReversalMultiple,
      passed:
        observation.relation === "OPPOSED" &&
        compareExactRatioToDecimal(
          observation.multiple,
          parseScaledDecimal(leg.minimumReversalMultiple),
        ) >= 0,
      referencedEventIds: [observation.event.eventId],
    }),
  );
  const agreeing = legFindings.filter(({ passed }) => passed).length;
  const agreeingFinding: CrossMarketSessionReversalFinding = {
    gate: "AGREEING_LEGS",
    ruleId: "CROSS_MARKET_SESSION_REVERSAL",
    observedValue: String(agreeing),
    threshold: rule.parameters.minimumAgreeingLegs,
    passed: BigInt(agreeing) >= BigInt(rule.parameters.minimumAgreeingLegs),
    referencedEventIds: analysed.map(
      ({ observation }) => observation.event.eventId,
    ),
  };
  const findings = [rankFinding, ...legFindings, agreeingFinding];

  return CrossMarketSessionReversalResultSchema.parse({
    ruleId: "CROSS_MARKET_SESSION_REVERSAL",
    ruleVersion: "1.0",
    result:
      rankFinding.passed && agreeingFinding.passed
        ? "SUPPORTED"
        : "NOT_SUPPORTED",
    findings,
    analysis: {
      analysedDate,
      baselineRange,
      rank: {
        position: String(rank),
        populationSize: String(population.length),
        interpretation: "POSITION_WITHIN_DECLARED_RANGE_NOT_PROBABILITY",
      },
      legs: analysed.map(({ leg, observation }) => ({
        legId: leg.legId,
        instrumentId: leg.instrumentId,
        eventId: observation.event.eventId,
        openPrice: observation.event.openPrice,
        highPrice: observation.event.highPrice,
        lowPrice: observation.event.lowPrice,
        closePrice: observation.event.closePrice,
        sessionReversal: renderScaledDecimal(observation.reversal),
        netChange: observation.event.netChange,
        relation: observation.relation,
        reversalMultiple: renderExactRatioTruncated(
          observation.multiple,
          REPORTED_FRACTIONAL_DIGITS,
        ),
      })),
      candidateSelection: "STATED_DATE_ONLY_NO_CANDIDATE_SCAN",
    },
  });
}

export function replayCrossMarketSessionReversal(
  input: readonly unknown[],
  manifest: CaseManifestV14,
): CrossMarketSessionReversalReplay {
  const approval = validateCaseManifestApproval(manifest);
  if (!approval.accepted) {
    const issue = approval.issues[0]!;
    throw new CrossMarketRuleError(
      issue.code,
      issue.message ??
        `Case manifest approval failed at ${JSON.stringify(issue.path)}`,
    );
  }
  const { events, duplicateCount } = canonicalizeEvents(input);
  const validation = validateCaseAgainstProfile(
    manifest,
    computeDatasetProfile(events),
  );
  if (!validation.accepted) {
    const issue = validation.issues[0]!;
    throw new CrossMarketRuleError(
      issue.code,
      `Case manifest is outside the canonical dataset profile at ${JSON.stringify(issue.path)}`,
    );
  }
  const evaluation = evaluateCrossMarketSessionReversal(events, manifest);
  return {
    engineVersion: CROSS_MARKET_ENGINE_VERSION,
    inputEventCount: input.length,
    canonicalEventCount: events.length,
    duplicateCount,
    orderedEventIds: events.map(({ eventId }) => eventId),
    canonicalResultHash: canonicalReplayResultHash(
      events,
      evaluation,
      CROSS_MARKET_ENGINE_VERSION,
    ),
    events,
    evaluation,
  };
}
