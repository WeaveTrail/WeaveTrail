import { describe, expect, it } from "vitest";

import {
  ReplayRequestSchema,
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
