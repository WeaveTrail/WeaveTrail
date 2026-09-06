import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CaseManifestV14Schema,
  CaseManifestV14ProposalSchema,
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
import { crossMarketSessionReversalSpecimens } from "@weavetrail/scenarios";

import { computeDatasetProfile } from "./dataset-profile";
import { mappingApprovalArtifact, replayApproved } from "./approval-validation";
import { sha256Canonical } from "./canonical-hash";
import {
  CrossMarketRuleError,
  evaluateCrossMarketSessionReversal,
  replayCrossMarketSessionReversal,
} from "./cross-market-session-reversal";

function manifest(
  events: readonly TradeEvent[],
  overrides: Partial<
    Extract<
      CaseManifestV14["rules"][number],
      { ruleId: "CROSS_MARKET_SESSION_REVERSAL" }
    >["parameters"]
  > = {},
): CaseManifestV14 {
  const profile = computeDatasetProfile(events);
  const proposal = CaseManifestV14ProposalSchema.parse({
    manifestVersion: "1.4",
    caseId: "cross-market-session-reversal-test",
    canonicalDatasetHash: profile.canonicalDatasetHash,
    hypothesis: {
      pattern: "CROSS_MARKET_SESSION_REVERSAL",
      instrumentIds: ["SYNTH-PRIMARY", "SYNTH-CONFIRMING"],
      actorIds: [],
      startTime: profile.earliestEventTime,
      endTime: profile.latestEventTime,
    },
    rules: [
      {
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        ruleVersion: "1.0",
        parameters: {
          analysedDate: "2026-09-02",
          baselineRange: {
            startDate: "2026-08-31",
            endDateInclusive: "2026-09-02",
          },
          baselineLegId: "primary",
          legs: [
            {
              legId: "primary",
              instrumentId: "SYNTH-PRIMARY",
              minimumReversalMultiple: "5",
            },
            {
              legId: "confirming",
              instrumentId: "SYNTH-CONFIRMING",
              minimumReversalMultiple: "5",
            },
          ],
          maximumBaselineRank: "1",
          minimumAgreeingLegs: "2",
          ...overrides,
        },
      },
    ],
    aiTrace: {
      provider: "fixture",
      model: "deterministic",
      promptVersion: "cross-market-session-reversal-v1",
      confidence: 1,
      referencedEventIds: [],
    },
  });
  return CaseManifestV14Schema.parse({
    ...proposal,
    approval: {
      approvedArtifactHash: sha256Canonical(proposal),
      reviewerRef: "test-reviewer",
      decision: "APPROVED",
      overrides: [],
      approvedAt: "2026-09-07T00:00:00Z",
    },
  });
}

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

function publishedEvents(reverseRows = false): {
  events: TradeEvent[];
  manifest: CaseManifestV14;
} {
  const definitions = [
    {
      source:
        publishedReplaySources[
          "real/fsc-kospi-200-baseline-20260701-20260903/source.jsonl"
        ],
      proposal: fscKospi200BaselineProposal,
    },
    {
      source:
        publishedReplaySources[
          "real/fsc-kospi-200-futures-20260903/source.jsonl"
        ],
      proposal: fscKospi200FuturesProposal,
    },
  ];
  const events = definitions.flatMap(({ source, proposal }) => {
    const rows = reverseRows ? [...source.rows].reverse() : source.rows;
    const result = replayApproved(
      rows,
      source.rows,
      proposal,
      mappingApproval(proposal),
      undefined,
    );
    if (!("events" in result)) {
      throw new Error(JSON.stringify(result));
    }
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
  const manifest = CaseManifestV14Schema.parse({
    ...proposal,
    approval: {
      approvedArtifactHash: sha256Canonical(proposal),
      reviewerRef: "published-golden-reviewer",
      decision: "APPROVED",
      overrides: [],
      approvedAt: "2026-09-07T00:00:00Z",
    },
  });
  return { events, manifest };
}

describe("cross-market session reversal", () => {
  it.each([
    ["supported", "SUPPORTED"],
    ["notSupported", "NOT_SUPPORTED"],
    ["inconclusive", "INCONCLUSIVE"],
  ] as const)(
    "reaches %s using a committed synthetic specimen",
    (name, result) => {
      const specimen = crossMarketSessionReversalSpecimens[name];
      expect(
        evaluateCrossMarketSessionReversal(
          specimen.events,
          manifest(specimen.events),
        ).result,
      ).toBe(result);
    },
  );

  it("reports a failed leg gate even when the configured quorum supports the pattern", () => {
    const specimen = crossMarketSessionReversalSpecimens.notSupported;
    const result = evaluateCrossMarketSessionReversal(
      specimen.events,
      manifest(specimen.events, { minimumAgreeingLegs: "1" }),
    );
    expect(result.result).toBe("SUPPORTED");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        gate: "LEG_REVERSAL_MULTIPLE",
        legId: "confirming",
        passed: false,
      }),
    );
  });

  it("pins the published result, every gate observation and canonical result hash", () => {
    const { events, manifest: configured } = publishedEvents();
    const replay = replayCrossMarketSessionReversal(events, configured);
    expect(replay.evaluation).toMatchObject({
      result: "SUPPORTED",
      analysis: {
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
      },
      findings: [
        expect.objectContaining({
          gate: "BASELINE_RANK",
          observedValue: "1",
          threshold: "1",
          passed: true,
        }),
        expect.objectContaining({
          gate: "LEG_REVERSAL_MULTIPLE",
          legId: "spot-index",
          observedValue: "13.9147",
          threshold: "10",
          passed: true,
        }),
        expect.objectContaining({
          gate: "LEG_REVERSAL_MULTIPLE",
          legId: "front-future",
          observedValue: "25.4705",
          threshold: "20",
          passed: true,
        }),
        expect.objectContaining({
          gate: "AGREEING_LEGS",
          observedValue: "2",
          threshold: "2",
          passed: true,
        }),
      ],
    });
    expect(replay.canonicalResultHash).toBe(
      "ffd7110a1c1fb2b18e9200e3a103b03572cb5b97b5f5d6db81689821de63bb55",
    );
    for (const finding of replay.evaluation.findings) {
      expect(finding.referencedEventIds.length).toBeGreaterThan(0);
      expect(
        finding.referencedEventIds.every((id) =>
          replay.orderedEventIds.includes(id),
        ),
      ).toBe(true);
    }
  });

  it("is invariant to submitted source-row order", () => {
    const baseline = publishedEvents(false);
    const reversed = publishedEvents(true);
    expect(
      replayCrossMarketSessionReversal(reversed.events, reversed.manifest),
    ).toMatchObject({
      evaluation: replayCrossMarketSessionReversal(
        baseline.events,
        baseline.manifest,
      ).evaluation,
      canonicalResultHash: replayCrossMarketSessionReversal(
        baseline.events,
        baseline.manifest,
      ).canonicalResultHash,
    });
  });

  it("covers empty and single-day baselines, zero change, a missing leg and an out-of-range date", () => {
    const supported = crossMarketSessionReversalSpecimens.supported.events;
    const configured = manifest(supported);
    const primary = supported.filter(
      ({ instrumentId }) => instrumentId === "SYNTH-PRIMARY",
    );
    expect(
      evaluateCrossMarketSessionReversal(
        supported.filter(
          ({ instrumentId }) => instrumentId !== "SYNTH-PRIMARY",
        ),
        configured,
      ),
    ).toMatchObject({ result: "INCONCLUSIVE", reason: "EMPTY_BASELINE" });
    expect(
      evaluateCrossMarketSessionReversal(
        [...primary.slice(-1), supported.at(-1)!],
        configured,
      ),
    ).toMatchObject({
      result: "INCONCLUSIVE",
      reason: "INSUFFICIENT_BASELINE_POPULATION",
    });
    expect(
      evaluateCrossMarketSessionReversal(
        crossMarketSessionReversalSpecimens.inconclusive.events,
        manifest(crossMarketSessionReversalSpecimens.inconclusive.events),
      ),
    ).toMatchObject({ result: "INCONCLUSIVE", reason: "ZERO_NET_CHANGE" });
    expect(
      evaluateCrossMarketSessionReversal(supported.slice(0, -1), configured),
    ).toMatchObject({ result: "INCONCLUSIVE", reason: "DECLARED_LEG_ABSENT" });
    expect(
      evaluateCrossMarketSessionReversal(
        supported,
        manifest(supported, { analysedDate: "2026-09-03" }),
      ),
    ).toMatchObject({
      result: "INCONCLUSIVE",
      reason: "ANALYSED_DATE_OUTSIDE_BASELINE_RANGE",
    });
  });

  it("refuses replay when a declared instrument is outside the dataset profile", () => {
    const specimen = crossMarketSessionReversalSpecimens.supported;
    const configured = manifest(specimen.events);
    const outside = {
      ...configured,
      hypothesis: {
        ...configured.hypothesis,
        instrumentIds: ["SYNTH-PRIMARY", "OUTSIDE-PROFILE"],
      },
    } as CaseManifestV14;
    expect(() =>
      replayCrossMarketSessionReversal(specimen.events, outside),
    ).toThrowError(
      expect.objectContaining<Partial<CrossMarketRuleError>>({
        code: "INSTRUMENT_OUTSIDE_DATASET_PROFILE",
      }),
    );
  });

  it("fails closed on duplicate or mismatched rule declarations", () => {
    const specimen = crossMarketSessionReversalSpecimens.supported;
    const configured = manifest(specimen.events);
    expect(() =>
      evaluateCrossMarketSessionReversal(specimen.events, {
        ...configured,
        rules: [...configured.rules, configured.rules[0]!],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CrossMarketRuleError>>({
        code: "RULE_CONFIGURATION_REQUIRED",
      }),
    );
    expect(() =>
      evaluateCrossMarketSessionReversal(specimen.events, {
        ...configured,
        hypothesis: {
          ...configured.hypothesis,
          instrumentIds: [...configured.hypothesis.instrumentIds, "EXTRA"],
        },
      }),
    ).toThrowError(/exactly match/);
  });

  it("decides a threshold from exact integers rather than the rendered multiple", () => {
    const specimen = crossMarketSessionReversalSpecimens.supported;
    const events = specimen.events.map((event) =>
      event.instrumentId === "SYNTH-CONFIRMING"
        ? {
            ...event,
            openPrice: "11",
            highPrice: "15.00009",
            lowPrice: "9",
            closePrice: "10",
            netChange: "1",
          }
        : event,
    );
    const result = evaluateCrossMarketSessionReversal(
      events,
      manifest(events, {
        legs: [
          {
            legId: "primary",
            instrumentId: "SYNTH-PRIMARY",
            minimumReversalMultiple: "5",
          },
          {
            legId: "confirming",
            instrumentId: "SYNTH-CONFIRMING",
            minimumReversalMultiple: "5.0001",
          },
        ],
      }),
    );
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        legId: "confirming",
        observedValue: "5",
        threshold: "5.0001",
        passed: false,
      }),
    );
  });

  it("keeps price and threshold arithmetic out of JavaScript numbers", () => {
    const source = readFileSync(
      new URL("./cross-market-session-reversal.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(
      /(?:Number|parseFloat|parseInt)\([^)]*(?:Price|netChange|threshold|multiple|reversal)/,
    );
    expect(source).not.toMatch(
      /(?:Price|netChange|threshold|multiple|reversal)[^\n;]*(?:\.toFixed|Math\.)/,
    );
  });
});
