import { z } from "zod";

import { ApprovalRecordSchema } from "./approval-record";
import { CaseManifestProposalSchema } from "./case-manifest";
import {
  RapidPriceLiftResultSchema,
  RapidPriceLiftSensitivitySchema,
} from "./rapid-price-lift";
import { SchemaMappingProposalSchema } from "./schema-mapping";
import { TradeEventSchema } from "./trade-event";
import { WorkflowStateSchema } from "./workflow";

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

// A separate opt-in contract: 1.2 consumers and migration checks stay intact.
export const EvidenceBundleV13Schema = z
  .object({
    bundleVersion: z.literal("1.3"),
    sourceArtifacts: z
      .array(z.object({ sourceArtifactHash: HashSchema }).strict())
      .min(1),
    mappings: z.array(
      z
        .object({
          proposal: SchemaMappingProposalSchema,
          approval: ApprovalRecordSchema.optional(),
        })
        .strict(),
    ),
    case: z
      .object({
        proposal: CaseManifestProposalSchema,
        approval: ApprovalRecordSchema.optional(),
      })
      .strict()
      .optional(),
    workflowState: WorkflowStateSchema,
    replay: z
      .object({
        engineVersion: z.literal("0.7.0-canonical-decimal"),
        canonicalDatasetHash: HashSchema,
        events: z.array(TradeEventSchema),
        evaluation: RapidPriceLiftResultSchema.optional(),
        canonicalResultHash: HashSchema,
      })
      .strict()
      .optional(),
    bundleHash: HashSchema,
  })
  .strict();

export type EvidenceBundleV13 = z.infer<typeof EvidenceBundleV13Schema>;
