import { describe, expect, it } from "vitest";

import {
  CaseManifestV14ProposalSchema,
  CaseManifestV14Schema,
  requiresMappingOverride,
  type ApprovalRecord,
  type CaseManifestV14,
  type TradeEvent,
} from "@weavetrail/contracts";
import {
  fscKospi200BaselineProposal,
  fscKospi200FuturesProposal,
  publishedReplaySources,
} from "@weavetrail/published-data";

import { mappingApprovalArtifact, replayApproved } from "./approval-validation";
import { sha256Canonical } from "./canonical-hash";
import { replayCrossMarketSessionReversal } from "./cross-market-session-reversal";
import { computeDatasetProfile } from "./dataset-profile";

const PUBLISHED_SOURCES = [
  {
    key: "real/fsc-kospi-200-baseline-20260701-20260903/source.jsonl",
    proposal: fscKospi200BaselineProposal,
  },
  {
    key: "real/fsc-kospi-200-futures-20260903/source.jsonl",
    proposal: fscKospi200FuturesProposal,
  },
] as const;

const PUBLISHED_GOLDEN = {
  result: "SUPPORTED",
  analysedDate: "2026-09-03",
  rank: {
    position: "1",
    populationSize: "45",
    interpretation: "POSITION_WITHIN_DECLARED_RANGE_NOT_PROBABILITY",
  },
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
  gates: [
    {
      gate: "BASELINE_RANK",
      legId: "spot-index",
      observedValue: "1",
      threshold: "1",
      passed: true,
    },
    {
      gate: "LEG_REVERSAL_MULTIPLE",
      legId: "spot-index",
      observedValue: "13.9147",
      threshold: "10",
      passed: true,
    },
    {
      gate: "LEG_REVERSAL_MULTIPLE",
      legId: "front-future",
      observedValue: "25.4705",
      threshold: "20",
      passed: true,
    },
    {
      gate: "AGREEING_LEGS",
      legId: null,
      observedValue: "2",
      threshold: "2",
      passed: true,
    },
  ],
  canonicalResultHash:
    "ffd7110a1c1fb2b18e9200e3a103b03572cb5b97b5f5d6db81689821de63bb55",
} as const;

function mappingApproval(
  proposal:
    typeof fscKospi200BaselineProposal | typeof fscKospi200FuturesProposal,
): ApprovalRecord {
  return {
    approvedArtifactHash: sha256Canonical(mappingApprovalArtifact(proposal)),
    reviewerRef: "published-golden-mapping-reviewer",
    decision: "APPROVED",
    approvedAt: "2026-09-07T00:00:00Z",
    overrides: proposal.fields.flatMap((field, index) =>
      requiresMappingOverride(field)
        ? [{ fieldPath: `fields.${index}`, reason: field.evidence }]
        : [],
    ),
  };
}

function publishedEvents(reverseSubmittedRows = false): {
  events: TradeEvent[];
  manifest: CaseManifestV14;
} {
  const definitions = reverseSubmittedRows
    ? [...PUBLISHED_SOURCES].reverse()
    : PUBLISHED_SOURCES;
  const events = definitions.flatMap(({ key, proposal }) => {
    const source = publishedReplaySources[key];
    const submittedRows = reverseSubmittedRows
      ? [...source.rows].reverse()
      : source.rows;
    const result = replayApproved(
      submittedRows,
      source.rows,
      proposal,
      mappingApproval(proposal),
      undefined,
    );
    if (!("events" in result)) throw new Error(JSON.stringify(result));
    return result.events;
  });
  const profile = computeDatasetProfile(events);
  const proposal = CaseManifestV14ProposalSchema.parse({
    manifestVersion: "1.4",
    caseId: "published-kospi-200-session-reversal-20260903",
    canonicalDatasetHash: profile.canonicalDatasetHash,
    hypothesis: {
      pattern: "CROSS_MARKET_SESSION_REVERSAL",
      instrumentIds: ["코스피 200", "KR4A01690002"],
      actorIds: [],
      startTime: profile.earliestEventTime,
      endTime: profile.latestEventTime,
    },
    rules: [
      {
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        ruleVersion: "1.0",
        parameters: {
          analysedDate: "2026-09-03",
          baselineRange: {
            startDate: "2026-07-01",
            endDateInclusive: "2026-09-03",
          },
          baselineLegId: "spot-index",
          legs: [
            {
              legId: "spot-index",
              instrumentId: "코스피 200",
              minimumReversalMultiple: "10",
            },
            {
              legId: "front-future",
              instrumentId: "KR4A01690002",
              minimumReversalMultiple: "20",
            },
          ],
          maximumBaselineRank: "1",
          minimumAgreeingLegs: "2",
        },
      },
    ],
    aiTrace: {
      provider: "fixture",
      model: "deterministic",
      promptVersion: "published-cross-market-v1",
      confidence: 1,
      referencedEventIds: [],
    },
  });
  return {
    events,
    manifest: CaseManifestV14Schema.parse({
      ...proposal,
      approval: {
        approvedArtifactHash: sha256Canonical(proposal),
        reviewerRef: "published-golden-reviewer",
        decision: "APPROVED",
        overrides: [],
        approvedAt: "2026-09-07T00:00:00Z",
      },
    }),
  };
}

function replayGolden(reverseSubmittedRows = false) {
  const { events, manifest } = publishedEvents(reverseSubmittedRows);
  const replay = replayCrossMarketSessionReversal(events, manifest);
  const analysis = replay.evaluation.analysis;
  if (analysis === null) throw new Error("Expected conclusive golden analysis");
  return {
    replay,
    pinned: {
      result: replay.evaluation.result,
      analysedDate: analysis.analysedDate,
      rank: analysis.rank,
      candidateSelection: analysis.candidateSelection,
      legs: analysis.legs.map(
        ({
          legId,
          sessionReversal,
          netChange,
          relation,
          reversalMultiple,
        }) => ({
          legId,
          sessionReversal,
          netChange,
          relation,
          reversalMultiple,
        }),
      ),
      gates: replay.evaluation.findings.map((finding) => ({
        gate: finding.gate,
        legId: "legId" in finding ? finding.legId : null,
        observedValue: finding.observedValue,
        threshold: finding.threshold,
        passed: finding.passed,
      })),
      canonicalResultHash: replay.canonicalResultHash,
    },
  };
}

describe("published cross-market artifact set golden", () => {
  it("pins the engine result, analysed-date rank, every gate and result hash", () => {
    const { replay, pinned } = replayGolden();

    expect(pinned).toEqual(PUBLISHED_GOLDEN);
    const canonicalEventIds = new Set(replay.orderedEventIds);
    for (const finding of replay.evaluation.findings) {
      expect(finding.referencedEventIds.length).toBeGreaterThan(0);
      expect(
        finding.referencedEventIds.every((eventId) =>
          canonicalEventIds.has(eventId),
        ),
      ).toBe(true);
    }
  });

  it("keeps the pinned result hash when every source and its rows are reversed", () => {
    const baseline = replayGolden();
    const reordered = replayGolden(true);

    expect(reordered.pinned).toEqual(PUBLISHED_GOLDEN);
    expect(reordered.replay.evaluation).toEqual(baseline.replay.evaluation);
    expect(reordered.replay.canonicalResultHash).toBe(
      baseline.replay.canonicalResultHash,
    );
  });
});
