import { z } from "zod";

const DecimalStringSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const NonnegativeDecimalStringSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const UnsignedIntegerStringSchema = z.string().regex(/^(?:0|[1-9]\d*)$/);
const PositiveIntegerStringSchema = z.string().regex(/^[1-9]\d*$/);

export const CrossMarketDenominatorFieldSchema = z.enum([
  "netChange",
  "openPrice",
  "highPrice",
  "lowPrice",
  "closePrice",
  "price",
]);

export const CrossMarketDenominatorMeaningSchema = z.enum([
  "OBSERVED_PRICE_CHANGE",
  "OBSERVED_PRICE_LEVEL",
  "INSTRUMENT_MINIMUM_PRICE_INCREMENT_NOT_TRADE_ESTABLISHED_LEVEL",
]);

const CrossMarketDenominatorSchema = z
  .object({
    denominatorId: z.string().min(1),
    meaning: CrossMarketDenominatorMeaningSchema,
    source: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("EVENT_FIELD"),
          field: CrossMarketDenominatorFieldSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("DECLARED_VALUE"),
          value: NonnegativeDecimalStringSchema.refine(
            (value) => !/^0(?:\.0+)?$/.test(value),
            "A declared denominator must be greater than zero",
          ),
          provenance: z.string().min(1),
        })
        .strict(),
    ]),
  })
  .strict()
  .superRefine((denominator, context) => {
    const valid =
      (denominator.meaning === "OBSERVED_PRICE_CHANGE" &&
        denominator.source.kind === "EVENT_FIELD" &&
        denominator.source.field === "netChange") ||
      (denominator.meaning === "OBSERVED_PRICE_LEVEL" &&
        denominator.source.kind === "EVENT_FIELD" &&
        denominator.source.field !== "netChange") ||
      (denominator.meaning ===
        "INSTRUMENT_MINIMUM_PRICE_INCREMENT_NOT_TRADE_ESTABLISHED_LEVEL" &&
        denominator.source.kind === "DECLARED_VALUE");
    if (!valid) {
      context.addIssue({
        code: "custom",
        path: ["meaning"],
        message: "Denominator meaning must agree with its declared source",
      });
    }
  });

const CrossMarketSessionReversalLegV10Schema = z
  .object({
    legId: z.string().min(1),
    instrumentId: z.string().min(1),
    minimumReversalMultiple: NonnegativeDecimalStringSchema,
  })
  .strict();

const CrossMarketSessionReversalLegV11Schema =
  CrossMarketSessionReversalLegV10Schema.extend({
    approvedDenominatorId: z.string().min(1),
    denominators: z.array(CrossMarketDenominatorSchema).min(2),
  })
    .strict()
    .superRefine((leg, context) => {
      const denominatorIds = leg.denominators.map(
        ({ denominatorId }) => denominatorId,
      );
      if (new Set(denominatorIds).size !== denominatorIds.length) {
        context.addIssue({
          code: "custom",
          path: ["denominators"],
          message: "Denominator identifiers must be unique within a leg",
        });
      }
      if (!denominatorIds.includes(leg.approvedDenominatorId)) {
        context.addIssue({
          code: "custom",
          path: ["approvedDenominatorId"],
          message: "The approved denominator must name a declared denominator",
        });
      }
    });

function refineCrossMarketParameters(
  parameters: {
    baselineRange: { startDate: string; endDateInclusive: string };
    baselineLegId: string;
    legs: { legId: string; instrumentId: string }[];
    minimumAgreeingLegs: string;
  },
  context: z.RefinementCtx,
) {
  const legIds = parameters.legs.map(({ legId }) => legId);
  const instrumentIds = parameters.legs.map(({ instrumentId }) => instrumentId);
  if (new Set(legIds).size !== legIds.length) {
    context.addIssue({
      code: "custom",
      path: ["legs"],
      message: "Leg identifiers must be unique",
    });
  }
  if (new Set(instrumentIds).size !== instrumentIds.length) {
    context.addIssue({
      code: "custom",
      path: ["legs"],
      message: "Leg instruments must be unique",
    });
  }
  if (!legIds.includes(parameters.baselineLegId)) {
    context.addIssue({
      code: "custom",
      path: ["baselineLegId"],
      message: "The baseline leg must name a declared leg",
    });
  }
  if (
    parameters.baselineRange.startDate >
    parameters.baselineRange.endDateInclusive
  ) {
    context.addIssue({
      code: "custom",
      path: ["baselineRange"],
      message: "The baseline range must be ordered",
    });
  }
  if (BigInt(parameters.minimumAgreeingLegs) > BigInt(parameters.legs.length)) {
    context.addIssue({
      code: "custom",
      path: ["minimumAgreeingLegs"],
      message:
        "The agreeing-leg threshold cannot exceed the declared leg count",
    });
  }
}

function crossMarketParameters<
  T extends z.ZodType<{ legId: string; instrumentId: string }>,
>(legSchema: T) {
  return z
    .object({
      analysedDate: z.iso.date(),
      baselineRange: z
        .object({
          startDate: z.iso.date(),
          endDateInclusive: z.iso.date(),
        })
        .strict(),
      baselineLegId: z.string().min(1),
      legs: z.array(legSchema).min(2),
      maximumBaselineRank: PositiveIntegerStringSchema,
      minimumAgreeingLegs: PositiveIntegerStringSchema,
    })
    .strict()
    .superRefine(refineCrossMarketParameters);
}

const CrossMarketSessionReversalParametersV10Schema = crossMarketParameters(
  CrossMarketSessionReversalLegV10Schema,
);
const CrossMarketSessionReversalParametersV11Schema = crossMarketParameters(
  CrossMarketSessionReversalLegV11Schema,
);

export const RULE_PARAMETER_SCHEMAS = {
  RAPID_PRICE_LIFT: {
    "1.1": z
      .object({
        minimumPriceChangeBps: DecimalStringSchema,
        minimumAggressiveBuyShareBps: DecimalStringSchema,
        minimumActorConcentrationShareBps: DecimalStringSchema,
        minimumExecutionsAboveReference: UnsignedIntegerStringSchema,
        minimumRemovalSensitivityBps: DecimalStringSchema,
      })
      .strict(),
  },
  CROSS_MARKET_SESSION_REVERSAL: {
    "1.0": CrossMarketSessionReversalParametersV10Schema,
    "1.1": CrossMarketSessionReversalParametersV11Schema,
  },
} as const;

export const RapidPriceLiftRuleConfigurationSchema = z
  .object({
    ruleId: z.literal("RAPID_PRICE_LIFT"),
    ruleVersion: z.literal("1.1"),
    parameters: RULE_PARAMETER_SCHEMAS.RAPID_PRICE_LIFT["1.1"],
  })
  .strict();

export const CrossMarketSessionReversalRuleConfigurationV10Schema = z
  .object({
    ruleId: z.literal("CROSS_MARKET_SESSION_REVERSAL"),
    ruleVersion: z.literal("1.0"),
    parameters: RULE_PARAMETER_SCHEMAS.CROSS_MARKET_SESSION_REVERSAL["1.0"],
  })
  .strict();

export const CrossMarketSessionReversalRuleConfigurationV11Schema = z
  .object({
    ruleId: z.literal("CROSS_MARKET_SESSION_REVERSAL"),
    ruleVersion: z.literal("1.1"),
    parameters: RULE_PARAMETER_SCHEMAS.CROSS_MARKET_SESSION_REVERSAL["1.1"],
  })
  .strict();

export const CrossMarketSessionReversalRuleConfigurationSchema = z.union([
  CrossMarketSessionReversalRuleConfigurationV10Schema,
  CrossMarketSessionReversalRuleConfigurationV11Schema,
]);

export const RuleConfigurationSchema = z.union([
  RapidPriceLiftRuleConfigurationSchema,
  CrossMarketSessionReversalRuleConfigurationV10Schema,
  CrossMarketSessionReversalRuleConfigurationV11Schema,
]);

export type RuleConfiguration = z.infer<typeof RuleConfigurationSchema>;
