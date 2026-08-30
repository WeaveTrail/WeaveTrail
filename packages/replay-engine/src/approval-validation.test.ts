import { describe, expect, it } from "vitest";

import {
  ApprovalRecordSchema,
  CaseManifestSchema,
  type CaseManifestProposal,
  SchemaMappingProposalSchema,
} from "@weavetrail/contracts";

import { sha256Canonical } from "./canonical-json";
import {
  mappingApprovalArtifact,
  validateReplayApprovals,
} from "./approval-validation";

const mapping = SchemaMappingProposalSchema.parse({
  mappingVersion: "1.1",
  sourceArtifactHash: "a".repeat(64),
  fields: [],
});
const caseProposal: CaseManifestProposal = {
  manifestVersion: "1.2",
  caseId: "synthetic-case",
  canonicalDatasetHash: "b".repeat(64),
  hypothesis: {
    pattern: "RAPID_PRICE_LIFT",
    instrumentId: "WT-DEMO",
    actorIds: ["actor-a"],
    startTime: "2026-08-25T00:00:00Z",
    endTime: "2026-08-25T00:01:00Z",
  },
  rules: [],
  aiTrace: {
    provider: "fixture",
    model: "deterministic",
    promptVersion: "1",
    confidence: 1,
    referencedEventIds: [],
  },
};
const mappingApproval = ApprovalRecordSchema.parse({
  approvedArtifactHash: sha256Canonical(mappingApprovalArtifact(mapping)),
  reviewerRef: "reviewer-fixture-a",
  decision: "APPROVED",
  overrides: [],
  approvedAt: "2026-08-30T00:00:00Z",
});
const caseApproval = ApprovalRecordSchema.parse({
  approvedArtifactHash: sha256Canonical(caseProposal),
  reviewerRef: "reviewer-fixture-b",
  decision: "APPROVED",
  overrides: [],
  approvedAt: "2026-08-30T00:01:00Z",
});
const manifest = CaseManifestSchema.parse({
  ...caseProposal,
  approval: caseApproval,
});

describe("replay approval gate", () => {
  it("accepts matching immutable mapping and case approval records", () => {
    expect(validateReplayApprovals(mapping, mappingApproval, manifest)).toEqual(
      { accepted: true },
    );
  });

  it("rejects replay when either approval record is absent", () => {
    const result = validateReplayApprovals(mapping, undefined, undefined);

    expect(result).toMatchObject({
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: [
        { code: "APPROVAL_RECORD_REQUIRED", path: "mappingApproval" },
        { code: "APPROVAL_RECORD_REQUIRED", path: "caseApproval" },
      ],
    });
    expect(result).not.toHaveProperty("result", "INCONCLUSIVE");
  });

  it("rejects an approval bound to a different artifact", () => {
    const result = validateReplayApprovals(
      mapping,
      { ...mappingApproval, approvedArtifactHash: "c".repeat(64) },
      manifest,
    );

    expect(result).toMatchObject({
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: [
        expect.objectContaining({
          code: "APPROVED_ARTIFACT_HASH_MISMATCH",
        }),
      ],
    });
  });

  it.each([
    ["low-confidence", { confidence: 0.999, status: "PROPOSED" as const }],
    ["review-required", { confidence: 1, status: "REVIEW_REQUIRED" as const }],
  ])(
    "requires a justified override for a %s mapping field",
    (_, fieldState) => {
      const flaggedMapping = SchemaMappingProposalSchema.parse({
        ...mapping,
        fields: [
          {
            sourceColumn: "source-text",
            targetField: null,
            confidence: fieldState.confidence,
            evidence: "No exact fixture mapping exists.",
            status: fieldState.status,
          },
        ],
      });
      const approval = {
        ...mappingApproval,
        approvedArtifactHash: sha256Canonical(
          mappingApprovalArtifact(flaggedMapping),
        ),
      };

      expect(
        validateReplayApprovals(flaggedMapping, approval, manifest),
      ).toMatchObject({
        accepted: false,
        status: "REVIEW_REQUIRED",
        issues: [{ code: "MAPPING_OVERRIDE_REQUIRED", path: "fields.0" }],
      });

      expect(
        validateReplayApprovals(
          flaggedMapping,
          {
            ...approval,
            overrides: [
              {
                fieldPath: "fields.0",
                reason: "Reviewed as intentionally unmapped synthetic text.",
              },
            ],
          },
          manifest,
        ),
      ).toEqual({ accepted: true });
    },
  );
});
