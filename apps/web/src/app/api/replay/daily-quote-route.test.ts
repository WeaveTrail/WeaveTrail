import { afterEach, describe, expect, it, vi } from "vitest";
import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import {
  CaseManifestSchema,
  ReplayResultResponseSchema,
  ReplayReviewResponseSchema,
  type CaseManifestProposal,
} from "@weavetrail/contracts";
import {
  applyApprovedMapping,
  computeDatasetProfile,
  replayFoundation,
  RequestWorkflow,
  sha256Canonical,
} from "@weavetrail/replay-engine";
import * as evaluator from "../../../../../../packages/replay-engine/src/rapid-price-lift";
import { syntheticDailyQuoteSpecimen } from "../../../../../../packages/replay-engine/src/testing/daily-quotes";
import { committedReplayScenarios } from "@weavetrail/scenarios";
import { POST } from "./route";

// Replace one existing synthetic registry entry only inside this isolated test.
// No publisher data, real scenario key or public case is created by these tests.
const key = "concentrated-buy-dialect-a.csv";
const specimen = syntheticDailyQuoteSpecimen();
const original = committedReplayScenarios[key];

function setup() {
  vi.spyOn(FixtureSchemaMappingProvider.prototype, "propose").mockResolvedValue(
    specimen.proposal,
  );
  Object.assign(committedReplayScenarios, {
    [key]: {
      ...original,
      sourceArtifactHash: specimen.proposal.sourceArtifactHash,
      constants: specimen.proposal.constants,
      columns: specimen.proposal.fields.map(({ sourceColumn }) => sourceColumn),
      rows: specimen.rows,
    },
  });
  return {
    scenario: key,
    mutation: "baseline",
    rows: specimen.rows,
    mappingApproval: specimen.approval,
  };
}
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/replay", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
afterEach(() => {
  Object.assign(committedReplayScenarios, { [key]: original });
  vi.restoreAllMocks();
});

function attemptedCase() {
  const normalized = applyApprovedMapping(specimen.rows, specimen.mapping);
  if (normalized.status !== "APPROVED")
    throw new Error("Expected normalization");
  const profile = computeDatasetProfile(normalized.events);
  const proposal: CaseManifestProposal = {
    manifestVersion: "1.3",
    caseId: "explicitly-untrusted-negative-test",
    canonicalDatasetHash: profile.canonicalDatasetHash,
    hypothesis: {
      pattern: "RAPID_PRICE_LIFT",
      instrumentId: profile.instrumentIds[0]!,
      actorIds: ["untrusted-actor-claim"],
      startTime: profile.earliestEventTime,
      endTime: profile.latestEventTime,
    },
    rules: [],
    aiTrace: {
      provider: "fixture",
      model: "synthetic-negative-test",
      promptVersion: "test",
      confidence: 0,
      referencedEventIds: [],
    },
  };
  return CaseManifestSchema.parse({
    ...proposal,
    approval: {
      ...specimen.approval,
      overrides: [],
      approvedArtifactHash: sha256Canonical(proposal),
    },
  });
}

describe("daily quote HTTP boundaries with entirely synthetic source data", () => {
  it("returns only foundation counts, IDs and hash after mapping approval without a manifest", async () => {
    const input = setup();
    const response = await post(input);
    expect(response.status).toBe(200);
    const body = ReplayResultResponseSchema.parse(await response.json());
    expect(body.workflowState).toBe("MAPPING_APPROVED");
    const normalized = applyApprovedMapping(specimen.rows, specimen.mapping);
    if (normalized.status !== "APPROVED")
      throw new Error("Expected normalization");
    const { events: _, ...expected } = replayFoundation(normalized.events);
    void _;
    expect(body.replay).toEqual(expected);
    for (const property of [
      "evaluation",
      "sourceTrace",
      "events",
      "profile",
      "findings",
    ])
      expect(body).not.toHaveProperty(property);
  });

  it.each([undefined, [], [{ fieldPath: "fields.2", reason: " " }]])(
    "refuses missing approval or unjustified overrides",
    async (overrides) => {
      const input = setup();
      const response = await post({
        ...input,
        mappingApproval:
          overrides === undefined
            ? undefined
            : { ...input.mappingApproval, overrides },
      });
      expect(response.status).toBe(422);
      expect(
        ReplayReviewResponseSchema.parse(await response.json()),
      ).toMatchObject({
        workflowState: "MAPPING_REVIEW_REQUIRED",
        issues: expect.arrayContaining([
          expect.objectContaining({
            code:
              overrides === undefined
                ? "APPROVAL_RECORD_REQUIRED"
                : "MAPPING_OVERRIDE_REQUIRED",
          }),
        ]),
      });
    },
  );

  it("refuses the untrusted actor at its exact request path with no case approval, replay or evaluator call", async () => {
    const input = setup();
    const evaluate = vi.spyOn(evaluator, "replayRapidPriceLift");
    const transitions = vi.spyOn(
      RequestWorkflow.prototype,
      "requireTransition",
    );
    const response = await post({ ...input, caseManifest: attemptedCase() });
    expect(response.status).toBe(422);
    const body = ReplayReviewResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      workflowState: "CASE_REVIEW_REQUIRED",
      issues: [
        {
          code: "ACTOR_OUTSIDE_DATASET_PROFILE",
          path: ["caseManifest", "hypothesis", "actorIds", 0],
        },
      ],
    });
    for (const property of [
      "replay",
      "canonicalResultHash",
      "evaluation",
      "findings",
      "sourceTrace",
    ])
      expect(body).not.toHaveProperty(property);
    expect(evaluate).not.toHaveBeenCalled();
    expect(transitions).not.toHaveBeenCalledWith("CASE_APPROVED");
    expect(transitions).not.toHaveBeenCalledWith("REPLAYED");
  });

  it("preserves schema and approval rejection precedence", async () => {
    const input = setup();
    const manifest = attemptedCase();
    for (const hypothesis of [
      { ...manifest.hypothesis, actorIds: [] },
      { ...manifest.hypothesis, startTime: "bad" },
    ]) {
      const response = await post({
        ...input,
        caseManifest: { ...manifest, hypothesis },
      });
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        workflowState: "INPUT_REVIEW_REQUIRED",
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "INVALID_REQUEST" }),
        ]),
      });
    }
    const response = await post({
      ...input,
      caseManifest: {
        ...manifest,
        approval: {
          ...manifest.approval,
          approvedArtifactHash: "0".repeat(64),
        },
      },
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      workflowState: "CASE_REVIEW_REQUIRED",
      issues: [
        {
          code: "APPROVED_ARTIFACT_HASH_MISMATCH",
          path: ["caseManifest", "approval", "approvedArtifactHash"],
        },
      ],
    });
  });
});
