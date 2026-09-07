import { z } from "zod";

import { DecimalStringSchema } from "./decimal-string";
import { MechanicalMetricComparisonSchema } from "./mechanical-metric-comparison";
import {
  CrossMarketDenominatorFieldSchema,
  CrossMarketDenominatorMeaningSchema,
  crossMarketDenominatorMeaningMatchesSource,
} from "./rule-parameters";

const PositiveIntegerStringSchema = z.string().regex(/^[1-9]\d*$/);
const PositiveDecimalStringSchema = DecimalStringSchema.refine(
  (value) => value !== "0" && !value.startsWith("-"),
  "Expected a decimal string greater than zero",
);

export const CrossMarketSessionReversalGateSchema = z.enum([
  "BASELINE_RANK",
  "LEG_REVERSAL_MULTIPLE",
  "AGREEING_LEGS",
]);

const CrossMarketSessionReversalV10InconclusiveReasonSchema = z.enum([
  "EMPTY_BASELINE",
  "INSUFFICIENT_BASELINE_POPULATION",
  "ANALYSED_DATE_OUTSIDE_BASELINE_RANGE",
  "ANALYSED_DATE_ABSENT",
  "DECLARED_LEG_ABSENT",
  "AMBIGUOUS_DAILY_OBSERVATION",
  "INCOMPLETE_DAILY_QUOTE",
  "INVALID_DAILY_QUOTE_RANGE",
  "ZERO_NET_CHANGE",
]);

export const CrossMarketSessionReversalInconclusiveReasonSchema = z.enum([
  ...CrossMarketSessionReversalV10InconclusiveReasonSchema.options,
  "DECLARED_DENOMINATOR_FIELD_ABSENT",
  "NON_POSITIVE_DECLARED_DENOMINATOR",
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
    approvedDenominatorValue: PositiveDecimalStringSchema,
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

const DenominatorMetricFields = {
  denominatorId: z.string().min(1),
  denominatorValue: PositiveDecimalStringSchema,
  meaning: CrossMarketDenominatorMeaningSchema,
  source: DenominatorSourceSchema,
  metricValue: DecimalStringSchema,
} as const;

function refineDenominatorMetric(
  metric: z.infer<z.ZodObject<typeof DenominatorMetricFields>>,
  context: z.RefinementCtx,
) {
  if (!crossMarketDenominatorMeaningMatchesSource(metric)) {
    context.addIssue({
      code: "custom",
      path: ["meaning"],
      message: "Denominator meaning must agree with its declared source",
    });
  }
}

const DenominatorMetricSchema = z
  .object(DenominatorMetricFields)
  .strict()
  .superRefine(refineDenominatorMetric);

const AlternativeDenominatorMetricSchema = z
  .object({
    ...DenominatorMetricFields,
    ratioToApprovedMetric: DecimalStringSchema.nullable(),
    ratioUnavailableReason: z.literal("BOTH_METRICS_ZERO").optional(),
  })
  .strict()
  .superRefine((metric, context) => {
    refineDenominatorMetric(metric, context);
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

const CrossMarketSessionReversalSensitivityLegSchema = z
  .object({
    legId: z.string().min(1),
    instrumentId: z.string().min(1),
    eventId: z.string().min(1),
    approved: DenominatorMetricSchema,
    alternatives: z.array(AlternativeDenominatorMetricSchema).min(1),
  })
  .strict()
  .superRefine((leg, context) => {
    for (const [index, alternative] of leg.alternatives.entries()) {
      const bothMetricsZero =
        leg.approved.metricValue === "0" && alternative.metricValue === "0";
      const reportsBothMetricsZero =
        alternative.ratioUnavailableReason === "BOTH_METRICS_ZERO";
      if (bothMetricsZero !== reportsBothMetricsZero) {
        context.addIssue({
          code: "custom",
          path: ["alternatives", index, "ratioUnavailableReason"],
          message:
            "BOTH_METRICS_ZERO must agree with the approved and alternative metric values",
        });
      }
    }
  });

export const CrossMarketSessionReversalSensitivitySchema = z
  .object({
    comparison: MechanicalMetricComparisonSchema,
    interpretation: z.literal("MECHANICAL_RECOMPUTATION_NOT_CAUSAL_CONCLUSION"),
    legs: z.array(CrossMarketSessionReversalSensitivityLegSchema).min(2),
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
        reason: CrossMarketSessionReversalV10InconclusiveReasonSchema,
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

const CrossMarketSessionReversalConclusiveResultV11Schema = z
  .object({
    ...ResultFieldsV11,
    result: z.enum(["SUPPORTED", "NOT_SUPPORTED"]),
    findings: z.array(CrossMarketSessionReversalFindingSchema).min(4),
    analysis: CrossMarketSessionReversalAnalysisV11Schema,
    sensitivity: CrossMarketSessionReversalSensitivitySchema,
  })
  .strict()
  .superRefine((result, context) => {
    const analysisByLegId = new Map(
      result.analysis.legs.map((leg) => [leg.legId, leg]),
    );
    const sensitivityByLegId = new Map(
      result.sensitivity.legs.map((leg) => [leg.legId, leg]),
    );
    if (analysisByLegId.size !== result.analysis.legs.length) {
      context.addIssue({
        code: "custom",
        path: ["analysis", "legs"],
        message: "Analysis leg identifiers must be unique",
      });
    }
    if (sensitivityByLegId.size !== result.sensitivity.legs.length) {
      context.addIssue({
        code: "custom",
        path: ["sensitivity", "legs"],
        message: "Sensitivity leg identifiers must be unique",
      });
    }
    for (const [index, sensitivityLeg] of result.sensitivity.legs.entries()) {
      const analysisLeg = analysisByLegId.get(sensitivityLeg.legId);
      if (analysisLeg === undefined) {
        context.addIssue({
          code: "custom",
          path: ["sensitivity", "legs", index, "legId"],
          message: "Sensitivity leg must name an analysis leg",
        });
        continue;
      }
      const matches = [
        {
          actual: sensitivityLeg.instrumentId,
          expected: analysisLeg.instrumentId,
          path: "instrumentId",
        },
        {
          actual: sensitivityLeg.eventId,
          expected: analysisLeg.eventId,
          path: "eventId",
        },
        {
          actual: sensitivityLeg.approved.denominatorId,
          expected: analysisLeg.approvedDenominatorId,
          path: "approved.denominatorId",
        },
        {
          actual: sensitivityLeg.approved.denominatorValue,
          expected: analysisLeg.approvedDenominatorValue,
          path: "approved.denominatorValue",
        },
      ];
      for (const match of matches) {
        if (match.actual !== match.expected) {
          context.addIssue({
            code: "custom",
            path: ["sensitivity", "legs", index, ...match.path.split(".")],
            message: `Sensitivity ${match.path} must match its analysis leg`,
          });
        }
      }
    }
    for (const analysisLeg of result.analysis.legs) {
      if (!sensitivityByLegId.has(analysisLeg.legId)) {
        context.addIssue({
          code: "custom",
          path: ["sensitivity", "legs"],
          message: `Sensitivity must include analysis leg ${analysisLeg.legId}`,
        });
      }
    }
  });

export const CrossMarketSessionReversalResultV11Schema = z.discriminatedUnion(
  "result",
  [
    CrossMarketSessionReversalConclusiveResultV11Schema,
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
