import { z } from "zod";

import { DecimalStringSchema } from "./decimal-string";
import { MechanicalMetricComparisonSchema } from "./mechanical-metric-comparison";
import {
  CrossMarketDenominatorFieldSchema,
  CrossMarketDenominatorMeaningSchema,
} from "./rule-parameters";

const PositiveIntegerStringSchema = z.string().regex(/^[1-9]\d*$/);

export const CrossMarketSessionReversalGateSchema = z.enum([
  "BASELINE_RANK",
  "LEG_REVERSAL_MULTIPLE",
  "AGREEING_LEGS",
]);

export const CrossMarketSessionReversalInconclusiveReasonSchema = z.enum([
  "EMPTY_BASELINE",
  "INSUFFICIENT_BASELINE_POPULATION",
  "ANALYSED_DATE_OUTSIDE_BASELINE_RANGE",
  "ANALYSED_DATE_ABSENT",
  "DECLARED_LEG_ABSENT",
  "AMBIGUOUS_DAILY_OBSERVATION",
  "INCOMPLETE_DAILY_QUOTE",
  "INVALID_DAILY_QUOTE_RANGE",
  "ZERO_NET_CHANGE",
  "DECLARED_DENOMINATOR_FIELD_ABSENT",
  "ZERO_DECLARED_DENOMINATOR",
]);

export const CrossMarketSessionReversalFindingSchema = z
  .object({
    gate: CrossMarketSessionReversalGateSchema,
    ruleId: z.literal("CROSS_MARKET_SESSION_REVERSAL"),
    legId: z.string().min(1).optional(),
    instrumentId: z.string().min(1).optional(),
    observedValue: DecimalStringSchema,
    threshold: DecimalStringSchema,
    passed: z.boolean(),
    referencedEventIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const CrossMarketSessionReversalLegObservationSchema = z
  .object({
    legId: z.string().min(1),
    instrumentId: z.string().min(1),
    eventId: z.string().min(1),
    openPrice: DecimalStringSchema,
    highPrice: DecimalStringSchema,
    lowPrice: DecimalStringSchema,
    closePrice: DecimalStringSchema,
    sessionReversal: DecimalStringSchema,
    netChange: DecimalStringSchema,
    relation: z.enum(["OPPOSED", "ALIGNED", "FLAT"]),
    reversalMultiple: DecimalStringSchema,
  })
  .strict();

const CrossMarketSessionReversalLegObservationV11Schema =
  CrossMarketSessionReversalLegObservationSchema.extend({
    approvedDenominatorId: z.string().min(1),
    approvedDenominatorValue: DecimalStringSchema,
  }).strict();

const DenominatorSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("EVENT_FIELD"),
      field: CrossMarketDenominatorFieldSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("DECLARED_VALUE"),
      provenance: z.string().min(1),
    })
    .strict(),
]);

const DenominatorMetricSchema = z
  .object({
    denominatorId: z.string().min(1),
    denominatorValue: DecimalStringSchema,
    meaning: CrossMarketDenominatorMeaningSchema,
    source: DenominatorSourceSchema,
    metricValue: DecimalStringSchema,
  })
  .strict();

const AlternativeDenominatorMetricSchema = DenominatorMetricSchema.extend({
  ratioToApprovedMetric: DecimalStringSchema.nullable(),
  ratioUnavailableReason: z.literal("BOTH_METRICS_ZERO").optional(),
})
  .strict()
  .superRefine((metric, context) => {
    if (
      (metric.ratioToApprovedMetric === null) !==
      (metric.ratioUnavailableReason === "BOTH_METRICS_ZERO")
    ) {
      context.addIssue({
        code: "custom",
        path: ["ratioToApprovedMetric"],
        message:
          "A null metric ratio requires the BOTH_METRICS_ZERO explanation",
      });
    }
  });

export const CrossMarketSessionReversalSensitivitySchema = z
  .object({
    comparison: MechanicalMetricComparisonSchema,
    interpretation: z.literal("MECHANICAL_RECOMPUTATION_NOT_CAUSAL_CONCLUSION"),
    legs: z
      .array(
        z
          .object({
            legId: z.string().min(1),
            instrumentId: z.string().min(1),
            eventId: z.string().min(1),
            approved: DenominatorMetricSchema,
            alternatives: z.array(AlternativeDenominatorMetricSchema).min(1),
          })
          .strict(),
      )
      .min(2),
  })
  .strict();

export const CrossMarketSessionReversalAnalysisSchema = z
  .object({
    analysedDate: z.iso.date(),
    baselineRange: z
      .object({
        startDate: z.iso.date(),
        endDateInclusive: z.iso.date(),
      })
      .strict(),
    rank: z
      .object({
        position: PositiveIntegerStringSchema,
        populationSize: PositiveIntegerStringSchema,
        interpretation: z.literal(
          "POSITION_WITHIN_DECLARED_RANGE_NOT_PROBABILITY",
        ),
      })
      .strict(),
    legs: z.array(CrossMarketSessionReversalLegObservationSchema).min(2),
    candidateSelection: z.literal("STATED_DATE_ONLY_NO_CANDIDATE_SCAN"),
  })
  .strict();

const CrossMarketSessionReversalAnalysisV11Schema =
  CrossMarketSessionReversalAnalysisSchema.extend({
    legs: z.array(CrossMarketSessionReversalLegObservationV11Schema).min(2),
  }).strict();

const ResultFieldsV10 = {
  ruleId: z.literal("CROSS_MARKET_SESSION_REVERSAL"),
  ruleVersion: z.literal("1.0"),
} as const;

export const CrossMarketSessionReversalResultV10Schema = z.discriminatedUnion(
  "result",
  [
    z
      .object({
        ...ResultFieldsV10,
        result: z.enum(["SUPPORTED", "NOT_SUPPORTED"]),
        findings: z.array(CrossMarketSessionReversalFindingSchema).min(4),
        analysis: CrossMarketSessionReversalAnalysisSchema,
      })
      .strict(),
    z
      .object({
        ...ResultFieldsV10,
        result: z.literal("INCONCLUSIVE"),
        reason: CrossMarketSessionReversalInconclusiveReasonSchema,
        findings: z.array(CrossMarketSessionReversalFindingSchema).length(0),
        analysis: z.null(),
      })
      .strict(),
  ],
);

const ResultFieldsV11 = {
  ruleId: z.literal("CROSS_MARKET_SESSION_REVERSAL"),
  ruleVersion: z.literal("1.1"),
} as const;

export const CrossMarketSessionReversalResultV11Schema = z.discriminatedUnion(
  "result",
  [
    z
      .object({
        ...ResultFieldsV11,
        result: z.enum(["SUPPORTED", "NOT_SUPPORTED"]),
        findings: z.array(CrossMarketSessionReversalFindingSchema).min(4),
        analysis: CrossMarketSessionReversalAnalysisV11Schema,
        sensitivity: CrossMarketSessionReversalSensitivitySchema,
      })
      .strict(),
    z
      .object({
        ...ResultFieldsV11,
        result: z.literal("INCONCLUSIVE"),
        reason: CrossMarketSessionReversalInconclusiveReasonSchema,
        findings: z.array(CrossMarketSessionReversalFindingSchema).length(0),
        analysis: z.null(),
        sensitivity: z.null(),
      })
      .strict(),
  ],
);

export const CrossMarketSessionReversalResultSchema = z.union([
  CrossMarketSessionReversalResultV10Schema,
  CrossMarketSessionReversalResultV11Schema,
]);

export type CrossMarketSessionReversalGate = z.infer<
  typeof CrossMarketSessionReversalGateSchema
>;
export type CrossMarketSessionReversalInconclusiveReason = z.infer<
  typeof CrossMarketSessionReversalInconclusiveReasonSchema
>;
export type CrossMarketSessionReversalFinding = z.infer<
  typeof CrossMarketSessionReversalFindingSchema
>;
export type CrossMarketSessionReversalSensitivity = z.infer<
  typeof CrossMarketSessionReversalSensitivitySchema
>;
export type CrossMarketSessionReversalResult = z.infer<
  typeof CrossMarketSessionReversalResultSchema
>;
