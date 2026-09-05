import { describe, expect, it } from "vitest";
import {
  ReplayResultResponseSchema,
  ReplayReviewResponseSchema,
} from "./replay-request";
import { RapidPriceLiftGateSchema } from "./rapid-price-lift";
import { SourceTraceSchema } from "./source-trace";

function response() {
  const entries = ["event-1", "event-2"].map((eventId, index) => ({
    event: {
      schemaVersion: "1.1",
      eventId,
      sourceEventId: `source-${index}`,
      datasetId: "synthetic",
      venueId: "SYNTH-X",
      eventTime: "2026-09-01T00:00:00Z",
      instrumentId: "WT",
      eventType: "TRADE",
      rawRowHash: "b".repeat(64),
    },
    sourceRow: {
      coordinate: {
        sourceArtifactHash: "c".repeat(64),
        rowNumber: String(index + 2),
      },
      values: { id: `source-${index}` },
    },
  }));
  return {
    mode: "fixture",
    workflowState: "REPLAYED",
    scenario: "rapid-price-lift-supported.csv",
    mutation: "baseline",
    boundary: "Fixture replay.",
    replay: {
      engineVersion: "0.7.0-canonical-decimal",
      inputEventCount: 2,
      canonicalEventCount: 2,
      duplicateCount: 0,
      orderedEventIds: ["event-1", "event-2"],
      canonicalResultHash: "a".repeat(64),
    },
    sourceTrace: { traceVersion: "1.0", entries },
    evaluation: {
      ruleId: "RAPID_PRICE_LIFT",
      ruleVersion: "1.1",
      result: "SUPPORTED",
      nonComparableEventCount: 0,
      findings: RapidPriceLiftGateSchema.options.map((gate) => ({
        gate,
        ruleId: "RAPID_PRICE_LIFT",
        observedValue: "1",
        threshold: "1",
        passed: true,
        referencedEventIds: ["event-2", "event-1"],
      })),
      sensitivity: {
        comparison: "MECHANICAL_METRIC_COMPARISON",
        priceChangeBps: "1",
        priceChangeBpsWithoutApprovedActors: "0",
        removalSensitivityBps: "1",
      },
    },
  };
}

describe("source trace response contract", () => {
  it("accepts shared references with one entry per canonical event", () => {
    expect(ReplayResultResponseSchema.safeParse(response()).success).toBe(true);
  });

  it.each([
    "missing",
    "extra",
    "duplicate",
    "reordered",
    "outside replay",
    "unresolved reference",
  ] as const)("rejects %s entries", (kind) => {
    const body = response();
    if (kind === "missing") body.sourceTrace.entries.pop();
    if (kind === "extra")
      body.sourceTrace.entries.push({
        ...body.sourceTrace.entries[0]!,
        event: { ...body.sourceTrace.entries[0]!.event, eventId: "extra" },
      });
    if (kind === "duplicate")
      body.sourceTrace.entries[1] = body.sourceTrace.entries[0]!;
    if (kind === "reordered") body.sourceTrace.entries.reverse();
    if (kind === "outside replay") body.replay.orderedEventIds.pop();
    if (kind === "unresolved reference")
      body.evaluation.findings[0]!.referencedEventIds.push("missing");
    expect(ReplayResultResponseSchema.safeParse(body).success).toBe(false);
  });

  it.each([
    "raw hash",
    "artifact hash",
    "zero row",
    "negative row",
    "fraction row",
    "empty row",
    "numeric value",
    "event field",
    "row field",
    "coordinate field",
    "entry field",
    "trace field",
    "version",
  ] as const)("rejects malformed %s", (kind) => {
    const trace = response().sourceTrace;
    const entry = trace.entries[0]!;
    if (kind === "raw hash") entry.event.rawRowHash = "bad";
    if (kind === "artifact hash")
      entry.sourceRow.coordinate.sourceArtifactHash = "bad";
    if (kind === "zero row") entry.sourceRow.coordinate.rowNumber = "0";
    if (kind === "negative row") entry.sourceRow.coordinate.rowNumber = "-1";
    if (kind === "fraction row") entry.sourceRow.coordinate.rowNumber = "1.5";
    if (kind === "empty row") entry.sourceRow.coordinate.rowNumber = "";
    if (kind === "numeric value")
      Object.assign(entry.sourceRow.values, { id: 1 });
    if (kind === "event field")
      Object.assign(entry.event, { receivedAt: "2026-09-01T00:00:00Z" });
    if (kind === "row field")
      Object.assign(entry.sourceRow, { path: "internal" });
    if (kind === "coordinate field")
      Object.assign(entry.sourceRow.coordinate, { index: 0 });
    if (kind === "entry field") Object.assign(entry, { trace: "internal" });
    if (kind === "trace field") Object.assign(trace, { provider: "internal" });
    if (kind === "version") trace.traceVersion = "2.0";
    expect(SourceTraceSchema.safeParse(trace).success).toBe(false);
  });

  it("requires a trace on evaluated responses and forbids evidence for INCONCLUSIVE", () => {
    const { sourceTrace, ...body } = response();
    expect(ReplayResultResponseSchema.safeParse(body).success).toBe(false);
    const inconclusive = {
      ...body,
      evaluation: {
        ruleId: "RAPID_PRICE_LIFT",
        ruleVersion: "1.1",
        result: "INCONCLUSIVE",
        reason: "INSUFFICIENT_ELIGIBLE_EVENTS",
        nonComparableEventCount: 0,
        findings: [],
        sensitivity: null,
      },
    };
    expect(
      ReplayResultResponseSchema.safeParse({ ...inconclusive, sourceTrace })
        .success,
    ).toBe(false);
    expect(
      ReplayResultResponseSchema.safeParse({
        ...inconclusive,
        sourceTrace: { traceVersion: "1.0", entries: [] },
      }).success,
    ).toBe(true);
  });

  it("keeps foundation and review responses closed without trace", () => {
    const { sourceTrace, evaluation: _, ...body } = response();
    void _;
    const foundation = { ...body, workflowState: "MAPPING_APPROVED" };
    expect(ReplayResultResponseSchema.safeParse(foundation).success).toBe(true);
    expect(
      ReplayResultResponseSchema.safeParse({ ...foundation, sourceTrace })
        .success,
    ).toBe(false);
    const review = {
      status: "REVIEW_REQUIRED",
      workflowState: "INPUT_REVIEW_REQUIRED",
      issues: [{ code: "INVALID_REQUEST", path: [], message: "Invalid input" }],
    };
    expect(ReplayReviewResponseSchema.safeParse(review).success).toBe(true);
    expect(
      ReplayReviewResponseSchema.safeParse({ ...review, sourceTrace }).success,
    ).toBe(false);
  });
});
