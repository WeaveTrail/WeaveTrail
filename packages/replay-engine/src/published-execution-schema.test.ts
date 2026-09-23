import { readFileSync } from "node:fs";

import { CaseManifestSchema } from "@weavetrail/contracts";
import {
  publishedExecutionConflictProposal,
  publishedExecutionConflictRows,
  publishedExecutionFixMapping,
  publishedExecutionFixProposal,
  publishedExecutionFixRows,
  publishedExecutionH0stcnt0Mapping,
  publishedExecutionH0stcnt0Proposal,
  publishedExecutionH0stcnt0Rows,
  publishedExecutionManifest,
} from "@weavetrail/scenarios";
import { describe, expect, it, vi } from "vitest";

import {
  caseManifestProposal,
  mappingApprovalArtifact,
  replayApproved,
} from "./approval-validation";
import { sha256Canonical } from "./canonical-hash";
import { canonicalizeEvents, projectCanonicalEvent } from "./canonicalize";
import { computeDatasetProfile } from "./dataset-profile";
import { replayRapidPriceLift } from "./rapid-price-lift";
import { RequestWorkflow } from "./request-workflow";
import {
  applyApprovedMapping,
  parseCsvSourceArtifact,
  parseJsonLinesSourceArtifact,
} from "./source-ingest";
import { buildFindingSourceTrace } from "./source-trace";
import * as rule from "./rapid-price-lift";

function artifactBytes(name: string): Buffer {
  return readFileSync(
    new URL(`../../scenarios/src/sources/${name}`, import.meta.url),
  );
}

function approvedEvents(
  rows: typeof publishedExecutionFixRows,
  mapping: typeof publishedExecutionFixMapping,
): ReturnType<typeof canonicalizeEvents>["events"];
function approvedEvents(
  rows: typeof publishedExecutionH0stcnt0Rows,
  mapping: typeof publishedExecutionH0stcnt0Mapping,
): ReturnType<typeof canonicalizeEvents>["events"];
function approvedEvents(
  rows:
    typeof publishedExecutionFixRows | typeof publishedExecutionH0stcnt0Rows,
  mapping:
    | typeof publishedExecutionFixMapping
    | typeof publishedExecutionH0stcnt0Mapping,
) {
  const application = applyApprovedMapping(rows, mapping);
  if (application.status !== "APPROVED") {
    throw new Error(JSON.stringify(application));
  }
  return canonicalizeEvents(application.events).events;
}

function mappingApproval(
  proposal:
    | typeof publishedExecutionFixProposal
    | typeof publishedExecutionH0stcnt0Proposal,
  overrides: { fieldPath: string; reason: string }[] = [],
) {
  return {
    approvedArtifactHash: sha256Canonical(mappingApprovalArtifact(proposal)),
    reviewerRef: "reviewer-fixture",
    decision: "APPROVED" as const,
    overrides,
    approvedAt: "2026-09-07T15:35:08Z",
  };
}

describe("published execution schema synthetic scenario", () => {
  it("records approval at the fixture's initial authored instant", () => {
    expect(publishedExecutionManifest.approval.approvedAt).toBe(
      "2026-09-07T15:35:08Z",
    );
  });

  it("pins every declared row to parser output", () => {
    expect(
      parseCsvSourceArtifact(
        artifactBytes("published-execution-fix44.csv"),
        publishedExecutionFixProposal.sourceArtifactHash,
      ),
    ).toEqual(publishedExecutionFixRows);
    expect(
      parseJsonLinesSourceArtifact(
        artifactBytes("published-execution-h0stcnt0.jsonl"),
        publishedExecutionH0stcnt0Proposal.sourceArtifactHash,
      ),
    ).toEqual(publishedExecutionH0stcnt0Rows);
    expect(
      parseCsvSourceArtifact(
        artifactBytes("published-execution-fix44-conflicting-evidence.csv"),
        publishedExecutionConflictProposal.sourceArtifactHash,
      ),
    ).toEqual(publishedExecutionConflictRows);
  });

  it.each([
    [publishedExecutionConflictRows],
    [[...publishedExecutionConflictRows].reverse()],
  ])(
    "routes committed conflicting FIX identity evidence to input review with no result hash",
    (rows) => {
      const workflow = new RequestWorkflow();
      const result = replayApproved(
        rows,
        publishedExecutionConflictRows,
        publishedExecutionConflictProposal,
        {
          approvedArtifactHash: sha256Canonical(
            mappingApprovalArtifact(publishedExecutionConflictProposal),
          ),
          reviewerRef: "reviewer-fixture",
          decision: "APPROVED",
          overrides: [],
          approvedAt: "2026-09-08T00:00:00Z",
        },
        undefined,
        "baseline",
        workflow,
      );

      expect(workflow.state).toBe("INPUT_REVIEW_REQUIRED");
      expect(result).toMatchObject({
        accepted: false,
        status: "REVIEW_REQUIRED",
        issues: [
          expect.objectContaining({
            code: "CONFLICTING_SOURCE_IDENTITY",
            path: ["rows"],
          }),
        ],
      });
      expect(result).not.toHaveProperty("canonicalResultHash");
    },
  );

  it("normalizes every field carried by both published schemas to the same value", () => {
    const fixEvents = approvedEvents(
      publishedExecutionFixRows,
      publishedExecutionFixMapping,
    );
    const h0stcnt0Events = approvedEvents(
      publishedExecutionH0stcnt0Rows,
      publishedExecutionH0stcnt0Mapping,
    );
    const sharedFields = [
      "schemaVersion",
      "eventId",
      "sourceEventId",
      "datasetId",
      "venueId",
      "eventTime",
      "instrumentId",
      "eventType",
      "side",
      "price",
      "quantity",
    ] as const;

    expect(fixEvents).toHaveLength(h0stcnt0Events.length);
    for (const [index, fixEvent] of fixEvents.entries()) {
      const h0stcnt0Event = h0stcnt0Events[index]!;
      expect(
        Object.fromEntries(
          sharedFields.map((field) => [field, fixEvent[field]]),
        ),
      ).toEqual(
        Object.fromEntries(
          sharedFields.map((field) => [field, h0stcnt0Event[field]]),
        ),
      );
      expect(fixEvent.actorId).toMatch(/^SYNTH-ACCOUNT-/);
      expect(h0stcnt0Event).not.toHaveProperty("actorId");
    }

    const fixProfile = computeDatasetProfile(fixEvents);
    const h0stcnt0Profile = computeDatasetProfile(h0stcnt0Events);
    expect(fixProfile.canonicalDatasetHash).not.toBe(
      h0stcnt0Profile.canonicalDatasetHash,
    );
    expect(h0stcnt0Profile.actorIds).toEqual([]);
    expect(
      fixEvents.map((event) => {
        const projection = projectCanonicalEvent(event);
        delete projection.actorId;
        return projection;
      }),
    ).toEqual(h0stcnt0Events.map(projectCanonicalEvent));
  });

  it("requires a justified override for the absent H0STCNT0 actor declaration", () => {
    const workflow = new RequestWorkflow();
    const result = replayApproved(
      publishedExecutionH0stcnt0Rows,
      publishedExecutionH0stcnt0Rows,
      publishedExecutionH0stcnt0Proposal,
      mappingApproval(publishedExecutionH0stcnt0Proposal),
      undefined,
      "baseline",
      workflow,
    );

    expect(workflow.state).toBe("MAPPING_REVIEW_REQUIRED");
    expect(result).toEqual({
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: [
        {
          code: "MAPPING_OVERRIDE_REQUIRED",
          path: ["mappingApproval", "overrides"],
          message:
            "A justified override for proposal fieldPath unmappedFields.0 is required.",
        },
      ],
    });
    expect(result).not.toHaveProperty("canonicalResultHash");
  });

  it("cannot run the participant rule over H0STCNT0 even after acknowledging the absent field", () => {
    const evaluator = vi.spyOn(rule, "replayRapidPriceLift");
    const events = approvedEvents(
      publishedExecutionH0stcnt0Rows,
      publishedExecutionH0stcnt0Mapping,
    );
    const profile = computeDatasetProfile(events);
    const proposal = {
      ...caseManifestProposal(publishedExecutionManifest),
      canonicalDatasetHash: profile.canonicalDatasetHash,
    };
    const manifest = CaseManifestSchema.parse({
      ...proposal,
      approval: {
        ...publishedExecutionManifest.approval,
        approvedArtifactHash: sha256Canonical(proposal),
      },
    });
    const workflow = new RequestWorkflow();
    const result = replayApproved(
      publishedExecutionH0stcnt0Rows,
      publishedExecutionH0stcnt0Rows,
      publishedExecutionH0stcnt0Proposal,
      mappingApproval(publishedExecutionH0stcnt0Proposal, [
        {
          fieldPath: "unmappedFields.0",
          reason:
            "Acknowledge that this source cannot supply participant identity.",
        },
      ]),
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
  });

  it("uses only fictional identities and values conforming to cited session and tick rules", () => {
    const instrument = publishedExecutionFixRows[0]!.values["Symbol(55)"]!;
    const designTest = readFileSync(
      new URL(
        "../../../apps/web/src/app/design-surface.test.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const forbiddenBlock = /const forbidden = \[([\s\S]*?)\];/.exec(
      designTest,
    )?.[1];
    const forbiddenValues = new Set(
      [...(forbiddenBlock?.matchAll(/"([^"]+)"/g) ?? [])].map(
        (match) => match[1],
      ),
    );

    expect(instrument).toBe("ZZ79X1");
    expect(instrument).not.toMatch(/^\d{6}$/);
    expect(forbiddenValues.has(instrument)).toBe(false);
    for (const row of publishedExecutionH0stcnt0Rows) {
      expect(row.values.STCK_CNTG_HOUR >= "090000").toBe(true);
      expect(row.values.STCK_CNTG_HOUR <= "153000").toBe(true);
      expect(BigInt(row.values.STCK_PRPR) % 50n).toBe(0n);
    }
    for (const row of publishedExecutionFixRows) {
      expect(row.values["Account(1)"]).toMatch(/^SYNTH-ACCOUNT-/);
    }
  });

  it("pins the artifact, dataset, manifest approval and canonical result hashes", () => {
    const events = approvedEvents(
      publishedExecutionFixRows,
      publishedExecutionFixMapping,
    );
    const profile = computeDatasetProfile(events);
    const replay = replayRapidPriceLift(events, publishedExecutionManifest);
    const trace = buildFindingSourceTrace(
      replay.events,
      replay.evaluation.findings,
      publishedExecutionFixRows,
    );

    expect(publishedExecutionFixProposal.sourceArtifactHash).toBe(
      "f623c3327251b5323b07d066cb940bee0ac0ed895c39fb81707469ae1e1f958b",
    );
    expect(profile.canonicalDatasetHash).toBe(
      "8ff6d5cd9b8c5362e9bcfd9337a8c52c5cbfb226eba29c10d353134e39c0d3c5",
    );
    expect(publishedExecutionManifest.canonicalDatasetHash).toBe(
      profile.canonicalDatasetHash,
    );
    expect(
      sha256Canonical(caseManifestProposal(publishedExecutionManifest)),
    ).toBe("25bcfc09b1e1443d961a543e685f50b7d9cfbdff02365f87eb455b85984aae88");
    expect(publishedExecutionManifest.approval.approvedArtifactHash).toBe(
      "25bcfc09b1e1443d961a543e685f50b7d9cfbdff02365f87eb455b85984aae88",
    );
    expect(replay.evaluation.result).toBe("SUPPORTED");
    expect(replay.canonicalResultHash).toBe(
      "46879311285315bde660914487063074b8ea45ce186beef230e57f1691662d6a",
    );
    expect(trace.entries).not.toHaveLength(0);
    expect(
      trace.entries.every(
        ({ sourceRow }) =>
          sourceRow.coordinate.sourceArtifactHash ===
          publishedExecutionFixProposal.sourceArtifactHash,
      ),
    ).toBe(true);
  });
});
