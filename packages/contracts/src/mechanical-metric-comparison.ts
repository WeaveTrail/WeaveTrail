import { z } from "zod";

export const MechanicalMetricComparisonSchema = z.literal(
  "MECHANICAL_METRIC_COMPARISON",
);

export type MechanicalMetricComparison = z.infer<
  typeof MechanicalMetricComparisonSchema
>;
