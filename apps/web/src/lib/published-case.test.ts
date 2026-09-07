import { describe, expect, it } from "vitest";

import {
  mappingApprovalArtifact,
  sha256Canonical,
} from "@weavetrail/replay-engine";
import {
  fscKospi200BaselineProposal,
  fscKospi200FuturesProposal,
} from "@weavetrail/published-data";

import {
  ANALYSED_DATE,
  CLOSING_LEVEL_DENOMINATOR,
  NET_CHANGE_DENOMINATOR,
  PublishedCaseReviewRequired,
  publishedCaseProposal,
  publishedCaseSeries,
  replayPublishedCase,
  reviewedMappingApproval,
} from "./published-case";
import { REVIEWED_MAPPING_APPROVALS } from "./published-case-approvals";

function approvalFor(hash: string) {
  return {
    approvedArtifactHash: hash,
    reviewerRef: "reviewer:local-lab",
    decision: "APPROVED" as const,
    overrides: [],
    approvedAt: "2026-09-07T00:00:00Z",
  };
}

describe("the published 2026-09-03 case", () => {
  it("returns the pinned result, gate observations and canonical result hash", () => {
    const { proposal } = publishedCaseProposal();
    const replay = replayPublishedCase(approvalFor(sha256Canonical(proposal)));
    expect(replay.evaluation).toMatchObject({
      ruleId: "CROSS_MARKET_SESSION_REVERSAL",
      ruleVersion: "1.1",
      result: "SUPPORTED",
      analysis: {
        analysedDate: ANALYSED_DATE,
        rank: { position: "1", populationSize: "45" },
        candidateSelection: "STATED_DATE_ONLY_NO_CANDIDATE_SCAN",
        legs: [
          {
            legId: "spot-index",
            sessionReversal: "17.95",
            netChange: "1.29",
            relation: "OPPOSED",
            reversalMultiple: "13.9147",
          },
          {
            legId: "front-future",
            sessionReversal: "21.65",
            netChange: "0.85",
            relation: "OPPOSED",
            reversalMultiple: "25.4705",
          },
        ],
      },
    });
    // The hash covers this case's own approved scope, which declares rule
    // 1.1 and its denominators. The engine's published golden pins whatever
    // manifest it declares; the two agree only while both declare the same one.
    expect(replay.canonicalResultHash).toBe(
      "159ffac0f1845b89239ab905b3f5ab1f81ad7212e1ccbbf8ea74b3474b696a89",
    );
  });

  it("declares both denominators and reports the metric under each", () => {
    // The approved denominator is the day's net change, which is what the case
    // reported before it declared any: every gate observation above is
    // unchanged. The second denominator exists so the result can show how far
    // the same session moves when only the divisor changes.
    const { proposal } = publishedCaseProposal();
    const rule = proposal.rules[0]!;
    if (rule.ruleId !== "CROSS_MARKET_SESSION_REVERSAL")
      throw new Error("The published case declares one cross-market rule");
    expect(rule.ruleVersion).toBe("1.1");
    for (const leg of rule.parameters.legs) {
      expect("denominators" in leg && leg.denominators).toMatchObject([
        {
          denominatorId: NET_CHANGE_DENOMINATOR,
          meaning: "OBSERVED_PRICE_CHANGE",
        },
        {
          denominatorId: CLOSING_LEVEL_DENOMINATOR,
          meaning: "OBSERVED_PRICE_LEVEL",
        },
      ]);
    }
    const replay = replayPublishedCase(approvalFor(sha256Canonical(proposal)));
    const evaluation = replay.evaluation;
    if (evaluation.result === "INCONCLUSIVE" || !("sensitivity" in evaluation))
      throw new Error(
        "The published case must report a sensitivity comparison",
      );
    expect(evaluation.sensitivity).toMatchObject({
      comparison: "MECHANICAL_METRIC_COMPARISON",
      interpretation: "MECHANICAL_RECOMPUTATION_NOT_CAUSAL_CONCLUSION",
      legs: [
        {
          legId: "spot-index",
          approved: { denominatorValue: "1.29", metricValue: "13.9147" },
          alternatives: [
            {
              denominatorValue: "1032.82",
              metricValue: "0.0173",
              ratioToApprovedMetric: "0.0012",
            },
          ],
        },
        {
          legId: "front-future",
          approved: { denominatorValue: "0.85", metricValue: "25.4705" },
          alternatives: [
            {
              denominatorValue: "1030",
              metricValue: "0.021",
              ratioToApprovedMetric: "0.0008",
            },
          ],
        },
      ],
    });
    // Both legs clear their threshold under the approved denominator and
    // neither comes near it under the alternative, which is the whole reason
    // the comparison is shown beside the gates rather than behind them.
    for (const finding of evaluation.findings)
      if (finding.gate === "LEG_REVERSAL_MULTIPLE")
        expect(finding.passed).toBe(true);
  });

  it("resolves every gate to a committed source row", () => {
    const { proposal } = publishedCaseProposal();
    const replay = replayPublishedCase(approvalFor(sha256Canonical(proposal)));
    expect(replay.evaluation.findings.length).toBeGreaterThanOrEqual(4);
    const traced = new Set(replay.sourceTrace.map(({ eventId }) => eventId));
    for (const entry of replay.sourceTrace)
      expect(entry.sourceRow.coordinate.rowNumber, entry.eventId).toBeTruthy();
    for (const finding of replay.evaluation.findings) {
      expect(finding.referencedEventIds.length).toBeGreaterThan(0);
      for (const eventId of finding.referencedEventIds)
        expect(traced.has(eventId), `${finding.gate} ${eventId}`).toBe(true);
    }
  });

  it("refuses an approval that does not cover this exact scope", () => {
    expect(() => replayPublishedCase(approvalFor("f".repeat(64)))).toThrow();
  });

  it("reads the chart series straight from the committed artifact", () => {
    const { spot, future } = publishedCaseSeries();
    expect(spot).toHaveLength(45);
    expect(spot[0]!.tradingDate).toBe("20260701");
    expect(spot.at(-1)).toMatchObject({
      tradingDate: "20260903",
      open: "1046.17",
      high: "1050.77",
      low: "1009.7",
      close: "1032.82",
      netChange: "1.29",
    });
    expect(future).toMatchObject({
      tradingDate: "20260903",
      open: "1044.3",
      high: "1051.65",
      low: "1008.7",
      close: "1030",
      netChange: ".85",
    });
  });
});

describe("the reviewed published mappings", () => {
  it("still cover the proposals the package exports", () => {
    // This is the drift detector. A published mapping that changes makes this
    // fail rather than letting the application hash the new proposal and
    // approve it in the same breath.
    for (const [proposal, approval] of [
      [fscKospi200BaselineProposal, REVIEWED_MAPPING_APPROVALS.baseline],
      [fscKospi200FuturesProposal, REVIEWED_MAPPING_APPROVALS.futures],
    ] as const)
      expect(sha256Canonical(mappingApprovalArtifact(proposal))).toBe(
        approval.approvedArtifactHash,
      );
  });

  it("fails closed when a committed approval no longer covers its proposal", () => {
    expect(() =>
      reviewedMappingApproval("baseline", fscKospi200BaselineProposal, {
        ...REVIEWED_MAPPING_APPROVALS.baseline,
        approvedArtifactHash: "0".repeat(64),
      }),
    ).toThrowError(PublishedCaseReviewRequired);
  });

  it("records reviewer reasons rather than repeating the proposal's evidence", () => {
    // The reasons are committed, so they stay what a person wrote even if the
    // proposal's own evidence text is later changed.
    for (const approval of Object.values(REVIEWED_MAPPING_APPROVALS)) {
      expect(approval.overrides.length).toBeGreaterThan(0);
      for (const override of approval.overrides)
        expect(override.reason.trim().length).toBeGreaterThan(0);
    }
  });
});
