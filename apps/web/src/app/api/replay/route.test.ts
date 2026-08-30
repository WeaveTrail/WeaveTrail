import { describe, expect, it } from "vitest";

import { POST } from "./route";

const scenario = "concentrated-buy-dialect-a.csv";

function request(body: unknown): Request {
  return new Request("http://localhost/api/replay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/replay request boundary", () => {
  it("rejects unparseable JSON with a structured review response", async () => {
    const response = await POST(
      new Request("http://localhost/api/replay", {
        method: "POST",
        body: "{",
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      status: "REVIEW_REQUIRED",
      issues: [
        {
          code: "INVALID_JSON",
          path: [],
          message: "Request body must be valid JSON.",
        },
      ],
    });
  });

  it.each([
    ["an unrecognized mutation", { scenario, mutation: "randomize" }],
    ["a non-object body", [scenario]],
    [
      "a malformed event",
      { scenario, mutation: "baseline", events: ["not-an-event"] },
    ],
    [
      "an event missing required fields",
      { scenario, mutation: "baseline", events: [{ eventId: "event-1" }] },
    ],
  ])("rejects %s", async (_label, body) => {
    const response = await POST(request(body));
    const result = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(result).toMatchObject({ status: "REVIEW_REQUIRED" });
    expect(result).not.toHaveProperty("replay");
    expect(result).not.toHaveProperty("canonicalResultHash");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_REQUEST",
          path: expect.any(Array),
        }),
      ]),
    );
  });
});
