import { describe, expect, it } from "vitest";

import type { TradeEvent } from "@weavetrail/contracts";
import { concentratedBuyEvents } from "@weavetrail/scenarios";

import { POST } from "./route";

const scenario = "concentrated-buy-dialect-a.csv";
const scenarios = [
  "concentrated-buy-dialect-a.csv",
  "concentrated-buy-dialect-b.jsonl",
] as const;
const mutations = ["baseline", "shuffle", "duplicate"] as const;

function request(body: unknown): Request {
  return new Request("http://localhost/api/replay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/replay request boundary", () => {
  it.each(
    scenarios.flatMap((scenarioName) =>
      mutations.map((mutation) => [scenarioName, mutation] as const),
    ),
  )("replays scenario %s with mutation %s", async (scenarioName, mutation) => {
    const response = await POST(request({ scenario: scenarioName, mutation }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      mode: "fixture",
      scenario: scenarioName,
      mutation,
      replay: { canonicalResultHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
  });

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

  it("derives mutations from a caller-provided event array", async () => {
    const oneEvent = [concentratedBuyEvents[0]!];
    const shuffled = await POST(
      request({ scenario, mutation: "shuffle", events: oneEvent }),
    );
    const duplicated = await POST(
      request({ scenario, mutation: "duplicate", events: oneEvent }),
    );

    expect(await shuffled.json()).toMatchObject({
      mutation: "shuffle",
      replay: { inputEventCount: 1, canonicalEventCount: 1 },
    });
    expect(await duplicated.json()).toMatchObject({
      mutation: "duplicate",
      replay: {
        inputEventCount: 2,
        canonicalEventCount: 1,
        duplicateCount: 1,
      },
    });
  });

  it("changes the result hash when valid caller event content changes", async () => {
    const firstPayload = [concentratedBuyEvents[0]!];
    const secondPayload = [
      { ...concentratedBuyEvents[0]!, instrumentId: "SYNTHETIC-OTHER" },
    ];
    const first = await POST(
      request({ scenario, mutation: "baseline", events: firstPayload }),
    );
    const second = await POST(
      request({ scenario, mutation: "baseline", events: secondPayload }),
    );

    expect((await first.json()).replay.canonicalResultHash).not.toBe(
      (await second.json()).replay.canonicalResultHash,
    );
  });

  it.each([
    [
      "CONFLICTING_SOURCE_IDENTITY",
      (event: TradeEvent) => [event, { ...event, instrumentId: "OTHER" }],
    ],
    [
      "CONFLICTING_EVENT_IDENTIFIER",
      (event: TradeEvent) => [
        event,
        { ...event, sourceEventId: `${event.sourceEventId}-other` },
      ],
    ],
    [
      "MIXED_SEQUENCE_PRESENCE",
      (event: TradeEvent) => {
        const withoutSequence = { ...event };
        delete withoutSequence.sequence;
        return [
          event,
          {
            ...withoutSequence,
            eventId: `${event.eventId}-other`,
            sourceEventId: `${event.sourceEventId}-other`,
          },
        ];
      },
    ],
    [
      "UNSUPPORTED_EVENT_TIME",
      (event: TradeEvent) => [
        { ...event, eventTime: "0000-01-01T00:00:00+23:59" },
      ],
    ],
  ] as const)("returns review state for %s", async (code, makeEvents) => {
    const response = await POST(
      request({
        scenario,
        mutation: "baseline",
        events: makeEvents(concentratedBuyEvents[0]!),
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(422);
    expect(result).toMatchObject({
      status: "REVIEW_REQUIRED",
      issues: [{ code, path: ["events"] }],
    });
    expect(result).not.toHaveProperty("canonicalResultHash");
    expect(result).not.toHaveProperty("replay");
  });
});
