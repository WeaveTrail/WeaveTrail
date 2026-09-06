import { z } from "zod";

const DecimalStringSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const NonnegativeDecimalStringSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const UnsignedIntegerStringSchema = z.string().regex(/^(?:0|[1-9]\d*)$/);
const PositiveIntegerStringSchema = z.string().regex(/^[1-9]\d*$/);

const CrossMarketSessionReversalParametersSchema = z
  .object({
    analysedDate: z.iso.date(),
    baselineRange: z
      .object({
        startDate: z.iso.date(),
        endDateInclusive: z.iso.date(),
      })
      .strict(),
    baselineLegId: z.string().min(1),
    legs: z
      .array(
        z
          .object({
            legId: z.string().min(1),
            instrumentId: z.string().min(1),
            minimumReversalMultiple: NonnegativeDecimalStringSchema,
          })
          .strict(),
      )
      .min(2),
    maximumBaselineRank: PositiveIntegerStringSchema,
    minimumAgreeingLegs: PositiveIntegerStringSchema,
  })
  .strict()
  .superRefine((parameters, context) => {
    const legIds = parameters.legs.map(({ legId }) => legId);
    const instrumentIds = parameters.legs.map(
      ({ instrumentId }) => instrumentId,
    );
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
    if (
      BigInt(parameters.minimumAgreeingLegs) > BigInt(parameters.legs.length)
    ) {
      context.addIssue({
        code: "custom",
        path: ["minimumAgreeingLegs"],
        message:
          "The agreeing-leg threshold cannot exceed the declared leg count",
      });
    }
  });

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
    "1.0": CrossMarketSessionReversalParametersSchema,
  },
} as const;

export const RapidPriceLiftRuleConfigurationSchema = z
  .object({
    ruleId: z.literal("RAPID_PRICE_LIFT"),
    ruleVersion: z.literal("1.1"),
    parameters: RULE_PARAMETER_SCHEMAS.RAPID_PRICE_LIFT["1.1"],
  })
  .strict();

export const CrossMarketSessionReversalRuleConfigurationSchema = z
  .object({
    ruleId: z.literal("CROSS_MARKET_SESSION_REVERSAL"),
    ruleVersion: z.literal("1.0"),
    parameters: RULE_PARAMETER_SCHEMAS.CROSS_MARKET_SESSION_REVERSAL["1.0"],
  })
  .strict();

export const RuleConfigurationSchema = z.discriminatedUnion("ruleId", [
  RapidPriceLiftRuleConfigurationSchema,
  CrossMarketSessionReversalRuleConfigurationSchema,
]);

export type RuleConfiguration = z.infer<typeof RuleConfigurationSchema>;
