import { describe, expect, it } from "vitest";

import {
  ApprovalRecordSchema,
  CaseManifestProposalSchema,
  CaseManifestSchema,
  type CaseManifest,
  type CaseManifestProposal,
  SchemaMappingProposalSchema,
} from "@weavetrail/contracts";
import {
  concentratedBuyDialectAProposal,
  concentratedBuyDialectARows,
  concentratedBuyDialectBProposal,
  concentratedBuyEvents,
} from "@weavetrail/scenarios";

import { sha256Canonical } from "./canonical-hash";
import { computeDatasetProfile } from "./dataset-profile";
import { RequestWorkflow } from "./request-workflow";
import {
  approvedSourceMapping,
  validateApprovedMapping,
} from "./source-ingest";
import {
  mappingApprovalArtifact,
  caseManifestProposal,
  replayApproved,
  validateReplayApprovals,
} from "./approval-validation";

const mapping = concentratedBuyDialectAProposal;
const datasetProfile = computeDatasetProfile(concentratedBuyEvents);
const caseProposal: CaseManifestProposal = {
  manifestVersion: "1.3",
  caseId: "synthetic-case",
  canonicalDatasetHash: datasetProfile.canonicalDatasetHash,
  hypothesis: {
    pattern: "RAPID_PRICE_LIFT",
    instrumentId: "WT-DEMO",
    actorIds: ["actor-a"],
    startTime: datasetProfile.earliestEventTime,
    endTime: datasetProfile.latestEventTime,
  },
  rules: [
    {
      ruleId: "RAPID_PRICE_LIFT",
      ruleVersion: "1.1",
      parameters: {
        minimumPriceChangeBps: "100",
        minimumAggressiveBuyShareBps: "7000",
        minimumActorConcentrationShareBps: "8000",
        minimumExecutionsAboveReference: "2",
        minimumRemovalSensitivityBps: "50",
      },
    },
  ],
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
  it("uses the complete legal workflow for an approved case replay", () => {
    const workflow = new RequestWorkflow();

    const result = replayApproved(
      concentratedBuyDialectARows,
      concentratedBuyDialectARows,
      mapping,
      mappingApproval,
      manifest,
      "baseline",
      workflow,
    );

    expect(result).toHaveProperty("canonicalResultHash");
    expect(workflow.history).toEqual([
      "UPLOADED",
      "MAPPING_PROPOSED",
      "MAPPING_APPROVED",
      "CASE_PROPOSED",
      "CASE_APPROVED",
      "REPLAYED",
    ]);
  });

  it("ends a mapping-only foundation replay at mapping approval", () => {
    const workflow = new RequestWorkflow();

    expect(
      replayApproved(
        concentratedBuyDialectARows,
        concentratedBuyDialectARows,
        mapping,
        mappingApproval,
        undefined,
        "baseline",
        workflow,
      ),
    ).toHaveProperty("canonicalResultHash");
    expect(workflow.state).toBe("MAPPING_APPROVED");
  });

  it("does not admit mapped rows through an approved proposal with no fields", () => {
    const empty = SchemaMappingProposalSchema.parse({ ...mapping, fields: [] });
    const emptyApproval = {
      ...mappingApproval,
      approvedArtifactHash: sha256Canonical(empty),
    };
    const workflow = new RequestWorkflow();
    const result = replayApproved(
      concentratedBuyDialectARows,
      concentratedBuyDialectARows,
      empty,
      emptyApproval,
      undefined,
      "baseline",
      workflow,
    );
    expect(result).toMatchObject({ status: "REVIEW_REQUIRED" });
    if (!("issues" in result)) throw new Error("expected review issues");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MAPPING_APPLICATION_REVIEW_REQUIRED",
        }),
      ]),
    );
    expect(result).not.toHaveProperty("canonicalResultHash");
    expect(workflow.state).toBe("MAPPING_REVIEW_REQUIRED");
    expect(workflow.history).toEqual([
      "UPLOADED",
      "MAPPING_PROPOSED",
      "MAPPING_REVIEW_REQUIRED",
    ]);
    expect(workflow.history).not.toContain("MAPPING_APPROVED");
  });

  it.each([
    [
      "duplicate source column",
      { sourceColumn: mapping.fields[0]!.sourceColumn },
    ],
    ["duplicate target field", { targetField: mapping.fields[0]!.targetField }],
  ] as const)("keeps a %s at mapping review", (_label, duplicate) => {
    const duplicateMapping = SchemaMappingProposalSchema.parse({
      ...mapping,
      fields: [
        ...mapping.fields,
        {
          ...mapping.fields[1]!,
          ...duplicate,
        },
      ],
    });
    const workflow = new RequestWorkflow();
    const result = replayApproved(
      concentratedBuyDialectARows,
      concentratedBuyDialectARows,
      duplicateMapping,
      {
        ...mappingApproval,
        approvedArtifactHash: sha256Canonical(duplicateMapping),
      },
      undefined,
      "baseline",
      workflow,
    );

    expect(result).toMatchObject({ status: "REVIEW_REQUIRED" });
    expect(workflow.state).toBe("MAPPING_REVIEW_REQUIRED");
    expect(workflow.history).toEqual([
      "UPLOADED",
      "MAPPING_PROPOSED",
      "MAPPING_REVIEW_REQUIRED",
    ]);
    expect(workflow.history).not.toContain("MAPPING_APPROVED");
  });

  it.each([
    ["foundation-only", undefined],
    ["case-manifest", manifest],
  ] as const)(
    "preserves conflicting source identity details on %s replay",
    (_label, caseManifest) => {
      const conflictingRows = concentratedBuyDialectARows.map((row, index) =>
        index === 1
          ? {
              ...row,
              values: {
                ...row.values,
                source_id: concentratedBuyDialectARows[0]!.values.source_id!,
              },
            }
          : row,
      );
      const result = replayApproved(
        conflictingRows,
        conflictingRows,
        mapping,
        mappingApproval,
        caseManifest,
      );

      expect(result).toMatchObject({
        status: "REVIEW_REQUIRED",
        issues: [
          expect.objectContaining({
            code: "CONFLICTING_SOURCE_IDENTITY",
            message: expect.stringContaining("source identity"),
          }),
        ],
      });
    },
  );

  it("derives valid executable mappings for both committed proposals", () => {
    for (const proposal of [mapping, concentratedBuyDialectBProposal]) {
      expect(validateApprovedMapping(approvedSourceMapping(proposal))).toEqual(
        [],
      );
    }
  });

  it("binds constants into both approval hash and derived event identity", () => {
    const changed = SchemaMappingProposalSchema.parse({
      ...mapping,
      constants: { ...mapping.constants, venueId: "SYNTH-Y" },
    });
    expect(sha256Canonical(changed)).not.toBe(sha256Canonical(mapping));
    const changedApproval = {
      ...mappingApproval,
      approvedArtifactHash: sha256Canonical(changed),
    };
    const result = replayApproved(
      concentratedBuyDialectARows,
      concentratedBuyDialectARows,
      changed,
      changedApproval,
      undefined,
    );
    expect(result).toHaveProperty("orderedEventIds");
    if (!("orderedEventIds" in result)) throw new Error("expected replay");
    expect(result.orderedEventIds.every((id) => id.includes("SYNTH-Y"))).toBe(
      true,
    );
  });

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

  it("rejects a manifest without case approval through the replay gate", () => {
    const result = replayApproved(
      concentratedBuyDialectARows,
      concentratedBuyDialectARows,
      mapping,
      mappingApproval,
      { ...caseProposal, approval: undefined } as unknown as CaseManifest,
    );

    expect(result).toMatchObject({
      status: "REVIEW_REQUIRED",
      issues: [{ code: "APPROVAL_RECORD_REQUIRED", path: "caseApproval" }],
    });
    expect(result).not.toHaveProperty("canonicalResultHash");
  });

  it("rejects a rejected case approval through the replay gate", () => {
    const result = replayApproved(
      concentratedBuyDialectARows,
      concentratedBuyDialectARows,
      mapping,
      mappingApproval,
      CaseManifestSchema.parse({
        ...caseProposal,
        approval: { ...caseApproval, decision: "REJECTED" },
      }),
    );

    expect(result).toMatchObject({
      status: "REVIEW_REQUIRED",
      issues: [
        expect.objectContaining({
          code: "APPROVAL_REJECTED",
          path: "caseApproval.decision",
        }),
      ],
    });
    expect(result).not.toHaveProperty("canonicalResultHash");
  });

  it("rejects case approval bound to another proposal through the replay gate", () => {
    const result = replayApproved(
      concentratedBuyDialectARows,
      concentratedBuyDialectARows,
      mapping,
      mappingApproval,
      CaseManifestSchema.parse({
        ...caseProposal,
        approval: {
          ...caseApproval,
          approvedArtifactHash: "c".repeat(64),
        },
      }),
    );

    expect(result).toMatchObject({
      status: "REVIEW_REQUIRED",
      issues: [
        expect.objectContaining({
          code: "APPROVED_ARTIFACT_HASH_MISMATCH",
          path: "caseApproval.approvedArtifactHash",
        }),
      ],
    });
    expect(result).not.toHaveProperty("canonicalResultHash");
  });

  it("keeps manifest-less foundation replay available", () => {
    const result = replayApproved(
      concentratedBuyDialectARows,
      concentratedBuyDialectARows,
      mapping,
      mappingApproval,
      undefined,
    );

    expect(result).toHaveProperty(
      "canonicalResultHash",
      "8ecbc17157e5d95bc204e9b44425b7a0b2cbee402a906de75619a689c81b13ff",
    );
  });

  it("rejects every missing declared row in declaration order", () => {
    const submittedRows = [
      concentratedBuyDialectARows[0]!,
      concentratedBuyDialectARows[2]!,
    ];
    const results = [submittedRows, [...submittedRows].reverse()].map((rows) =>
      replayApproved(
        rows,
        concentratedBuyDialectARows,
        mapping,
        mappingApproval,
        undefined,
      ),
    );

    for (const result of results) {
      expect(result).toEqual({
        accepted: false,
        status: "REVIEW_REQUIRED",
        issues: [
          { code: "SOURCE_ROW_MISSING", path: "rows.3" },
          { code: "SOURCE_ROW_MISSING", path: "rows.5" },
        ],
      });
      expect(result).not.toHaveProperty("canonicalResultHash");
    }
    expect(results[0]).toEqual(results[1]);
  });

  it.each([
    ["target without transform", "sourceEventId", null],
    ["transform without target", null, "IDENTITY"],
    ["missing transform", "sourceEventId", undefined],
    ["missing transform for null target", null, undefined],
  ] as const)("rejects %s", (_label, targetField, transform) => {
    expect(
      SchemaMappingProposalSchema.safeParse({
        ...mapping,
        fields: [{ ...mapping.fields[0], targetField, transform }],
      }).success,
    ).toBe(false);
  });

  it("makes an approved transform change affect the gate outcome", () => {
    const changed = SchemaMappingProposalSchema.parse({
      ...mapping,
      fields: mapping.fields.map((field) =>
        field.sourceColumn === "side_code"
          ? { ...field, transform: "IDENTITY" as const }
          : field,
      ),
    });
    const result = replayApproved(
      concentratedBuyDialectARows,
      concentratedBuyDialectARows,
      changed,
      { ...mappingApproval, approvedArtifactHash: sha256Canonical(changed) },
      undefined,
    );
    expect(result).toMatchObject({ status: "REVIEW_REQUIRED" });
    expect(result).not.toHaveProperty("canonicalResultHash");
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
      replayApproved(
        concentratedBuyDialectARows,
        concentratedBuyDialectARows,
        mapping,
        undefined,
        undefined,
      ),
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
      concentratedBuyDialectARows,
      concentratedBuyDialectARows,
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

  it.each(["lenient-first", "strict-first"] as const)(
    "rejects duplicate rule configurations independent of %s order",
    (order) => {
      const strictRule = {
        ...caseProposal.rules[0]!,
        parameters: {
          ...caseProposal.rules[0]!.parameters,
          minimumPriceChangeBps: "9999",
        },
      };
      const duplicateProposal = {
        ...caseProposal,
        rules:
          order === "lenient-first"
            ? [caseProposal.rules[0]!, strictRule]
            : [strictRule, caseProposal.rules[0]!],
      };
      const duplicateManifest = CaseManifestSchema.parse({
        ...duplicateProposal,
        approval: {
          ...caseApproval,
          approvedArtifactHash: sha256Canonical(duplicateProposal),
        },
      });
      const result = replayApproved(
        concentratedBuyDialectARows,
        concentratedBuyDialectARows,
        mapping,
        mappingApproval,
        duplicateManifest,
      );

      expect(result).toEqual({
        accepted: false,
        status: "REVIEW_REQUIRED",
        issues: [{ code: "RULE_CONFIGURATION_REQUIRED", path: "rules" }],
      });
      expect(result).not.toHaveProperty("canonicalResultHash");
    },
  );

  it.each([
    ["low-confidence", { confidence: 0.999, status: "PROPOSED" as const }],
    ["review-required", { confidence: 1, status: "REVIEW_REQUIRED" as const }],
  ])(
    "returns the same override issue from both gates for a %s mapping field",
    (_, fieldState) => {
      const flaggedMapping = SchemaMappingProposalSchema.parse({
        ...mapping,
        fields: mapping.fields.map((field, index) =>
          index === 0 ? { ...field, ...fieldState } : field,
        ),
      });
      const approval = {
        ...mappingApproval,
        approvedArtifactHash: sha256Canonical(
          mappingApprovalArtifact(flaggedMapping),
        ),
      };
      const expected = {
        accepted: false as const,
        status: "REVIEW_REQUIRED" as const,
        issues: [{ code: "MAPPING_OVERRIDE_REQUIRED", path: "fields.0" }],
      };

      expect(
        validateReplayApprovals(flaggedMapping, approval, manifest),
      ).toEqual(expected);
      expect(
        replayApproved(
          concentratedBuyDialectARows,
          concentratedBuyDialectARows,
          flaggedMapping,
          approval,
          manifest,
        ),
      ).toEqual(expected);

      const justifiedApproval = {
        ...approval,
        overrides: [
          {
            fieldPath: "fields.0",
            reason: "Reviewed against the synthetic source schema.",
          },
        ],
      };
      expect(
        validateReplayApprovals(flaggedMapping, justifiedApproval, manifest),
      ).toEqual({ accepted: true });
      expect(
        replayApproved(
          concentratedBuyDialectARows,
          concentratedBuyDialectARows,
          flaggedMapping,
          justifiedApproval,
          manifest,
        ),
      ).toHaveProperty("canonicalResultHash");
    },
  );

  it("does not require an override at confidence 1 for a proposed field", () => {
    const boundaryMapping = SchemaMappingProposalSchema.parse({
      ...mapping,
      fields: mapping.fields.map((field, index) =>
        index === 0
          ? { ...field, confidence: 1, status: "PROPOSED" as const }
          : field,
      ),
    });
    const approval = {
      ...mappingApproval,
      approvedArtifactHash: sha256Canonical(
        mappingApprovalArtifact(boundaryMapping),
      ),
    };

    expect(
      validateReplayApprovals(boundaryMapping, approval, manifest),
    ).toEqual({ accepted: true });
    expect(
      replayApproved(
        concentratedBuyDialectARows,
        concentratedBuyDialectARows,
        boundaryMapping,
        approval,
        manifest,
      ),
    ).toHaveProperty("canonicalResultHash");
  });

  it("does not accept a whitespace-only mapping override reason", () => {
    const sourceNoteIndex = concentratedBuyDialectBProposal.fields.findIndex(
      ({ sourceColumn }) => sourceColumn === "source_note",
    );
    expect(
      concentratedBuyDialectBProposal.fields[sourceNoteIndex],
    ).toMatchObject({
      sourceColumn: "source_note",
      status: "REVIEW_REQUIRED",
    });
    const approval = ApprovalRecordSchema.parse({
      ...mappingApproval,
      approvedArtifactHash: sha256Canonical(
        mappingApprovalArtifact(concentratedBuyDialectBProposal),
      ),
      overrides: [
        {
          fieldPath: `fields.${sourceNoteIndex}`,
          reason: "   ",
        },
      ],
    });

    const expectedIssue = {
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: [
        {
          code: "MAPPING_OVERRIDE_REQUIRED",
          path: `fields.${sourceNoteIndex}`,
        },
      ],
    } as const;

    expect(
      validateReplayApprovals(
        concentratedBuyDialectBProposal,
        approval,
        manifest,
      ),
    ).toEqual(expectedIssue);
    expect(
      replayApproved(
        [],
        [],
        concentratedBuyDialectBProposal,
        approval,
        manifest,
      ),
    ).toEqual(expectedIssue);
  });

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
      concentratedBuyDialectARows,
      concentratedBuyDialectARows,
      mapping,
      mappingApproval,
      manifest,
    );
    const alternate = replayApproved(
      concentratedBuyDialectARows,
      concentratedBuyDialectARows,
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
      "58f5400056129f1648337d0005deebbd3c7520292ea6c17dfafca3cce9601040",
    );
  });
});
