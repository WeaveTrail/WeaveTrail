import { describe, expect, it } from "vitest";

import {
  ReplayRequestSchema,
  ReplayResultResponseSchema,
  ReplayReviewResponseSchema,
} from "./replay-request";

describe("ReplayRequestSchema", () => {
  it.each([
    "concentrated-buy-dialect-a.csv",
    "concentrated-buy-dialect-b.jsonl",
  ] as const)("accepts the committed scenario %s", (scenario) => {
    expect(
      ReplayRequestSchema.parse({
        scenario,
        mutation: "baseline",
      }),
    ).toMatchObject({ scenario, mutation: "baseline" });
  });

  it("rejects unknown request fields and malformed events", () => {
    expect(() =>
      ReplayRequestSchema.parse({
        scenario: "concentrated-buy-dialect-a.csv",
        mutation: "baseline",
        events: [{ eventId: "incomplete" }],
        canonicalResultHash: "caller-controlled",
      }),
    ).toThrow();
  });

  it("rejects event arrays larger than the committed fixture", () => {
    const event = {
      schemaVersion: "1.0",
      eventId: "event-1",
      sourceEventId: "source-1",
      datasetId: "dataset-1",
      venueId: "venue-1",
      eventTime: "2026-08-31T00:00:00Z",
      instrumentId: "instrument-1",
      eventType: "TRADE",
      rawRowHash: "a".repeat(64),
    };

    expect(() =>
      ReplayRequestSchema.parse({
        scenario: "concentrated-buy-dialect-a.csv",
        mutation: "baseline",
        events: Array.from({ length: 5 }, (_, index) => ({
          ...event,
          eventId: `event-${index}`,
          sourceEventId: `source-${index}`,
        })),
      }),
    ).toThrow();
  });
});

describe("ReplayResultResponseSchema", () => {
  it("projects only the public replay result fields", () => {
    const response = ReplayResultResponseSchema.parse({
      mode: "fixture",
      scenario: "concentrated-buy-dialect-a.csv",
      mutation: "baseline",
      boundary: "Deterministic replay boundary.",
      replay: {
        engineVersion: "0.3.0-foundation",
        inputEventCount: 1,
        canonicalEventCount: 1,
        duplicateCount: 0,
        orderedEventIds: ["event-1"],
        canonicalResultHash: "a".repeat(64),
      },
    });

    expect(response.replay).not.toHaveProperty("events");
  });
});

describe("ReplayReviewResponseSchema", () => {
  it("requires a code and path for every review issue", () => {
    expect(
      ReplayReviewResponseSchema.parse({
        status: "REVIEW_REQUIRED",
        issues: [
          {
            code: "INVALID_REQUEST",
            path: ["events", 0, "eventTime"],
            message: "Invalid event time",
          },
        ],
      }),
    ).toEqual(expect.objectContaining({ status: "REVIEW_REQUIRED" }));
  });
});
