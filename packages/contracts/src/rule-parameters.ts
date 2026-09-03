import { z } from "zod";

const DecimalStringSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const UnsignedIntegerStringSchema = z.string().regex(/^(?:0|[1-9]\d*)$/);

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
} as const;

export const RuleConfigurationSchema = z.discriminatedUnion("ruleId", [
  z
    .object({
      ruleId: z.literal("RAPID_PRICE_LIFT"),
      ruleVersion: z.literal("1.1"),
      parameters: RULE_PARAMETER_SCHEMAS.RAPID_PRICE_LIFT["1.1"],
    })
    .strict(),
]);

export type RuleConfiguration = z.infer<typeof RuleConfigurationSchema>;
