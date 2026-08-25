import { z } from "zod";

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const EvidenceBundleSchema = z
  .object({
    bundleVersion: z.literal("1.0"),
    caseId: z.string().min(1),
    datasetHash: HashSchema,
    manifestHash: HashSchema,
    engineVersion: z.string().min(1),
    ruleVersion: z.string().min(1),
    result: z.enum(["SUPPORTED", "NOT_SUPPORTED", "INCONCLUSIVE"]),
    findings: z.array(
      z
        .object({
          ruleId: z.string().min(1),
          observedValue: z.string(),
          threshold: z.string(),
          passed: z.boolean(),
          referencedEventIds: z.array(z.string().min(1)).min(1),
        })
        .strict(),
    ),
    counterfactual: z
      .object({
        originalPriceChangeBps: z.string(),
        withoutSuspectedActorsBps: z.string(),
        attributableDifferenceBps: z.string(),
      })
      .strict(),
    canonicalResultHash: HashSchema,
  })
  .strict();

export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
