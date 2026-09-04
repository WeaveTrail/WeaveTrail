import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ReplayRequestSchema,
  ReplayResultResponseSchema,
  ReplayReviewResponseSchema,
  type ReplayReviewResponse,
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
      workflowState: "MAPPING_APPROVED",
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
      workflowState: "REPLAYED",
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

    expect(response.workflowState).toBe("REPLAYED");
    if (response.workflowState !== "REPLAYED") {
      throw new Error("expected evaluated replay branch");
    }
    expect(response.evaluation.result).toBe("SUPPORTED");
  });

  it("rejects REPLAYED without an evaluation", () => {
    expect(
      ReplayResultResponseSchema.safeParse({
        mode: "fixture",
        workflowState: "REPLAYED",
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
      }).success,
    ).toBe(false);
  });

  it("rejects MAPPING_APPROVED with an evaluation", () => {
    const evaluated = ReplayResultResponseSchema.parse({
      mode: "fixture",
      workflowState: "REPLAYED",
      scenario: "concentrated-buy-dialect-a.csv",
      mutation: "baseline",
      boundary: "Deterministic replay boundary.",
      replay: {
        engineVersion: "0.7.0-canonical-decimal",
        inputEventCount: 0,
        canonicalEventCount: 0,
        duplicateCount: 0,
        orderedEventIds: [],
        canonicalResultHash: "a".repeat(64),
      },
      evaluation: {
        ruleId: "RAPID_PRICE_LIFT",
        ruleVersion: "1.1",
        result: "INCONCLUSIVE",
        reason: "INSUFFICIENT_ELIGIBLE_EVENTS",
        nonComparableEventCount: 0,
        findings: [],
        sensitivity: null,
      },
    });

    expect(
      ReplayResultResponseSchema.safeParse({
        ...evaluated,
        workflowState: "MAPPING_APPROVED",
      }).success,
    ).toBe(false);
  });

  it.each(["UPLOADED", "CASE_APPROVED", "INPUT_REVIEW_REQUIRED"] as const)(
    "rejects non-result workflow state %s",
    (workflowState) => {
      expect(
        ReplayResultResponseSchema.safeParse({
          mode: "fixture",
          workflowState,
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
        }).success,
      ).toBe(false);
    },
  );
});

describe("ReplayReviewResponseSchema", () => {
  const reviewResponse = (workflowState: string, codes: readonly string[]) => ({
    status: "REVIEW_REQUIRED",
    workflowState,
    issues: codes.map((code) => ({
      code,
      path: [],
      message: "Review required",
    })),
  });

  it("preserves workflow stage and issue code correlation in the inferred type", () => {
    const response = {} as ReplayReviewResponse;
    if (response.workflowState === "MAPPING_REVIEW_REQUIRED") {
      expectTypeOf<(typeof response.issues)[number]["code"]>().toEqualTypeOf<
        | "MAPPING_OVERRIDE_REQUIRED"
        | "APPROVAL_RECORD_REQUIRED"
        | "APPROVAL_REJECTED"
        | "APPROVED_ARTIFACT_HASH_MISMATCH"
        | "MAPPING_APPLICATION_REVIEW_REQUIRED"
      >();
    }
  });

  it("rejects the removed scenario-level mapping review issue code", () => {
    expect(() =>
      ReplayReviewResponseSchema.parse({
        status: "REVIEW_REQUIRED",
        workflowState: "MAPPING_REVIEW_REQUIRED",
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
        workflowState: "MAPPING_REVIEW_REQUIRED",
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
        workflowState: "CASE_REVIEW_REQUIRED",
        issues: [{ code, path: ["caseManifest"], message: "Review required" }],
      }),
    ).toMatchObject({ issues: [{ code }] });
  });

  it("requires a code and path for every review issue", () => {
    expect(
      ReplayReviewResponseSchema.parse({
        status: "REVIEW_REQUIRED",
        workflowState: "INPUT_REVIEW_REQUIRED",
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

  it.each([
    ["INPUT_REVIEW_REQUIRED", "INVALID_REQUEST"],
    ["MAPPING_REVIEW_REQUIRED", "MAPPING_OVERRIDE_REQUIRED"],
    ["CASE_REVIEW_REQUIRED", "RULE_CONFIGURATION_REQUIRED"],
  ] as const)("accepts %s with its stage issue %s", (workflowState, code) => {
    expect(
      ReplayReviewResponseSchema.safeParse(
        reviewResponse(workflowState, [code]),
      ).success,
    ).toBe(true);
  });

  it.each([
    ["MAPPING_REVIEW_REQUIRED", "INVALID_JSON"],
    ["INPUT_REVIEW_REQUIRED", "ACTOR_OUTSIDE_DATASET_PROFILE"],
    ["CASE_REVIEW_REQUIRED", "SOURCE_ROW_MISSING"],
  ] as const)(
    "rejects %s with incompatible issue %s",
    (workflowState, code) => {
      expect(
        ReplayReviewResponseSchema.safeParse(
          reviewResponse(workflowState, [code]),
        ).success,
      ).toBe(false);
    },
  );

  it.each([
    "APPROVAL_RECORD_REQUIRED",
    "APPROVAL_REJECTED",
    "APPROVED_ARTIFACT_HASH_MISMATCH",
  ] as const)(
    "accepts shared approval issue %s for mapping and case",
    (code) => {
      for (const workflowState of [
        "MAPPING_REVIEW_REQUIRED",
        "CASE_REVIEW_REQUIRED",
      ] as const) {
        expect(
          ReplayReviewResponseSchema.safeParse(
            reviewResponse(workflowState, [code]),
          ).success,
        ).toBe(true);
      }
    },
  );

  it("accepts mapping application review for mapping and input", () => {
    for (const workflowState of [
      "MAPPING_REVIEW_REQUIRED",
      "INPUT_REVIEW_REQUIRED",
    ] as const) {
      expect(
        ReplayReviewResponseSchema.safeParse(
          reviewResponse(workflowState, [
            "MAPPING_APPLICATION_REVIEW_REQUIRED",
          ]),
        ).success,
      ).toBe(true);
    }
  });

  it("rejects the whole response when one of several issues is incompatible", () => {
    expect(
      ReplayReviewResponseSchema.safeParse(
        reviewResponse("INPUT_REVIEW_REQUIRED", [
          "INVALID_REQUEST",
          "RULE_CONFIGURATION_REQUIRED",
        ]),
      ).success,
    ).toBe(false);
  });

  it.each(["UPLOADED", "MAPPING_APPROVED", "REPLAYED"] as const)(
    "rejects non-review workflow state %s",
    (workflowState) => {
      expect(
        ReplayReviewResponseSchema.safeParse({
          status: "REVIEW_REQUIRED",
          workflowState,
          issues: [
            { code: "INVALID_REQUEST", path: [], message: "Review required" },
          ],
        }).success,
      ).toBe(false);
    },
  );
});
