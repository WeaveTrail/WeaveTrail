import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MappingResponseSchema,
  ReplayReviewResponseSchema,
} from "@weavetrail/contracts";
import * as engine from "@weavetrail/replay-engine";
import { concentratedBuyDialectAProposal } from "@weavetrail/scenarios";
import { committedReplaySources } from "../../../lib/replay-sources";
import { replayMapping } from "../../../lib/mapping-provider";
import { prepareReplayScenarios } from "../../replay/prepare-scenarios";
import { CaseReplay } from "../../replay/case-replay";
import { POST } from "./route";
import { POST as replay } from "../replay/route";

const scenario = "concentrated-buy-dialect-a.csv";
const source = committedReplaySources[scenario];
const transport = vi.fn<typeof fetch>();
const secret = "synthetic-route-test-secret";
const model = "synthetic-route-test-model";
const request = (body: unknown) =>
  new Request("http://localhost/api/mapping", {
    method: "POST",
    body: JSON.stringify(body),
  });
const completion = (fields: unknown = concentratedBuyDialectAProposal.fields) =>
  Response.json({
    choices: [
      {
        finish_reason: "stop",
        message: { role: "assistant", content: JSON.stringify({ fields }) },
      },
    ],
  });
const approval = (proposal: unknown) => ({
  approvedArtifactHash: engine.sha256Canonical(
    proposal as Parameters<typeof engine.sha256Canonical>[0],
  ),
  decision: "APPROVED",
  reviewerRef: "reviewer:synthetic-test",
  approvedAt: "2026-09-06T00:00:00Z",
  overrides: [],
});

beforeEach(() => {
  vi.stubGlobal("fetch", transport);
  transport.mockReset();
  // A forgotten mock fails locally; no provider test can reach the network.
  transport.mockRejectedValue(new Error("Unexpected transport call"));
  vi.stubEnv("AI_MODE", "ai");
  vi.stubEnv("AI_PROVIDER_BASE_URL", "https://provider.invalid");
  vi.stubEnv("AI_PROVIDER_API_KEY", secret);
  vi.stubEnv("AI_PROVIDER_MODEL", model);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("configured mapping and replay boundary", () => {
  it("replays the exact displayed proposal after approval without another call or changing the golden hash", async () => {
    transport.mockResolvedValue(
      completion(
        concentratedBuyDialectAProposal.fields.map((field) => ({
          ...field,
          evidence:
            "Synthetic configured response evidence, distinct from the registered fixture.",
        })),
      ),
    );
    const response = await POST(request({ scenario }));
    expect(response.status).toBe(200);
    const mapping = MappingResponseSchema.parse(await response.json());
    expect(mapping.mode).toBe("ai");
    if (mapping.mode !== "ai") throw new Error("Expected configured proposal");
    const publicText = JSON.stringify(mapping);
    expect(publicText).not.toContain(secret);
    expect(publicText).not.toContain(model);
    const recorded = await replayMapping(scenario, mapping.mappingReceipt);
    expect(recorded.trace).toEqual({
      mode: "ai",
      model,
      promptVersion: "schema-mapping/1",
    });
    const replayBody = {
      scenario,
      mutation: "baseline",
      rows: source.rows,
      mappingReceipt: mapping.mappingReceipt,
    };
    const unapproved = await replay(request(replayBody));
    expect(unapproved.status).toBe(422);
    const staleApproval = await replay(
      request({
        ...replayBody,
        mappingApproval: approval(concentratedBuyDialectAProposal),
      }),
    );
    expect(staleApproval.status).toBe(422);
    const staleReview = await staleApproval.json();
    expect(staleReview.issues).toContainEqual(
      expect.objectContaining({ code: "APPROVED_ARTIFACT_HASH_MISMATCH" }),
    );
    expect(staleReview).not.toHaveProperty("replay");
    const resultResponse = await replay(
      request({ ...replayBody, mappingApproval: approval(mapping.proposal) }),
    );
    expect(resultResponse.status).toBe(200);
    const result = await resultResponse.json();
    expect(result.mode).toBe("ai");
    expect(result.replay.canonicalResultHash).toBe(
      "8ecbc17157e5d95bc204e9b44425b7a0b2cbee402a906de75619a689c81b13ff",
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each(["invalid", "missing-config", "transport", "low-confidence"])(
    "stops %s before normalization or replay, even with a fixture approval",
    async (kind) => {
      const replaySpy = vi.spyOn(engine, "replayApproved");
      if (kind === "missing-config") vi.stubEnv("AI_PROVIDER_API_KEY", "");
      if (kind === "invalid")
        transport.mockResolvedValue(completion([{ sourceColumn: "invented" }]));
      if (kind === "low-confidence")
        transport.mockResolvedValue(
          completion(
            concentratedBuyDialectAProposal.fields.map((field) => ({
              ...field,
              confidence: 0.5,
            })),
          ),
        );
      const proposed = await POST(request({ scenario }));
      expect(proposed.status).toBe(422);
      const review = ReplayReviewResponseSchema.parse(await proposed.json());
      expect(review.status).toBe("REVIEW_REQUIRED");
      expect(review).not.toHaveProperty("proposal");
      expect(review).not.toHaveProperty("mappingReceipt");
      const replayResponse = await replay(
        request({
          scenario,
          mutation: "baseline",
          rows: source.rows,
          mappingApproval: approval(concentratedBuyDialectAProposal),
        }),
      );
      expect(replayResponse.status).toBe(422);
      const blocked = await replayResponse.json();
      expect(blocked.status).toBe("REVIEW_REQUIRED");
      expect(blocked).not.toHaveProperty("replay");
      expect(blocked).not.toHaveProperty("canonicalResultHash");
      expect(replaySpy).not.toHaveBeenCalled();
      expect(JSON.stringify([review, blocked])).not.toContain(secret);
    },
  );

  it.each([
    "tampered",
    "expired",
    "other-artifact",
    "rotated-key",
    "changed-model",
  ])("rejects a %s receipt before replay", async (kind) => {
    transport.mockResolvedValue(completion());
    const mapping = await (await POST(request({ scenario }))).json();
    let receipt = mapping.mappingReceipt as string;
    if (kind === "tampered")
      receipt = `${receipt[0] === "A" ? "B" : "A"}${receipt.slice(1)}`;
    if (kind === "expired") {
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 31 * 60 * 1000);
    }
    if (kind === "rotated-key")
      vi.stubEnv("AI_PROVIDER_API_KEY", "other-secret");
    if (kind === "changed-model")
      vi.stubEnv("AI_PROVIDER_MODEL", "other-model");
    await expect(
      replayMapping(
        kind === "other-artifact"
          ? "concentrated-buy-dialect-b.jsonl"
          : scenario,
        receipt,
      ),
    ).rejects.toThrow("Review is required");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each(["fixture", undefined])(
    "preserves default fixture output with credentials present and selector %s",
    async (mode) => {
      vi.stubEnv("AI_MODE", mode);
      const mapping = await (await POST(request({ scenario }))).json();
      expect(mapping).toEqual({
        mode: "fixture",
        proposal: concentratedBuyDialectAProposal,
      });
      const result = await replay(
        request({
          scenario,
          mutation: "baseline",
          rows: source.rows,
          mappingApproval: approval(mapping.proposal),
        }),
      );
      expect(result.status).toBe(200);
      expect((await result.json()).mode).toBe("fixture");
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it.each([
    "real/fsc-stock-quotes-20260903.jsonl",
    "rapid-price-lift-supported.csv",
    "actorless-multi-instrument-quotes.jsonl",
  ] as const)(
    "resolves ineligible %s deterministically even with incomplete selected configuration",
    async (value) => {
      vi.stubEnv("AI_PROVIDER_API_KEY", "");
      const result = await (await POST(request({ scenario: value }))).json();
      expect(result).toEqual({
        mode: "fixture",
        proposal: committedReplaySources[value].mappingProposal,
      });
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it("prepares the page without network and blocks eligible fixture approval before a configured request", async () => {
    const prepared = await prepareReplayScenarios();
    const option = prepared.scenarios.find(
      (option) => option.value === scenario,
    )!;
    expect(option.mappingRequestRequired).toBe(true);
    const markup = renderToStaticMarkup(
      createElement(CaseReplay, { ...prepared, scenarios: [option] }),
    );
    expect(markup).toContain("Request mapping proposal");
    expect(markup).toContain("REVIEW_REQUIRED");
    expect(markup).not.toContain("Executed mapping proposal");
    expect(markup).toMatch(/disabled=""[^>]*>Approve executed mapping/);
    expect(JSON.stringify(prepared)).not.toContain(secret);
    expect(JSON.stringify(prepared)).not.toContain(model);
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {},
    { scenario: "uncommitted" },
    { scenario, rows: [] },
    { scenario, mode: "fixture" },
  ])(
    "rejects caller-supplied source data and mode %j without transport",
    async (body) => {
      expect((await POST(request(body))).status).toBe(422);
      expect(transport).not.toHaveBeenCalled();
    },
  );
});
