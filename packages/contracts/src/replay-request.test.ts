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
        rows: [
          {
            coordinate: { sourceArtifactHash: "a".repeat(64), rowNumber: "1" },
            values: { id: "1" },
          },
        ],
      }),
    ).toMatchObject({ scenario, mutation: "baseline" });
  });

  it("rejects unknown request fields and caller events", () => {
    expect(() =>
      ReplayRequestSchema.parse({
        scenario: "concentrated-buy-dialect-a.csv",
        mutation: "baseline",
        events: [{ eventId: "incomplete" }],
        canonicalResultHash: "caller-controlled",
      }),
    ).toThrow();
  });

  it("rejects row arrays larger than the committed fixture", () => {
    expect(() =>
      ReplayRequestSchema.parse({
        scenario: "concentrated-buy-dialect-a.csv",
        mutation: "baseline",
        rows: Array.from({ length: 5 }, (_, index) => ({
          coordinate: {
            sourceArtifactHash: "a".repeat(64),
            rowNumber: String(index),
          },
          values: { id: String(index) },
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
  it("accepts the mapping approval required issue code", () => {
    expect(
      ReplayReviewResponseSchema.parse({
        status: "REVIEW_REQUIRED",
        issues: [
          {
            code: "APPROVAL_RECORD_REQUIRED",
            path: ["mappingApproval"],
            message: "Mapping approval is required.",
          },
        ],
      }),
    ).toMatchObject({
      issues: [{ code: "APPROVAL_RECORD_REQUIRED", path: ["mappingApproval"] }],
    });
  });

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
