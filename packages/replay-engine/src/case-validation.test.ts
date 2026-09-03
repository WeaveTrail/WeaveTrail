import { describe, expect, it } from "vitest";

import {
  CaseManifestSchema,
  type CaseManifestProposal,
} from "@weavetrail/contracts";
import { concentratedBuyEvents } from "@weavetrail/scenarios";

import { validateCaseAgainstProfile } from "./case-validation";
import { computeDatasetProfile } from "./dataset-profile";

const profile = computeDatasetProfile(concentratedBuyEvents);
const validProposal: CaseManifestProposal = {
  manifestVersion: "1.3",
  caseId: "synthetic-case",
  canonicalDatasetHash: profile.canonicalDatasetHash,
  hypothesis: {
    pattern: "RAPID_PRICE_LIFT",
    instrumentId: "WT-DEMO",
    actorIds: ["actor-a"],
    startTime: profile.earliestEventTime,
    endTime: profile.latestEventTime,
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
const validManifest = CaseManifestSchema.parse({
  ...validProposal,
  approval: {
    approvedArtifactHash: "a".repeat(64),
    reviewerRef: "reviewer-fixture",
    decision: "APPROVED",
    overrides: [],
    approvedAt: "2026-08-30T00:00:00Z",
  },
});

describe("case validation against a dataset profile", () => {
  it("accepts a manifest wholly inside the profile", () => {
    expect(validateCaseAgainstProfile(validManifest, profile)).toEqual({
      accepted: true,
    });
  });

  it.each([
    [
      "dataset hash",
      { canonicalDatasetHash: "b".repeat(64) },
      "CANONICAL_DATASET_HASH_MISMATCH",
    ],
    [
      "instrument",
      { hypothesis: { ...validManifest.hypothesis, instrumentId: "WT-OTHER" } },
      "INSTRUMENT_OUTSIDE_DATASET_PROFILE",
    ],
    [
      "actor",
      {
        hypothesis: { ...validManifest.hypothesis, actorIds: ["actor-other"] },
      },
      "ACTOR_OUTSIDE_DATASET_PROFILE",
    ],
    [
      "time",
      {
        hypothesis: {
          ...validManifest.hypothesis,
          endTime: "2026-08-25T00:00:03Z",
        },
      },
      "TIME_WINDOW_OUTSIDE_DATASET_PROFILE",
    ],
  ] as const)("rejects a profile-external %s", (_, override, expectedCode) => {
    const manifest = CaseManifestSchema.parse({
      ...validManifest,
      ...override,
    });
    const result = validateCaseAgainstProfile(manifest, profile);

    expect(result).toMatchObject({
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: [expect.objectContaining({ code: expectedCode })],
    });
    expect(result).not.toHaveProperty("result", "INCONCLUSIVE");
  });

  it("rejects an empty actor set at the schema boundary", () => {
    expect(
      CaseManifestSchema.safeParse({
        ...validManifest,
        hypothesis: { ...validManifest.hypothesis, actorIds: [] },
      }).success,
    ).toBe(false);
  });
});
