import { describe, expect, it } from "vitest";

import { ApprovalRecordSchema } from "./approval-record";
import {
  CaseManifestProposalSchema,
  CaseManifestSchema,
} from "./case-manifest";
import { EvidenceBundleSchema } from "./evidence-bundle";
import { SchemaMappingProposalSchema } from "./schema-mapping";

const HASH = "a".repeat(64);

describe("provenance contract migration", () => {
  it("binds mapping proposals to a source artifact", () => {
    const proposal = {
      mappingVersion: "1.4",
      sourceArtifactHash: HASH,
      constants: {
        schemaVersion: "1.1",
        datasetId: "dataset",
        venueId: "venue",
      },
      fields: [],
    };

    expect(SchemaMappingProposalSchema.parse(proposal)).toEqual(proposal);
    expect(
      SchemaMappingProposalSchema.safeParse({
        ...proposal,
        mappingVersion: "1.2",
      }).success,
    ).toBe(false);
    expect(
      SchemaMappingProposalSchema.safeParse({
        mappingVersion: "1.0",
        datasetHash: HASH,
        fields: [],
      }).success,
    ).toBe(false);
  });

  it("binds case manifests to canonical dataset meaning", () => {
    const manifest = {
      manifestVersion: "1.3",
      caseId: "synthetic-case",
      canonicalDatasetHash: HASH,
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
      approval: ApprovalRecordSchema.parse({
        approvedArtifactHash: HASH,
        reviewerRef: "reviewer-fixture",
        decision: "APPROVED",
        overrides: [],
        approvedAt: "2026-08-30T00:00:00Z",
      }),
    };

    expect(CaseManifestSchema.parse(manifest)).toEqual(manifest);
    expect(
      CaseManifestSchema.safeParse({
        ...manifest,
        manifestVersion: "1.2",
      }).success,
    ).toBe(false);
    expect(
      CaseManifestSchema.safeParse({
        ...manifest,
        manifestVersion: "1.1",
        canonicalDatasetHash: undefined,
        datasetHash: HASH,
      }).success,
    ).toBe(false);
  });

  it.each([
    ["proposal", CaseManifestProposalSchema],
    ["approved manifest", CaseManifestSchema],
  ])("rejects a sub-millisecond inverted window in a %s", (_, schema) => {
    const proposal = {
      manifestVersion: "1.3",
      caseId: "synthetic-case",
      canonicalDatasetHash: HASH,
      hypothesis: {
        pattern: "RAPID_PRICE_LIFT",
        instrumentId: "WT-DEMO",
        actorIds: ["actor-a"],
        startTime: "2026-01-01T00:00:00.0008Z",
        endTime: "2026-01-01T00:00:00.0002Z",
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
    const input =
      schema === CaseManifestSchema
        ? {
            ...proposal,
            approval: {
              approvedArtifactHash: HASH,
              reviewerRef: "reviewer-fixture",
              decision: "APPROVED",
              overrides: [],
              approvedAt: "2026-08-30T00:00:00Z",
            },
          }
        : proposal;

    expect(schema.safeParse(input).success).toBe(false);
  });

  it.each([
    ["proposal", CaseManifestProposalSchema],
    ["approved manifest", CaseManifestSchema],
  ])(
    "fails closed for unsupported case-time precision in a %s",
    (_, schema) => {
      const proposal = {
        manifestVersion: "1.3",
        caseId: "synthetic-case",
        canonicalDatasetHash: HASH,
        hypothesis: {
          pattern: "RAPID_PRICE_LIFT",
          instrumentId: "WT-DEMO",
          actorIds: ["actor-a"],
          startTime: "2026-01-01T00:00:00.0000000000Z",
          endTime: "2026-01-01T00:00:01Z",
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
      const input =
        schema === CaseManifestSchema
          ? {
              ...proposal,
              approval: {
                approvedArtifactHash: HASH,
                reviewerRef: "reviewer-fixture",
                decision: "APPROVED",
                overrides: [],
                approvedAt: "2026-08-30T00:00:00Z",
              },
            }
          : proposal;

      expect(() => schema.safeParse(input)).not.toThrow();
      expect(schema.safeParse(input).success).toBe(false);
    },
  );

  it("records canonical meaning and every declared source artifact in bundles", () => {
    const bundle = {
      bundleVersion: "1.1",
      caseId: "synthetic-case",
      canonicalDatasetHash: HASH,
      sourceArtifacts: [{ sourceArtifactHash: HASH }],
      manifestHash: HASH,
      engineVersion: "0.7.0-canonical-decimal",
      ruleVersion: "planned-fixture",
      result: "INCONCLUSIVE",
      findings: [],
      counterfactual: {
        originalPriceChangeBps: "0",
        withoutSuspectedActorsBps: "0",
        attributableDifferenceBps: "0",
      },
      canonicalResultHash: HASH,
    };

    expect(EvidenceBundleSchema.parse(bundle)).toEqual(bundle);
    expect(
      EvidenceBundleSchema.safeParse({
        ...bundle,
        bundleVersion: "1.0",
        canonicalDatasetHash: undefined,
        sourceArtifacts: undefined,
        datasetHash: HASH,
      }).success,
    ).toBe(false);
  });
});
