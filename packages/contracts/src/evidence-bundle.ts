import { z } from "zod";

import { RapidPriceLiftSensitivitySchema } from "./rapid-price-lift";

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const EvidenceBundleSchema = z
  .object({
    bundleVersion: z.literal("1.2"),
    caseId: z.string().min(1),
    canonicalDatasetHash: HashSchema,
    sourceArtifacts: z
      .array(
        z
          .object({
            sourceArtifactHash: HashSchema,
          })
          .strict(),
      )
      .min(1),
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
    sensitivity: RapidPriceLiftSensitivitySchema,
    canonicalResultHash: HashSchema,
  })
  .strict();

export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
