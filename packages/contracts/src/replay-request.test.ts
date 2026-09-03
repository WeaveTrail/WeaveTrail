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

  it("accepts up to 64 rows and rejects larger requests", () => {
    const request = (length: number) => ({
      scenario: "concentrated-buy-dialect-a.csv",
      mutation: "baseline",
      rows: Array.from({ length }, (_, index) => ({
        coordinate: {
          sourceArtifactHash: "a".repeat(64),
          rowNumber: String(index),
        },
        values: { id: String(index) },
      })),
    });

    expect(ReplayRequestSchema.safeParse(request(64)).success).toBe(true);
    expect(() => ReplayRequestSchema.parse(request(65))).toThrow();
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
        engineVersion: "0.7.0-canonical-decimal",
        inputEventCount: 1,
        canonicalEventCount: 1,
        duplicateCount: 0,
        orderedEventIds: ["event-1"],
        canonicalResultHash: "a".repeat(64),
      },
    });

    expect(response.replay).not.toHaveProperty("events");
  });

  it("accepts an evaluated rapid price lift result branch", () => {
    const response = ReplayResultResponseSchema.parse({
      mode: "fixture",
      scenario: "concentrated-buy-dialect-a.csv",
      mutation: "baseline",
      boundary: "Deterministic replay boundary.",
      replay: {
        engineVersion: "0.7.0-canonical-decimal",
        inputEventCount: 6,
        canonicalEventCount: 6,
        duplicateCount: 0,
        orderedEventIds: ["event-1", "event-2"],
        canonicalResultHash: "a".repeat(64),
      },
      evaluation: {
        ruleId: "RAPID_PRICE_LIFT",
        ruleVersion: "1.1",
        result: "SUPPORTED",
        nonComparableEventCount: 0,
        findings: [
          "PRICE_CHANGE",
          "AGGRESSIVE_BUY_SHARE",
          "ACTOR_CONCENTRATION",
          "REPEATED_EXECUTION",
          "REMOVAL_SENSITIVITY",
        ].map((gate) => ({
          gate,
          ruleId: "RAPID_PRICE_LIFT",
          observedValue: "1.0000",
          threshold: "1",
          passed: true,
          referencedEventIds: ["event-1"],
        })),
        sensitivity: {
          comparison: "MECHANICAL_METRIC_COMPARISON",
          priceChangeBps: "100.0000",
          priceChangeBpsWithoutApprovedActors: "25.0000",
          removalSensitivityBps: "75.0000",
        },
      },
    });

    expect(response.evaluation?.result).toBe("SUPPORTED");
  });
});

describe("ReplayReviewResponseSchema", () => {
  it("rejects the removed scenario-level mapping review issue code", () => {
    expect(() =>
      ReplayReviewResponseSchema.parse({
        status: "REVIEW_REQUIRED",
        issues: [
          {
            code: "MAPPING_REVIEW_REQUIRED",
            path: ["scenario"],
            message: "Scenario mapping review is required.",
          },
        ],
      }),
    ).toThrow();
  });

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

  it.each([
    "CANONICAL_DATASET_HASH_MISMATCH",
    "INSTRUMENT_OUTSIDE_DATASET_PROFILE",
    "ACTOR_OUTSIDE_DATASET_PROFILE",
    "TIME_WINDOW_OUTSIDE_DATASET_PROFILE",
  ] as const)("accepts reachable case review issue code %s", (code) => {
    expect(
      ReplayReviewResponseSchema.parse({
        status: "REVIEW_REQUIRED",
        issues: [{ code, path: ["caseManifest"], message: "Review required" }],
      }),
    ).toMatchObject({ issues: [{ code }] });
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
