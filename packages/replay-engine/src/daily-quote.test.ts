import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CaseManifestSchema,
  type CaseManifestProposal,
} from "@weavetrail/contracts";
import { applyApprovedMapping, deriveRawRowHash } from "./source-ingest";
import { replayApproved } from "./approval-validation";
import { computeDatasetProfile } from "./dataset-profile";
import { replayFoundation } from "./replay-foundation";
import { sha256Canonical } from "./canonical-hash";
import { RequestWorkflow } from "./request-workflow";
import * as rule from "./rapid-price-lift";

import { syntheticDailyQuoteSpecimen as specimen } from "./testing/daily-quotes";

afterEach(() => vi.restoreAllMocks());

describe("synthetic daily quote ingestion and stopping point", () => {
  it("counts the kind constant, preserves source identity/row evidence and omits unavailable fields", () => {
    const { rows, mapping } = specimen();
    const result = applyApprovedMapping(rows, mapping);
    expect(result.status).toBe("APPROVED");
    if (result.status !== "APPROVED") throw new Error("Expected approval");
    expect(result.events[0]).toEqual({
      ...mapping.constants,
      sourceEventId: "synthetic-B",
      eventId: "event:synthetic-daily-v1:SYNTH-X:synthetic-B",
      instrumentId: "SYNTH-B",
      eventTime: "2024-02-29T00:00:00+09:00",
      price: "100",
      quantity: "9007199254740993",
      rawRowHash: deriveRawRowHash(rows[0]!),
    });
    for (const event of result.events)
      for (const field of [
        "side",
        "actorId",
        "counterpartyId",
        "orderId",
        "sequence",
        "receivedAt",
      ])
        expect(Object.hasOwn(event, field)).toBe(false);
    expect(computeDatasetProfile(result.events).actorIds).toEqual([]);
    expect(rows[0]!.values.close).toBe("100.00");
  });

  it("rejects constant plus field target before any row can overwrite it", () => {
    const { rows, mapping } = specimen();
    const result = applyApprovedMapping(rows, {
      ...mapping,
      fields: [
        ...mapping.fields.filter(([name]) => name !== "note"),
        ["note", "eventType", "IDENTITY"],
      ],
    });
    expect(result).toEqual({
      status: "REVIEW_REQUIRED",
      issues: [
        {
          code: "DUPLICATE_TARGET_FIELD",
          message:
            'Approved mapping assigns target field "eventType" more than once',
        },
      ],
    });
    expect(result).not.toHaveProperty("events");
  });

  it.each([
    "20230229",
    "19000229",
    "20240431",
    "20240001",
    "20241301",
    "20240100",
    "00000101",
    "2024029",
    " 20240229",
    "20240229 ",
    "2024-02-29T00:00:00Z",
    "２０２４０２２９",
  ])("rejects invalid trading date %s without rollover", (date) => {
    const { rows, mapping } = specimen(date);
    const result = applyApprovedMapping(rows, mapping);
    expect(result.status).toBe("REVIEW_REQUIRED");
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "TRANSFORM_REJECTED_VALUE",
        sourceColumn: "date",
      }),
    );
  });

  it.each(["UTC", "America/Los_Angeles", "Asia/Seoul"])(
    "anchors leap day explicitly regardless of local zone %s",
    (zone) => {
      const previous = process.env.TZ;
      try {
        process.env.TZ = zone;
        const { rows, mapping } = specimen("20000229");
        const result = applyApprovedMapping(rows, mapping);
        if (result.status !== "APPROVED") throw new Error("Expected approval");
        expect(result.events[0]!.eventTime).toBe("2000-02-29T00:00:00+09:00");
        expect(replayFoundation(result.events).events[0]!.eventTime).toBe(
          "2000-02-28T15:00:00.000000000Z",
        );
      } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
      }
    },
  );

  it.each([undefined, [], [{ fieldPath: "fields.2", reason: " " }]])(
    "requires approval and all nonblank reasons",
    (overrides) => {
      const { rows, proposal, approval } = specimen();
      const workflow = new RequestWorkflow();
      const result = replayApproved(
        rows,
        rows,
        proposal,
        overrides === undefined ? undefined : { ...approval, overrides },
        undefined,
        "baseline",
        workflow,
      );
      expect(workflow.state).toBe("MAPPING_REVIEW_REQUIRED");
      expect(result).not.toHaveProperty("canonicalResultHash");
      expect(result).toMatchObject({
        accepted: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            code:
              overrides === undefined
                ? "APPROVAL_RECORD_REQUIRED"
                : "MAPPING_OVERRIDE_REQUIRED",
          }),
        ]),
      });
    },
  );

  it("binds review evidence and constants to the exact proposal approval", () => {
    const { rows, proposal, approval } = specimen();
    const changed = {
      ...proposal,
      constants: { ...proposal.constants, venueId: "OTHER-SYNTH" },
    };
    expect(
      replayApproved(rows, rows, changed, approval, undefined),
    ).toMatchObject({
      accepted: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "APPROVED_ARTIFACT_HASH_MISMATCH" }),
      ]),
    });
  });

  it("normalizes without a case and preserves semantic hashes on repeats, shuffle and derived duplicate", () => {
    const { rows, proposal, approval } = specimen();
    const results = (
      ["baseline", "baseline", "shuffle", "duplicate"] as const
    ).map((mutation) => {
      const workflow = new RequestWorkflow();
      const result = replayApproved(
        mutation === "shuffle" ? [...rows].reverse() : rows,
        rows,
        proposal,
        approval,
        undefined,
        mutation,
        workflow,
      );
      expect(workflow.state).toBe("MAPPING_APPROVED");
      if (!("canonicalResultHash" in result))
        throw new Error("Expected normalization");
      expect(result).not.toHaveProperty("evaluation");
      expect(result).not.toHaveProperty("sourceTrace");
      return result;
    });
    expect(
      new Set(results.map((result) => result.canonicalResultHash)).size,
    ).toBe(1);
    expect(
      new Set(
        results.map(
          (result) => computeDatasetProfile(result.events).canonicalDatasetHash,
        ),
      ).size,
    ).toBe(1);
    expect(results.map((result) => result.duplicateCount)).toEqual([
      0, 0, 0, 1,
    ]);
    expect(results[0]!.orderedEventIds).toEqual([
      "event:synthetic-daily-v1:SYNTH-X:synthetic-A",
      "event:synthetic-daily-v1:SYNTH-X:synthetic-B",
    ]);
    expect(results[0]!.canonicalResultHash).toMatchInlineSnapshot(
      `"d673c2ba42c37fb40be2f07a50110b3e7916fc652534d4f3c185e7ffbcb63bac"`,
    );
  });

  it("refuses an explicitly untrusted actor claim before invoking the evaluator or approving the case", () => {
    const evaluator = vi.spyOn(rule, "replayRapidPriceLift");
    const { rows, proposal, approval, mapping } = specimen();
    const application = applyApprovedMapping(rows, mapping);
    if (application.status !== "APPROVED") throw new Error("Expected approval");
    const profile = computeDatasetProfile(application.events);
    const attemptedCase: CaseManifestProposal = {
      manifestVersion: "1.3",
      caseId: "untrusted-negative-test",
      canonicalDatasetHash: profile.canonicalDatasetHash,
      hypothesis: {
        pattern: "RAPID_PRICE_LIFT",
        instrumentId: profile.instrumentIds[0]!,
        actorIds: ["untrusted-claim"],
        startTime: profile.earliestEventTime,
        endTime: profile.latestEventTime,
      },
      rules: [],
      aiTrace: {
        provider: "fixture",
        model: "negative-test",
        promptVersion: "test",
        confidence: 0,
        referencedEventIds: [],
      },
    };
    const manifest = CaseManifestSchema.parse({
      ...attemptedCase,
      approval: {
        ...approval,
        overrides: [],
        approvedArtifactHash: sha256Canonical(attemptedCase),
      },
    });
    const workflow = new RequestWorkflow();
    const transition = vi.spyOn(workflow, "requireTransition");
    const result = replayApproved(
      rows,
      rows,
      proposal,
      approval,
      manifest,
      "baseline",
      workflow,
    );
    expect(result).toEqual({
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: [
        {
          code: "ACTOR_OUTSIDE_DATASET_PROFILE",
          path: ["caseManifest", "hypothesis", "actorIds", 0],
        },
      ],
    });
    expect(workflow.state).toBe("CASE_REVIEW_REQUIRED");
    expect(evaluator).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalledWith("CASE_APPROVED");
    expect(transition).not.toHaveBeenCalledWith("REPLAYED");
    expect(
      CaseManifestSchema.safeParse({
        ...manifest,
        hypothesis: { ...manifest.hypothesis, actorIds: [] },
      }).success,
    ).toBe(false);
    const badApproval = {
      ...manifest,
      approval: { ...manifest.approval, approvedArtifactHash: "0".repeat(64) },
    };
    expect(
      replayApproved(rows, rows, proposal, approval, badApproval),
    ).toMatchObject({
      issues: [
        {
          code: "APPROVED_ARTIFACT_HASH_MISMATCH",
          path: ["caseManifest", "approval", "approvedArtifactHash"],
        },
      ],
    });
  });
});
