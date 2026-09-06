import { z } from "zod";

import { DecimalStringSchema } from "./decimal-string";

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

const ResultFields = {
  ruleId: z.literal("CROSS_MARKET_SESSION_REVERSAL"),
  ruleVersion: z.literal("1.0"),
} as const;

export const CrossMarketSessionReversalResultSchema = z.discriminatedUnion(
  "result",
  [
    z
      .object({
        ...ResultFields,
        result: z.enum(["SUPPORTED", "NOT_SUPPORTED"]),
        findings: z.array(CrossMarketSessionReversalFindingSchema).min(4),
        analysis: CrossMarketSessionReversalAnalysisSchema,
      })
      .strict(),
    z
      .object({
        ...ResultFields,
        result: z.literal("INCONCLUSIVE"),
        reason: CrossMarketSessionReversalInconclusiveReasonSchema,
        findings: z.array(CrossMarketSessionReversalFindingSchema).length(0),
        analysis: z.null(),
      })
      .strict(),
  ],
);

export type CrossMarketSessionReversalGate = z.infer<
  typeof CrossMarketSessionReversalGateSchema
>;
export type CrossMarketSessionReversalInconclusiveReason = z.infer<
  typeof CrossMarketSessionReversalInconclusiveReasonSchema
>;
export type CrossMarketSessionReversalFinding = z.infer<
  typeof CrossMarketSessionReversalFindingSchema
>;
export type CrossMarketSessionReversalResult = z.infer<
  typeof CrossMarketSessionReversalResultSchema
>;
