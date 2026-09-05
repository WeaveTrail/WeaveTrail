import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CaseManifestSchema,
  ReplayResultResponseSchema,
  ReplayReviewResponseSchema,
  requiresMappingOverride,
  type CaseManifestProposal,
  type ApprovalRecord,
} from "@weavetrail/contracts";
import {
  fscStockQuotesProposal,
  realMarketDataScenarios,
} from "@weavetrail/scenarios";
import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import {
  applyApprovedMapping,
  approvedSourceMapping,
  computeDatasetProfile,
  mappingApprovalArtifact,
  replayFoundation,
  RequestWorkflow,
  sha256Canonical,
} from "@weavetrail/replay-engine";
import * as evaluator from "../../../../../../packages/replay-engine/src/rapid-price-lift";
import { POST } from "./route";

const key = "real/fsc-stock-quotes-20260903.jsonl";
const source = realMarketDataScenarios[key];
const proposal = fscStockQuotesProposal;
const approval: ApprovalRecord = {
  approvedArtifactHash: sha256Canonical(mappingApprovalArtifact(proposal)),
  reviewerRef: "route-normalization-test",
  decision: "APPROVED",
  approvedAt: "2026-09-05T19:31:27.527Z",
  overrides: proposal.fields.flatMap((field, index) =>
    requiresMappingOverride(field)
      ? [
          {
            fieldPath: `fields.${index}`,
            reason: `Accept the published daily interpretation of ${field.sourceColumn}: ${field.evidence}`,
          },
        ]
      : [],
  ),
};
const input = {
  scenario: key,
  mutation: "baseline",
  rows: source.rows,
  mappingApproval: approval,
};
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/replay", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
afterEach(() => vi.restoreAllMocks());

function normalized() {
  const result = applyApprovedMapping(
    source.rows,
    approvedSourceMapping(proposal),
  );
  if (result.status !== "APPROVED") throw new Error("Expected normalization");
  return result.events;
}

// This is an explicitly untrusted attempted request, never source attributes,
// canonical data, a registered manifest or a displayed case on a real issue.
function attemptedManifest() {
  const profile = computeDatasetProfile(normalized());
  const attempted: CaseManifestProposal = {
    manifestVersion: "1.3",
    caseId: "untrusted-negative-request",
    canonicalDatasetHash: profile.canonicalDatasetHash,
    hypothesis: {
      pattern: "RAPID_PRICE_LIFT",
      instrumentId: profile.instrumentIds[0]!,
      actorIds: ["untrusted-request-claim"],
      startTime: profile.earliestEventTime,
      endTime: profile.latestEventTime,
    },
    rules: [],
    aiTrace: {
      provider: "fixture",
      model: "negative-request-test",
      promptVersion: "test",
      confidence: 0,
      referencedEventIds: [],
    },
  };
  return CaseManifestSchema.parse({
    ...attempted,
    approval: {
      ...approval,
      overrides: [],
      approvedArtifactHash: sha256Canonical(attempted),
    },
  });
}

describe("published FSC quote normalization HTTP path", () => {
  it("reproduces the registered proposal through the fixture provider", async () => {
    expect(
      await new FixtureSchemaMappingProvider().propose({
        sourceArtifactHash: source.sourceArtifactHash,
        constants: source.constants,
        columns: source.columns,
        sampleRows: [],
      }),
    ).toEqual(proposal);
  });

  it("returns HTTP 200 MAPPING_APPROVED with the exact engine foundation and no evaluation or trace", async () => {
    const response = await post(input);
    expect(response.status).toBe(200);
    const body = ReplayResultResponseSchema.parse(await response.json());
    expect(body.workflowState).toBe("MAPPING_APPROVED");
    const { events: _, ...foundation } = replayFoundation(normalized());
    void _;
    expect(body.replay).toEqual(foundation);
    expect(body.replay.canonicalEventCount).toBe(40);
    for (const field of [
      "evaluation",
      "sourceTrace",
      "findings",
      "events",
      "profile",
    ])
      expect(body).not.toHaveProperty(field);
  });

  it.each([undefined, [], [{ fieldPath: "fields.0", reason: " " }]])(
    "refuses absent approval or missing/blank required reasons",
    async (overrides) => {
      const response = await post({
        ...input,
        mappingApproval:
          overrides === undefined ? undefined : { ...approval, overrides },
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

  it("refuses a bound untrusted actor case before CASE_APPROVED or any evaluator call", async () => {
    const evaluate = vi.spyOn(evaluator, "replayRapidPriceLift");
    const transitions = vi.spyOn(
      RequestWorkflow.prototype,
      "requireTransition",
    );
    const response = await post({
      ...input,
      caseManifest: attemptedManifest(),
    });
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
    for (const field of [
      "replay",
      "canonicalResultHash",
      "evaluation",
      "findings",
      "sourceTrace",
    ])
      expect(body).not.toHaveProperty(field);
    expect(evaluate).not.toHaveBeenCalled();
    expect(transitions).not.toHaveBeenCalledWith("CASE_APPROVED");
    expect(transitions).not.toHaveBeenCalledWith("REPLAYED");
  });

  it("keeps empty-actor/schema and invalid-approval precedence", async () => {
    const manifest = attemptedManifest();
    const malformed = await post({
      ...input,
      caseManifest: {
        ...manifest,
        hypothesis: { ...manifest.hypothesis, actorIds: [] },
      },
    });
    expect(malformed.status).toBe(422);
    expect(await malformed.json()).toMatchObject({
      workflowState: "INPUT_REVIEW_REQUIRED",
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      ]),
    });
    const invalid = await post({
      ...input,
      caseManifest: {
        ...manifest,
        approval: {
          ...manifest.approval,
          approvedArtifactHash: "0".repeat(64),
        },
      },
    });
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({
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
