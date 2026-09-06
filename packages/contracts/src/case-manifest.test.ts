import { describe, expect, it } from "vitest";

import {
  CASE_PATTERN_PARTICIPANT_REQUIREMENT,
  CaseManifestV14ProposalSchema,
  CaseManifestV14Schema,
  VersionedCaseManifestProposalSchema,
  VersionedCaseManifestSchema,
} from "./case-manifest";

const HASH = "a".repeat(64);
const approval = {
  approvedArtifactHash: HASH,
  reviewerRef: "reviewer-fixture",
  decision: "APPROVED" as const,
  overrides: [],
  approvedAt: "2026-09-06T00:00:00Z",
};

const actorlessProposal = {
  manifestVersion: "1.4" as const,
  caseId: "synthetic-cross-market-case",
  canonicalDatasetHash: HASH,
  hypothesis: {
    pattern: "CROSS_MARKET_SESSION_REVERSAL" as const,
    instrumentIds: ["WT-MARKET-A", "WT-MARKET-B"],
    actorIds: [],
    startTime: "2026-08-31T15:00:00Z",
    endTime: "2026-08-31T15:00:00Z",
  },
  rules: [],
  aiTrace: {
    provider: "fixture",
    model: "deterministic",
    promptVersion: "cross-market-case-v1",
    confidence: 1,
    referencedEventIds: [],
  },
};

describe("case manifest version coexistence", () => {
  it.each([
    ["proposal", CaseManifestV14ProposalSchema, actorlessProposal],
    [
      "approved manifest",
      CaseManifestV14Schema,
      { ...actorlessProposal, approval },
    ],
  ] as const)(
    "accepts an actorless multi-instrument %s",
    (_, schema, input) => {
      expect(schema.parse(input)).toEqual(input);
    },
  );

  it("exposes both versions through explicit versioned unions", () => {
    expect(
      VersionedCaseManifestProposalSchema.parse(actorlessProposal),
    ).toEqual(actorlessProposal);
    expect(
      VersionedCaseManifestSchema.parse({ ...actorlessProposal, approval }),
    ).toEqual({ ...actorlessProposal, approval });
  });

  it.each([CaseManifestV14ProposalSchema, CaseManifestV14Schema])(
    "rejects an empty participant list for a participant-required pattern",
    (schema) => {
      const proposal = {
        ...actorlessProposal,
        hypothesis: {
          ...actorlessProposal.hypothesis,
          pattern: "RAPID_PRICE_LIFT",
        },
      };
      const input =
        schema === CaseManifestV14Schema ? { ...proposal, approval } : proposal;
      const result = schema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({ path: ["hypothesis", "actorIds"] }),
        );
      }
    },
  );

  it("declares the participant policy for every closed pattern", () => {
    expect(CASE_PATTERN_PARTICIPANT_REQUIREMENT).toEqual({
      RAPID_PRICE_LIFT: "REQUIRED",
      CROSS_MARKET_SESSION_REVERSAL: "OPTIONAL",
    });
    expect(
      VersionedCaseManifestProposalSchema.safeParse({
        ...actorlessProposal,
        hypothesis: {
          ...actorlessProposal.hypothesis,
          pattern: "UNDECLARED_PATTERN",
        },
      }).success,
    ).toBe(false);
  });

  it("keeps both version branches strict and structurally distinct", () => {
    expect(
      VersionedCaseManifestProposalSchema.safeParse({
        ...actorlessProposal,
        hypothesis: {
          ...actorlessProposal.hypothesis,
          instrumentId: "WT-MARKET-A",
        },
      }).success,
    ).toBe(false);
    expect(
      VersionedCaseManifestProposalSchema.safeParse({
        ...actorlessProposal,
        manifestVersion: "1.3",
      }).success,
    ).toBe(false);
  });
});
