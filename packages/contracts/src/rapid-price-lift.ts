import { z } from "zod";

const DecimalStringSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const RapidPriceLiftGateSchema = z.enum([
  "PRICE_CHANGE",
  "AGGRESSIVE_BUY_SHARE",
  "ACTOR_CONCENTRATION",
  "REPEATED_EXECUTION",
  "REMOVAL_SENSITIVITY",
]);

export const RapidPriceLiftInconclusiveReasonSchema = z.enum([
  "INSUFFICIENT_ELIGIBLE_EVENTS",
  "REFERENCE_PRICE_NOT_POSITIVE",
  "TOTAL_NOTIONAL_NOT_POSITIVE",
  "NO_AGGRESSIVE_BUY_NOTIONAL",
  "REMOVAL_LEAVES_INSUFFICIENT_EVENTS",
  "SURVIVOR_REFERENCE_PRICE_NOT_POSITIVE",
]);

export const RapidPriceLiftFindingSchema = z
  .object({
    gate: RapidPriceLiftGateSchema,
    ruleId: z.literal("RAPID_PRICE_LIFT"),
    observedValue: DecimalStringSchema,
    threshold: DecimalStringSchema,
    passed: z.boolean(),
    referencedEventIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const RapidPriceLiftSensitivitySchema = z
  .object({
    comparison: z.literal("MECHANICAL_METRIC_COMPARISON"),
    priceChangeBps: DecimalStringSchema,
    priceChangeBpsWithoutApprovedActors: DecimalStringSchema,
    removalSensitivityBps: DecimalStringSchema,
  })
  .strict();

const RapidPriceLiftResultFields = {
  ruleId: z.literal("RAPID_PRICE_LIFT"),
  ruleVersion: z.literal("1.0"),
  nonComparableEventCount: z.number().int().nonnegative(),
} as const;

export const RapidPriceLiftResultSchema = z.discriminatedUnion("result", [
  z
    .object({
      ...RapidPriceLiftResultFields,
      result: z.enum(["SUPPORTED", "NOT_SUPPORTED"]),
      findings: z.array(RapidPriceLiftFindingSchema).length(5),
      sensitivity: RapidPriceLiftSensitivitySchema,
    })
    .strict(),
  z
    .object({
      ...RapidPriceLiftResultFields,
      result: z.literal("INCONCLUSIVE"),
      reason: RapidPriceLiftInconclusiveReasonSchema,
      findings: z.array(RapidPriceLiftFindingSchema).length(0),
      sensitivity: z.null(),
    })
    .strict(),
]);

export type RapidPriceLiftGate = z.infer<typeof RapidPriceLiftGateSchema>;
export type RapidPriceLiftInconclusiveReason = z.infer<
  typeof RapidPriceLiftInconclusiveReasonSchema
>;
export type RapidPriceLiftFinding = z.infer<typeof RapidPriceLiftFindingSchema>;
export type RapidPriceLiftSensitivity = z.infer<
  typeof RapidPriceLiftSensitivitySchema
>;
export type RapidPriceLiftResult = z.infer<typeof RapidPriceLiftResultSchema>;
