import { describe, expect, it } from "vitest";

import { CaseManifestSchema } from "./case-manifest";
import { EvidenceBundleSchema } from "./evidence-bundle";
import { SchemaMappingProposalSchema } from "./schema-mapping";

const HASH = "a".repeat(64);

describe("provenance contract migration", () => {
  it("binds mapping proposals to a source artifact", () => {
    const proposal = {
      mappingVersion: "1.1",
      sourceArtifactHash: HASH,
      fields: [],
    };

    expect(SchemaMappingProposalSchema.parse(proposal)).toEqual(proposal);
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
      manifestVersion: "1.1",
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
      status: "PROPOSED",
    };

    expect(CaseManifestSchema.parse(manifest)).toEqual(manifest);
    expect(
      CaseManifestSchema.safeParse({
        ...manifest,
        manifestVersion: "1.0",
        canonicalDatasetHash: undefined,
        datasetHash: HASH,
      }).success,
    ).toBe(false);
  });

  it("records canonical meaning and every declared source artifact in bundles", () => {
    const bundle = {
      bundleVersion: "1.1",
      caseId: "synthetic-case",
      canonicalDatasetHash: HASH,
      sourceArtifacts: [{ sourceArtifactHash: HASH }],
      manifestHash: HASH,
      engineVersion: "0.3.0-foundation",
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
