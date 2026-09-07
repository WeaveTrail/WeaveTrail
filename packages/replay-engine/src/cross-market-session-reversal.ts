import {
  CROSS_MARKET_REPORTED_FRACTIONAL_DIGITS,
  CrossMarketSessionReversalResultSchema,
  type CaseManifestV14,
  type CrossMarketSessionReversalFinding,
  type CrossMarketSessionReversalInconclusiveReason,
  type CrossMarketSessionReversalResult,
  type CrossMarketSessionReversalSensitivity,
  type RuleConfiguration,
  type TradeEvent,
} from "@weavetrail/contracts";

import { canonicalizeEvents } from "./canonicalize";
import { compareCanonicalEventTimes } from "./canonical-order";
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
  "0.9.0-denominator-substitution-sensitivity";
const CROSS_MARKET_ENGINE_V10_VERSION = "0.8.0-cross-market-session-reversal";
const ZERO = parseScaledDecimal("0");

type Rule = Extract<
  RuleConfiguration,
  { ruleId: "CROSS_MARKET_SESSION_REVERSAL" }
>;
type RuleV11 = Extract<Rule, { ruleVersion: "1.1" }>;
type DailyQuote = Extract<TradeEvent, { schemaVersion: "1.3" }>;
type Leg = {
  legId: string;
  instrumentId: string;
  minimumReversalMultiple: string;
};
type LegV11 = RuleV11["parameters"]["legs"][number];
type Denominator = LegV11["denominators"][number];

type DerivedObservation = {
  event: DailyQuote;
  reversal: ScaledDecimal;
  denominator: ScaledDecimal;
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

function reportedDenominatorSource(denominator: Denominator) {
  return denominator.source.kind === "EVENT_FIELD"
    ? { kind: "EVENT_FIELD" as const, field: denominator.source.field }
    : {
        kind: "DECLARED_VALUE" as const,
        provenance: denominator.source.provenance,
      };
}

function buildSensitivity(
  analysed: readonly { leg: LegV11; observation: DerivedObservation }[],
): CrossMarketSessionReversalSensitivity {
  return {
    comparison: "MECHANICAL_METRIC_COMPARISON",
    interpretation: "MECHANICAL_RECOMPUTATION_NOT_CAUSAL_CONCLUSION",
    legs: analysed.map(({ leg, observation }) => {
      const approved = approvedDenominator(leg)!;
      const approvedValue = eventDenominatorValue(observation.event, approved)!;
      const metric = (denominator: Denominator) => {
        const denominatorValue = eventDenominatorValue(
          observation.event,
          denominator,
        )!;
        return {
          denominatorId: denominator.denominatorId,
          denominatorValue: renderScaledDecimal(denominatorValue),
          meaning: denominator.meaning,
          source: reportedDenominatorSource(denominator),
          metricValue: renderExactRatioTruncated(
            ratio(observation.reversal, denominatorValue),
            CROSS_MARKET_REPORTED_FRACTIONAL_DIGITS,
          ),
        };
      };
      const approvedMetric = metric(approved);
      return {
        legId: leg.legId,
        instrumentId: leg.instrumentId,
        eventId: observation.event.eventId,
        approved: approvedMetric,
        alternatives: leg.denominators
          .filter(
            ({ denominatorId }) => denominatorId !== leg.approvedDenominatorId,
          )
          .map((alternative) => {
            const alternativeMetric = metric(alternative);
            const bothMetricsZero =
              compareScaledDecimals(
                parseScaledDecimal(approvedMetric.metricValue),
                ZERO,
              ) === 0 &&
              compareScaledDecimals(
                parseScaledDecimal(alternativeMetric.metricValue),
                ZERO,
              ) === 0;
            return {
              ...alternativeMetric,
              ratioToApprovedMetric: bothMetricsZero
                ? null
                : renderExactRatioTruncated(
                    ratio(
                      approvedValue,
                      eventDenominatorValue(observation.event, alternative)!,
                    ),
                    CROSS_MARKET_REPORTED_FRACTIONAL_DIGITS,
                  ),
              ...(bothMetricsZero
                ? { ratioUnavailableReason: "BOTH_METRICS_ZERO" as const }
                : {}),
            };
          }),
      };
    }),
  };
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

function eventDenominatorValue(
  event: DailyQuote,
  denominator: Denominator,
): ScaledDecimal | undefined {
  if (denominator.source.kind === "DECLARED_VALUE") {
    return parseScaledDecimal(denominator.source.value);
  }
  const value = event[denominator.source.field];
  if (typeof value !== "string") return undefined;
  const parsed = parseScaledDecimal(value);
  return denominator.source.field === "netChange" ? absolute(parsed) : parsed;
}

function approvedDenominator(leg: Leg | LegV11): Denominator | undefined {
  if (!("approvedDenominatorId" in leg)) return undefined;
  return leg.denominators.find(
    ({ denominatorId }) => denominatorId === leg.approvedDenominatorId,
  );
}

function usesEventPriceDenominator(leg: Leg | LegV11): boolean {
  return (
    "approvedDenominatorId" in leg &&
    leg.denominators.some(
      (denominator) =>
        denominator.source.kind === "EVENT_FIELD" &&
        denominator.source.field === "price",
    )
  );
}

function denominatorIssue(
  event: DailyQuote,
  denominator: Denominator,
):
  | "DECLARED_DENOMINATOR_FIELD_ABSENT"
  | "NON_POSITIVE_DECLARED_DENOMINATOR"
  | undefined {
  const value = eventDenominatorValue(event, denominator);
  if (value === undefined) return "DECLARED_DENOMINATOR_FIELD_ABSENT";
  return compareScaledDecimals(value, ZERO) <= 0
    ? "NON_POSITIVE_DECLARED_DENOMINATOR"
    : undefined;
}

function deriveObservation(
  event: DailyQuote,
  denominator?: Denominator,
): DerivedObservation | undefined {
  if (!dailyQuoteIsValid(event)) return undefined;
  const open = parseScaledDecimal(event.openPrice);
  const high = parseScaledDecimal(event.highPrice);
  const low = parseScaledDecimal(event.lowPrice);
  const close = parseScaledDecimal(event.closePrice);
  const netChange = parseScaledDecimal(event.netChange);
  if (compareScaledDecimals(netChange, ZERO) === 0) return undefined;
  const denominatorValue =
    denominator === undefined
      ? absolute(netChange)
      : eventDenominatorValue(event, denominator);
  if (
    denominatorValue === undefined ||
    compareScaledDecimals(denominatorValue, ZERO) <= 0
  )
    return undefined;

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
    denominator: denominatorValue,
    multiple: ratio(reversal, denominatorValue),
    relation,
  };
}

function inconclusive(
  reason: CrossMarketSessionReversalInconclusiveReason,
  ruleVersion: Rule["ruleVersion"],
): CrossMarketSessionReversalResult {
  const shared = {
    ruleId: "CROSS_MARKET_SESSION_REVERSAL",
    ruleVersion,
    result: "INCONCLUSIVE",
    reason,
    findings: [],
    analysis: null,
  } as const;
  return CrossMarketSessionReversalResultSchema.parse(
    ruleVersion === "1.1" ? { ...shared, sensitivity: null } : shared,
  );
}

function configuredRule(manifest: CaseManifestV14): Rule {
  const rules = manifest.rules.filter(
    (rule): rule is Rule => rule.ruleId === "CROSS_MARKET_SESSION_REVERSAL",
  );
  if (
    manifest.hypothesis.pattern !== "CROSS_MARKET_SESSION_REVERSAL" ||
    rules.length !== 1 ||
    manifest.rules.length !== 1
  ) {
    throw new CrossMarketRuleError(
      "RULE_CONFIGURATION_REQUIRED",
      "Exactly one approved CROSS_MARKET_SESSION_REVERSAL rule configuration is required",
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
    return inconclusive(
      "ANALYSED_DATE_OUTSIDE_BASELINE_RANGE",
      rule.ruleVersion,
    );
  }

  const caseEvents = canonicalEvents.filter(
    ({ eventTime }) =>
      compareCanonicalEventTimes(eventTime, manifest.hypothesis.startTime) >=
        0 &&
      compareCanonicalEventTimes(eventTime, manifest.hypothesis.endTime) <= 0,
  );
  const groups = quoteGroups(caseEvents);
  const baselineLeg = rule.parameters.legs.find(
    ({ legId }) => legId === rule.parameters.baselineLegId,
  )!;
  const baselineEvents = caseEvents.filter(
    (event): event is DailyQuote =>
      event.schemaVersion === "1.3" &&
      event.instrumentId === baselineLeg.instrumentId &&
      event.tradingDate >= baselineRange.startDate &&
      event.tradingDate <= baselineRange.endDateInclusive,
  );
  if (baselineEvents.length === 0)
    return inconclusive("EMPTY_BASELINE", rule.ruleVersion);
  if (new Set(baselineEvents.map(({ tradingDate }) => tradingDate)).size < 2) {
    return inconclusive("INSUFFICIENT_BASELINE_POPULATION", rule.ruleVersion);
  }
  for (const date of new Set(
    baselineEvents.map(({ tradingDate }) => tradingDate),
  )) {
    if (group(groups, baselineLeg.instrumentId, date).length !== 1) {
      return inconclusive("AMBIGUOUS_DAILY_OBSERVATION", rule.ruleVersion);
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
        rule.ruleVersion,
      );
    }
    if (matches.length > 1)
      return inconclusive("AMBIGUOUS_DAILY_OBSERVATION", rule.ruleVersion);
    const event = matches[0]!;
    if (!dailyQuoteIsValid(event))
      return inconclusive("INVALID_DAILY_QUOTE_RANGE", rule.ruleVersion);
    if (
      compareScaledDecimals(parseScaledDecimal(event.netChange), ZERO) === 0
    ) {
      return inconclusive("ZERO_NET_CHANGE", rule.ruleVersion);
    }
    if ("denominators" in leg) {
      for (const denominator of leg.denominators) {
        const issue = denominatorIssue(event, denominator);
        if (issue !== undefined) return inconclusive(issue, rule.ruleVersion);
      }
    }
    const observation = deriveObservation(event, approvedDenominator(leg));
    if (!observation)
      return inconclusive("INCOMPLETE_DAILY_QUOTE", rule.ruleVersion);
    analysed.push({ leg, observation });
  }

  const population: DerivedObservation[] = [];
  for (const event of baselineEvents) {
    if (!dailyQuoteIsValid(event))
      return inconclusive("INVALID_DAILY_QUOTE_RANGE", rule.ruleVersion);
    if (compareScaledDecimals(parseScaledDecimal(event.netChange), ZERO) === 0)
      continue;
    const denominator = approvedDenominator(baselineLeg);
    if (denominator !== undefined) {
      const issue = denominatorIssue(event, denominator);
      if (issue !== undefined) return inconclusive(issue, rule.ruleVersion);
    }
    const observation = deriveObservation(event, denominator);
    if (observation) population.push(observation);
  }
  if (population.length < 2)
    return inconclusive("INSUFFICIENT_BASELINE_POPULATION", rule.ruleVersion);
  const target = analysed.find(
    ({ leg }) => leg.legId === baselineLeg.legId,
  )!.observation;
  if (!population.some(({ event }) => event.eventId === target.event.eventId)) {
    return inconclusive("ANALYSED_DATE_ABSENT", rule.ruleVersion);
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
        CROSS_MARKET_REPORTED_FRACTIONAL_DIGITS,
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

  const result =
    rankFinding.passed && agreeingFinding.passed
      ? "SUPPORTED"
      : "NOT_SUPPORTED";
  const analysis = {
    analysedDate,
    baselineRange,
    rank: {
      position: String(rank),
      populationSize: String(population.length),
      interpretation: "POSITION_WITHIN_DECLARED_RANGE_NOT_PROBABILITY" as const,
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
        CROSS_MARKET_REPORTED_FRACTIONAL_DIGITS,
      ),
      ...(usesEventPriceDenominator(leg)
        ? { price: observation.event.price }
        : {}),
      ...(approvedDenominator(leg) === undefined
        ? {}
        : {
            approvedDenominatorId: (leg as LegV11).approvedDenominatorId,
            approvedDenominatorValue: renderScaledDecimal(
              observation.denominator,
            ),
          }),
    })),
    candidateSelection: "STATED_DATE_ONLY_NO_CANDIDATE_SCAN" as const,
  };
  const shared = {
    ruleId: "CROSS_MARKET_SESSION_REVERSAL",
    ruleVersion: rule.ruleVersion,
    result,
    findings,
    analysis,
  } as const;
  return CrossMarketSessionReversalResultSchema.parse(
    rule.ruleVersion === "1.1"
      ? {
          ...shared,
          sensitivity: buildSensitivity(
            analysed as { leg: LegV11; observation: DerivedObservation }[],
          ),
        }
      : shared,
  );
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
  const engineVersion =
    evaluation.ruleVersion === "1.0"
      ? CROSS_MARKET_ENGINE_V10_VERSION
      : CROSS_MARKET_ENGINE_VERSION;
  return {
    engineVersion,
    inputEventCount: input.length,
    canonicalEventCount: events.length,
    duplicateCount,
    orderedEventIds: events.map(({ eventId }) => eventId),
    canonicalResultHash: canonicalReplayResultHash(
      events,
      evaluation,
      engineVersion,
    ),
    events,
    evaluation,
  };
}
