import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { committedReplayScenarios } from "@weavetrail/scenarios";

import {
  abbreviateHash,
  bpsToPercent,
  readableCompactDate,
  readableInstant,
  HASH_SCOPES,
  HashValue,
  Instant,
  REPORTED_VALUE_NOTE,
} from "./machine-values";

describe("machine value rendering", () => {
  it("abbreviates a hash to a form that still identifies it", () => {
    const hash = "a".repeat(24) + "b".repeat(40);
    const abbreviated = abbreviateHash(hash);
    expect(abbreviated).toBe(`${hash.slice(0, 8)}…${hash.slice(-8)}`);
    expect(abbreviated.length).toBeLessThan(hash.length);
  });

  it("leaves a value that is already short unchanged", () => {
    expect(abbreviateHash("short-value")).toBe("short-value");
  });

  it("keeps the exact canonical value beside every abbreviation", () => {
    const hash =
      committedReplayScenarios["rapid-price-lift-supported.csv"]
        .sourceArtifactHash;
    const markup = renderToStaticMarkup(
      createElement(HashValue, { scope: "sourceArtifact", value: hash }),
    );
    expect(markup).toContain(abbreviateHash(hash));
    expect(markup).toContain(hash);
    expect(markup).toContain("Covers");
  });

  it("states what every declared hash covers and what a comparison proves", () => {
    for (const scope of Object.values(HASH_SCOPES)) {
      expect(scope.label.length).toBeGreaterThan(0);
      expect(scope.covers.length).toBeGreaterThan(0);
      expect(scope.proves).toMatch(/A match/);
      expect(scope.proves).toMatch(/mismatch/i);
    }
  });

  it("converts basis points to a percentage by exact decimal shift", () => {
    expect(bpsToPercent("250")).toBe("2.50");
    expect(bpsToPercent("12.5")).toBe("0.125");
    expect(bpsToPercent("5")).toBe("0.05");
    expect(bpsToPercent("0")).toBe("0.00");
    expect(bpsToPercent("-30")).toBe("-0.30");
    expect(bpsToPercent("10000")).toBe("100.00");
    expect(bpsToPercent("200.0000")).toBe("2.00");
    expect(bpsToPercent("125.0000")).toBe("1.25");
    expect(bpsToPercent("0.0125")).toBe("0.000125");
  });

  it("returns null rather than guessing at a value that is not decimal", () => {
    expect(bpsToPercent("n/a")).toBeNull();
    expect(bpsToPercent("")).toBeNull();
  });

  it("renders an instant readably and keeps its canonical string", () => {
    expect(readableInstant("2026-08-25T09:00:02.000+09:00")).toBe(
      "2026-08-25 09:00:02.000 (UTC+09:00)",
    );
    expect(readableInstant("2026-08-25T00:00:02.080Z")).toBe(
      "2026-08-25 00:00:02.080 (UTC)",
    );
    const markup = renderToStaticMarkup(
      createElement(Instant, { value: "2026-08-25T09:00:02.000+09:00" }),
    );
    expect(markup).toMatch(/datetime="2026-08-25T09:00:02\.000\+09:00"/i);
    expect(markup).toContain("2026-08-25T09:00:02.000+09:00");
  });

  it("leaves an instant it does not recognise exactly as it was given", () => {
    expect(readableInstant("20260825")).toBe("20260825");
    expect(readableCompactDate("20260903")).toBe("2026-09-03");
    expect(readableCompactDate("not-a-date")).toBe("not-a-date");
  });
});

describe("displayed hashes on the core surface", () => {
  it("gives every hash the workbench prints an abbreviation and a scope statement", async () => {
    const { ApprovalReceipt, SourceRows, RapidPriceLiftEvaluation } =
      await import("./case-replay");
    const { RapidPriceLiftResultSchema } =
      await import("@weavetrail/contracts");
    const { buildFindingSourceTrace, replayApproved, sha256Canonical } =
      await import("@weavetrail/replay-engine");
    const { rapidPriceLiftScenarios } = await import("@weavetrail/scenarios");

    const scenario = "rapid-price-lift-supported.csv";
    const fixture = rapidPriceLiftScenarios[scenario];
    const approval = {
      approvedArtifactHash: sha256Canonical(fixture.mappingProposal),
      reviewerRef: "reviewer:test",
      decision: "APPROVED" as const,
      overrides: [],
      approvedAt: "2026-09-01T00:00:00Z",
    };
    const replay = replayApproved(
      fixture.rows,
      fixture.rows,
      fixture.mappingProposal,
      approval,
      fixture.manifest,
      "baseline",
    );
    if (!("canonicalResultHash" in replay) || !("evaluation" in replay))
      throw new Error("Expected evaluated fixture");
    const evaluation = RapidPriceLiftResultSchema.parse(replay.evaluation);
    const sourceTrace = buildFindingSourceTrace(
      replay.events,
      evaluation.findings,
      fixture.rows,
    );

    const markup = [
      renderToStaticMarkup(
        createElement(SourceRows, {
          scenario: {
            value: scenario,
            label: fixture.label,
            sourceArtifactHash: fixture.sourceArtifactHash,
            rows: fixture.rows,
            manifest: fixture.manifest,
          },
        }),
      ),
      renderToStaticMarkup(createElement(ApprovalReceipt, { approval })),
      renderToStaticMarkup(
        createElement(RapidPriceLiftEvaluation, {
          evaluation,
          sourceTrace,
          scenario,
        }),
      ),
    ].join("\n");

    const hashes = [...new Set(markup.match(/\b[a-f0-9]{64}\b/g) ?? [])];
    expect(hashes.length).toBeGreaterThan(0);
    for (const hash of hashes) {
      expect(markup, hash).toContain(abbreviateHash(hash));
      expect(markup, hash).toContain("Covers ");
    }
  });
});

describe("hash scope statements against what the code hashes", () => {
  it("keeps the approved artifact hash independent of the override reasons beside it", async () => {
    const { attemptApproval } = await import("./case-replay");
    const { rapidPriceLiftScenarios } = await import("@weavetrail/scenarios");
    const proposal =
      rapidPriceLiftScenarios["rapid-price-lift-supported.csv"].mappingProposal;

    const withoutOverrides = await attemptApproval(proposal, []);
    const withOverrides = await attemptApproval(proposal, [
      { fieldPath: "fields.0", reason: "reviewed by hand" },
    ]);

    expect(withoutOverrides.approval?.approvedArtifactHash).toBe(
      withOverrides.approval?.approvedArtifactHash,
    );
    expect(withOverrides.approval?.overrides).toHaveLength(1);
    // The statement shown beside this hash must not claim the overrides.
    expect(HASH_SCOPES.approvedArtifact.covers).toContain("the proposal alone");
    expect(HASH_SCOPES.approvedArtifact.covers).toMatch(/not inside it/);
  });

  it("does not claim a matching result hash proves identical approvals", () => {
    expect(HASH_SCOPES.canonicalResult.proves).toContain(
      "does not prove the two requests carried the same approval records",
    );
  });

  it("describes the raw row hash as a canonical projection rather than bytes", () => {
    expect(HASH_SCOPES.rawRow.covers).toContain("parsed column values");
    expect(HASH_SCOPES.rawRow.covers).toContain(
      "not the artifact's original bytes",
    );
  });
});

describe("reported values against the exact comparison", () => {
  it("says a reported rate is truncated and that the verdict uses the exact value", () => {
    expect(REPORTED_VALUE_NOTE).toMatch(/truncated to four decimals/);
    expect(REPORTED_VALUE_NOTE).toMatch(/computed on the exact value/);
  });

  it("shows that note wherever a reported rate sits beside a threshold or a difference", async () => {
    const { RapidPriceLiftEvaluation } = await import("./case-replay");
    const { RapidPriceLiftResultSchema } =
      await import("@weavetrail/contracts");
    const { buildFindingSourceTrace, replayApproved, sha256Canonical } =
      await import("@weavetrail/replay-engine");
    const { rapidPriceLiftScenarios } = await import("@weavetrail/scenarios");

    const scenario = "rapid-price-lift-supported.csv";
    const fixture = rapidPriceLiftScenarios[scenario];
    const replay = replayApproved(
      fixture.rows,
      fixture.rows,
      fixture.mappingProposal,
      {
        approvedArtifactHash: sha256Canonical(fixture.mappingProposal),
        reviewerRef: "reviewer:test",
        decision: "APPROVED",
        overrides: [],
        approvedAt: "2026-09-01T00:00:00Z",
      },
      fixture.manifest,
      "baseline",
    );
    if (!("canonicalResultHash" in replay) || !("evaluation" in replay))
      throw new Error("Expected evaluated fixture");
    const evaluation = RapidPriceLiftResultSchema.parse(replay.evaluation);
    const markup = renderToStaticMarkup(
      createElement(RapidPriceLiftEvaluation, {
        evaluation,
        sourceTrace: buildFindingSourceTrace(
          replay.events,
          evaluation.findings,
          fixture.rows,
        ),
        scenario,
      }),
    );

    expect(evaluation.sensitivity).toBeDefined();
    expect([
      ...markup.matchAll(/Rates are reported truncated to four decimals/g),
    ]).toHaveLength(2);
  });
});
