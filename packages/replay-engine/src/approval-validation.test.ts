import { describe, expect, it } from "vitest";

import {
  ApprovalRecordSchema,
  CaseManifestProposalSchema,
  CaseManifestSchema,
  type CaseManifestProposal,
  SchemaMappingProposalSchema,
} from "@weavetrail/contracts";
import { concentratedBuyEvents } from "@weavetrail/scenarios";

import { sha256Canonical } from "./canonical-json";
import { computeDatasetProfile } from "./dataset-profile";
import {
  mappingApprovalArtifact,
  caseManifestProposal,
  replayApproved,
  validateReplayApprovals,
} from "./approval-validation";

const mapping = SchemaMappingProposalSchema.parse({
  mappingVersion: "1.1",
  sourceArtifactHash: "a".repeat(64),
  fields: [],
});
const datasetProfile = computeDatasetProfile(concentratedBuyEvents);
const caseProposal: CaseManifestProposal = {
  manifestVersion: "1.2",
  caseId: "synthetic-case",
  canonicalDatasetHash: datasetProfile.canonicalDatasetHash,
  hypothesis: {
    pattern: "RAPID_PRICE_LIFT",
    instrumentId: "WT-DEMO",
    actorIds: ["actor-a"],
    startTime: datasetProfile.earliestEventTime,
    endTime: datasetProfile.latestEventTime,
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
  it("derives approved artifacts from their proposal schemas", () => {
    const mappingArtifact = mappingApprovalArtifact(mapping);
    expect(mappingArtifact).toEqual(SchemaMappingProposalSchema.parse(mapping));
    if (
      mappingArtifact === null ||
      typeof mappingArtifact !== "object" ||
      Array.isArray(mappingArtifact)
    ) {
      throw new Error("mapping approval artifact must be an object");
    }
    expect(Object.keys(mappingArtifact).sort()).toEqual(
      [...SchemaMappingProposalSchema.keyof().options].sort(),
    );
    expect(caseManifestProposal(manifest)).toEqual(
      CaseManifestProposalSchema.parse(caseProposal),
    );
  });

  it("accepts matching immutable mapping and case approval records", () => {
    expect(validateReplayApprovals(mapping, mappingApproval, manifest)).toEqual(
      { accepted: true },
    );
  });

  it("binds absent and explicitly undefined transforms to the same approval", () => {
    const field = {
      sourceColumn: "price_text",
      targetField: "price",
      confidence: 1,
      evidence: "Synthetic fixture uses the canonical decimal representation.",
      status: "PROPOSED" as const,
    };
    const absentTransform = SchemaMappingProposalSchema.parse({
      ...mapping,
      fields: [field],
    });
    const undefinedTransform = SchemaMappingProposalSchema.parse({
      ...mapping,
      fields: [{ ...field, transform: undefined }],
    });
    const absentHash = sha256Canonical(
      mappingApprovalArtifact(absentTransform),
    );
    const undefinedHash = sha256Canonical(
      mappingApprovalArtifact(undefinedTransform),
    );
    const approval = ApprovalRecordSchema.parse({
      ...mappingApproval,
      approvedArtifactHash: absentHash,
    });

    expect(undefinedTransform.fields[0]).toHaveProperty("transform");
    expect(undefinedHash).toBe(absentHash);
    expect(
      validateReplayApprovals(undefinedTransform, approval, manifest),
    ).toEqual({ accepted: true });
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
    expect(
      replayApproved(concentratedBuyEvents, mapping, undefined, undefined),
    ).not.toHaveProperty("canonicalResultHash");
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

  it("rejects an approved case outside its canonical dataset profile before hashing", () => {
    const outsideProposal = {
      ...caseProposal,
      hypothesis: {
        ...caseProposal.hypothesis,
        actorIds: ["actor-outside-profile"],
      },
    };
    const outsideManifest = CaseManifestSchema.parse({
      ...outsideProposal,
      approval: {
        ...caseApproval,
        approvedArtifactHash: sha256Canonical(outsideProposal),
      },
    });
    const result = replayApproved(
      concentratedBuyEvents,
      mapping,
      mappingApproval,
      outsideManifest,
    );

    expect(result).toMatchObject({
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: [
        expect.objectContaining({ code: "ACTOR_OUTSIDE_DATASET_PROFILE" }),
      ],
    });
    expect(result).not.toHaveProperty("canonicalResultHash");
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

  it("keeps approval audit metadata outside the canonical result hash", () => {
    const alternateMappingApproval = {
      ...mappingApproval,
      reviewerRef: "reviewer-fixture-alternate",
      approvedAt: "2026-08-30T01:00:00Z",
    };
    const alternateManifest = {
      ...manifest,
      approval: {
        ...manifest.approval,
        reviewerRef: "reviewer-fixture-alternate",
        approvedAt: "2026-08-30T01:01:00Z",
      },
    };

    expect(
      validateReplayApprovals(
        mapping,
        alternateMappingApproval,
        alternateManifest,
      ),
    ).toEqual({ accepted: true });

    const baseline = replayApproved(
      concentratedBuyEvents,
      mapping,
      mappingApproval,
      manifest,
    );
    const alternate = replayApproved(
      concentratedBuyEvents,
      mapping,
      alternateMappingApproval,
      alternateManifest,
    );
    expect(baseline).toHaveProperty("canonicalResultHash");
    expect(alternate).toHaveProperty("canonicalResultHash");
    if (
      !("canonicalResultHash" in baseline) ||
      !("canonicalResultHash" in alternate)
    ) {
      throw new Error("matching approval records must permit replay");
    }
    const baselineHash = baseline.canonicalResultHash;
    const alternateApprovalHash = alternate.canonicalResultHash;
    expect(alternateApprovalHash).toBe(baselineHash);
    expect(alternateApprovalHash).toBe(
      "42effb2884a481780106155712be7500ae5cffe89ee0c1d89622e62f7dafd4c8",
    );
  });
});
