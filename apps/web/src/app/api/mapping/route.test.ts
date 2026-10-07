import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MappingResponseSchema,
  ReplayReviewResponseSchema,
} from "@weavetrail/contracts";
import * as engine from "@weavetrail/replay-engine";
import { concentratedBuyDialectAProposal } from "@weavetrail/scenarios";
import { committedReplaySources } from "../../../lib/replay-sources";
import { replayMapping } from "../../../lib/mapping-provider";
import { prepareReplayScenarios } from "../../replay/prepare-scenarios";
import { POST } from "./route";
import { POST as replay } from "../replay/route";

const scenario = "concentrated-buy-dialect-a.csv";
const source = committedReplaySources[scenario];
const transport = vi.fn<typeof fetch>();
const storeTransport = vi.fn<typeof fetch>();
const secret = "synthetic-route-test-secret";
const model = "synthetic-route-test-model";
const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/mapping", {
    method: "POST",
    headers: {
      "x-vercel-forwarded-for": "192.0.2.1",
      "content-type": "application/json",
      ...headers,
    },
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
  vi.stubGlobal(
    "fetch",
    (url: Parameters<typeof fetch>[0], init?: RequestInit) =>
      String(url) === "https://budget.invalid"
        ? storeTransport(url, init)
        : transport(url, init),
  );
  storeTransport.mockReset();
  storeTransport.mockImplementation(async () => Response.json({ result: 0 }));
  transport.mockReset();
  // A forgotten mock fails locally; no provider test can reach the network.
  transport.mockRejectedValue(new Error("Unexpected transport call"));
  vi.stubEnv("AI_MODE", "ai");
  vi.stubEnv("AI_PROVIDER_BASE_URL", "https://provider.invalid/v1");
  vi.stubEnv("AI_PROVIDER_API_KEY", secret);
  vi.stubEnv("AI_PROVIDER_MODEL", model);
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://budget.invalid");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "synthetic-budget-token");
  vi.stubEnv(
    "AI_LIMIT_VISITOR_SECRET",
    "synthetic-budget-secret-at-least-32-bytes",
  );
  vi.stubEnv("AI_LIMIT_GLOBAL_CALLS", "100");
  vi.stubEnv("AI_LIMIT_VISITOR_REQUESTS", undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("configured mapping and replay boundary", () => {
  it.each([
    { "content-type": "text/plain", origin: "https://attacker.invalid" },
    { "content-type": "text/plain" },
    { "content-type": "application/x-www-form-urlencoded" },
    { "content-type": "multipart/form-data" },
    { "content-type": "" },
    { origin: "https://attacker.invalid" },
    { origin: "null" },
    { origin: "http://localhost.attacker.invalid" },
  ])(
    "rejects browser-unsafe headers %j before reserving or calling a model",
    async (headers) => {
      transport.mockImplementation(async () => completion());
      const response = await POST(request({ scenario }, headers));
      expect(response.status).toBe(422);
      expect(
        ReplayReviewResponseSchema.parse(await response.json()).status,
      ).toBe("REVIEW_REQUIRED");
      expect(storeTransport).not.toHaveBeenCalled();
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it("accepts same-origin JSON with a charset", async () => {
    transport.mockImplementation(async () => completion());
    const response = await POST(
      request(
        { scenario },
        {
          origin: "http://localhost",
          "content-type": "application/json; charset=utf-8",
        },
      ),
    );
    expect(response.status).toBe(200);
    expect(storeTransport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([
    [1, "Your daily live model request limit", "VISITOR_DAILY_LIMIT"],
    [2, "daily shared live model call limit", "GLOBAL_DAILY_LIMIT"],
    [3, "budget checks are unavailable", "BUDGET_UNAVAILABLE"],
  ])(
    "blocks budget decision %i before provider transport",
    async (result, message, budgetReason) => {
      storeTransport.mockImplementation(async () => Response.json({ result }));
      const response = await POST(request({ scenario }));
      expect(response.status).toBe(422);
      const review = ReplayReviewResponseSchema.parse(await response.json());
      expect(review.status).toBe("REVIEW_REQUIRED");
      expect(review.issues[0]!.message).toContain(message);
      expect(review.issues[0]!.message).toContain("No model was called");
      expect(review.issues[0]).toHaveProperty("budgetReason", budgetReason);
      expect(review).not.toHaveProperty("proposal");
      expect(review).not.toHaveProperty("mappingReceipt");
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it("discards store failures and never trusts caller IP headers outside Vercel", async () => {
    storeTransport.mockRejectedValueOnce(new Error("raw-budget-secret"));
    const review = await (await POST(request({ scenario }))).json();
    expect(review.issues[0].message).toContain("budget checks are unavailable");
    expect(JSON.stringify(review)).not.toContain("raw-budget-secret");
    vi.stubEnv("VERCEL", undefined);
    await POST(request({ scenario }));
    expect(storeTransport).toHaveBeenCalledTimes(1);
    expect(transport).not.toHaveBeenCalled();
  });

  it("fails closed when hosted store configuration is missing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
    const response = await POST(request({ scenario }));
    expect(response.status).toBe(422);
    expect((await response.json()).issues[0].message).toContain(
      "budget checks are unavailable",
    );
    expect(storeTransport).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    "http://budget.invalid",
    "https://user:secret@budget.invalid",
    "https://budget.invalid/path",
    "https://budget.invalid?token=secret",
    "https://budget.invalid#fragment",
  ])("rejects unsafe store URL %s before either transport", async (url) => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", url);
    const response = await POST(request({ scenario }));
    expect(response.status).toBe(422);
    expect((await response.json()).issues[0].message).toContain(
      "budget checks are unavailable",
    );
    expect(storeTransport).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });
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
    expect(storeTransport).toHaveBeenCalledTimes(1);
    expect(storeTransport.mock.invocationCallOrder[0]).toBeLessThan(
      transport.mock.invocationCallOrder[0]!,
    );
    expect(transport.mock.calls[0]![0]).toBe(
      "https://provider.invalid/v1/chat/completions",
    );
  });

  it.each(["https://provider.invalid", "https://provider.invalid/"])(
    "rejects origin-only configuration %s before transport",
    async (baseUrl) => {
      vi.stubEnv("AI_PROVIDER_BASE_URL", baseUrl);
      const response = await POST(request({ scenario }));
      expect(response.status).toBe(422);
      const review = ReplayReviewResponseSchema.parse(await response.json());
      expect(review.status).toBe("REVIEW_REQUIRED");
      expect(review).not.toHaveProperty("proposal");
      expect(review).not.toHaveProperty("mappingReceipt");
      expect(JSON.stringify(review)).not.toContain(secret);
      expect(transport).not.toHaveBeenCalled();
    },
  );

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
      expect(storeTransport).not.toHaveBeenCalled();
    },
  );

  it.each([
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

  it("prepares the reviewer page without exposing configured-provider regression fixtures", async () => {
    const prepared = await prepareReplayScenarios();
    expect(prepared.scenarios.some((option) => option.value === scenario)).toBe(
      false,
    );
    expect(
      prepared.scenarios.every(
        (option) => option.mappingRequestRequired === false,
      ),
    ).toBe(true);
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
