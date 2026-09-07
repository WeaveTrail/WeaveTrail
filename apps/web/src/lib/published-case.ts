import {
  CaseManifestV14ProposalSchema,
  CaseManifestV14Schema,
  type ApprovalRecord,
  type CaseManifestV14,
  type CaseManifestV14Proposal,
  type CrossMarketSessionReversalResult,
  type SchemaMappingProposal,
  type TradeEvent,
} from "@weavetrail/contracts";
import {
  deriveRawRowHash,
  type SourceRow,
  computeDatasetProfile,
  mappingApprovalArtifact,
  replayApproved,
  replayCrossMarketSessionReversal,
  sha256Canonical,
} from "@weavetrail/replay-engine";
import {
  fscKospi200BaselineProposal,
  fscKospi200FuturesProposal,
  publishedReplaySources,
} from "@weavetrail/published-data";

import { REVIEWED_MAPPING_APPROVALS } from "./published-case-approvals";

/**
 * One authored case over committed, licensed published artifacts: the KOSPI 200
 * index and its front-month future on 2026-09-03, against the index's own
 * 2026-07-01 baseline. The case is authored here rather than proposed by a
 * model, and its scope is approved by the visitor before anything runs.
 */
export const PUBLISHED_CASE_ID =
  "published-kospi-200-session-reversal-20260903";
export const ANALYSED_DATE = "2026-09-03";
export const BASELINE_START_DATE = "2026-07-01";
export const SPOT_INSTRUMENT = "코스피 200";
export const FUTURE_INSTRUMENT = "KR4A01690002";

const BASELINE_KEY =
  "real/fsc-kospi-200-baseline-20260701-20260903/source.jsonl" as const;
const FUTURES_KEY = "real/fsc-kospi-200-futures-20260903/source.jsonl" as const;

const legSources = [
  {
    key: BASELINE_KEY,
    proposal: fscKospi200BaselineProposal,
    approval: REVIEWED_MAPPING_APPROVALS.baseline,
  },
  {
    key: FUTURES_KEY,
    proposal: fscKospi200FuturesProposal,
    approval: REVIEWED_MAPPING_APPROVALS.futures,
  },
] as const;

/** A published input that no longer matches what a person reviewed. */
export class PublishedCaseReviewRequired extends Error {
  constructor(
    readonly code: "MAPPING_REVIEW_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "PublishedCaseReviewRequired";
  }
}

/**
 * The two published mappings were reviewed once and their approval records are
 * committed in `published-case-approvals.ts`. The page says so rather than
 * presenting them as something the visitor approved.
 */
export const MAPPING_REVIEWER_REF = "published-golden-mapping-reviewer";

/**
 * Returns the committed approval only while it still covers the proposal the
 * package exports. A changed published mapping fails closed here, which is the
 * review stop the approval boundary exists to produce; minting a fresh hash
 * over the new proposal would let the change authorize itself.
 */
export function reviewedMappingApproval(
  key: string,
  proposal: SchemaMappingProposal,
  approval: ApprovalRecord,
): ApprovalRecord {
  const current = sha256Canonical(mappingApprovalArtifact(proposal));
  if (current !== approval.approvedArtifactHash)
    throw new PublishedCaseReviewRequired(
      "MAPPING_REVIEW_REQUIRED",
      `The committed mapping approval for ${key} does not cover the current proposal. Review the mapping again before this case runs.`,
    );
  return approval;
}

function normalizedEvents(): TradeEvent[] {
  return legSources.flatMap(({ key, proposal, approval }) => {
    const source = publishedReplaySources[key];
    const replay = replayApproved(
      source.rows,
      source.rows,
      proposal,
      reviewedMappingApproval(key, proposal, approval),
      undefined,
    );
    if (!("events" in replay))
      throw new Error(
        `Published mapping refused for ${key}: ${JSON.stringify(replay)}`,
      );
    return replay.events;
  });
}

export function publishedCaseRows(): SourceRow[] {
  return legSources.flatMap(({ key }) => [...publishedReplaySources[key].rows]);
}

/**
 * The exact artifact an approval binds to. Derived from the committed rows on
 * every call, so an approval made against a different scope cannot authorize
 * this one.
 */
export function publishedCaseProposal(): {
  proposal: CaseManifestV14Proposal;
  events: TradeEvent[];
} {
  const events = normalizedEvents();
  const profile = computeDatasetProfile(events);
  const proposal = CaseManifestV14ProposalSchema.parse({
    manifestVersion: "1.4",
    caseId: PUBLISHED_CASE_ID,
    canonicalDatasetHash: profile.canonicalDatasetHash,
    hypothesis: {
      pattern: "CROSS_MARKET_SESSION_REVERSAL",
      instrumentIds: [SPOT_INSTRUMENT, FUTURE_INSTRUMENT],
      actorIds: [],
      startTime: profile.earliestEventTime,
      endTime: profile.latestEventTime,
    },
    rules: [
      {
        ruleId: "CROSS_MARKET_SESSION_REVERSAL",
        ruleVersion: "1.0",
        parameters: {
          analysedDate: ANALYSED_DATE,
          baselineRange: {
            startDate: BASELINE_START_DATE,
            endDateInclusive: ANALYSED_DATE,
          },
          baselineLegId: "spot-index",
          legs: [
            {
              legId: "spot-index",
              instrumentId: SPOT_INSTRUMENT,
              minimumReversalMultiple: "10",
            },
            {
              legId: "front-future",
              instrumentId: FUTURE_INSTRUMENT,
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
  return { proposal, events };
}

/**
 * One traced observation: the canonical daily quote a gate referenced, and the
 * committed row it was derived from. The shared finding trace covers execution
 * events only, so the daily-quote projection is written out here rather than
 * widened in the engine for one surface.
 */
export type PublishedCaseTraceEntry = {
  eventId: string;
  instrumentId: string;
  tradingDate: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  netChange: string;
  rawRowHash: string;
  sourceRow: SourceRow;
};

export type PublishedCaseReplay = {
  engineVersion: string;
  inputEventCount: number;
  canonicalEventCount: number;
  duplicateCount: number;
  canonicalResultHash: string;
  evaluation: CrossMarketSessionReversalResult;
  sourceTrace: PublishedCaseTraceEntry[];
};

function traceReferencedQuotes(
  events: readonly TradeEvent[],
  referenced: ReadonlySet<string>,
): PublishedCaseTraceEntry[] {
  const rowsByHash = new Map(
    publishedCaseRows().map((row) => [deriveRawRowHash(row), row]),
  );
  return events.flatMap((event) => {
    if (
      event.schemaVersion !== "1.3" ||
      event.eventType !== "DAILY_QUOTE" ||
      !referenced.has(event.eventId)
    )
      return [];
    const sourceRow = rowsByHash.get(event.rawRowHash);
    if (sourceRow === undefined)
      throw new Error(`No committed row resolves ${event.eventId}`);
    return [
      {
        eventId: event.eventId,
        instrumentId: event.instrumentId,
        tradingDate: event.tradingDate,
        openPrice: event.openPrice,
        highPrice: event.highPrice,
        lowPrice: event.lowPrice,
        closePrice: event.closePrice,
        netChange: event.netChange,
        rawRowHash: event.rawRowHash,
        sourceRow,
      },
    ];
  });
}

/**
 * Runs only against an approval whose hash covers this exact scope. A visitor
 * who approved anything else is refused here rather than shown a result the
 * approval does not authorize.
 */
export function replayPublishedCase(
  approval: ApprovalRecord,
): PublishedCaseReplay {
  const { proposal, events } = publishedCaseProposal();
  const manifest: CaseManifestV14 = CaseManifestV14Schema.parse({
    ...proposal,
    approval,
  });
  const replay = replayCrossMarketSessionReversal(events, manifest);
  return {
    engineVersion: replay.engineVersion,
    inputEventCount: replay.inputEventCount,
    canonicalEventCount: replay.canonicalEventCount,
    duplicateCount: replay.duplicateCount,
    canonicalResultHash: replay.canonicalResultHash,
    evaluation: replay.evaluation,
    sourceTrace: traceReferencedQuotes(
      replay.events,
      new Set(
        replay.evaluation.findings.flatMap(
          ({ referencedEventIds }) => referencedEventIds,
        ),
      ),
    ),
  };
}

export type SessionDay = {
  tradingDate: string;
  open: string;
  high: string;
  low: string;
  close: string;
  netChange: string;
};

function day(
  values: Record<string, string>,
  columns: {
    date: string;
    open: string;
    high: string;
    low: string;
    close: string;
    netChange: string;
  },
): SessionDay {
  return {
    tradingDate: values[columns.date]!,
    open: values[columns.open]!,
    high: values[columns.high]!,
    low: values[columns.low]!,
    close: values[columns.close]!,
    netChange: values[columns.netChange]!,
  };
}

const INDEX_COLUMNS = {
  date: "basDt",
  open: "mkp",
  high: "hipr",
  low: "lopr",
  close: "clpr",
  netChange: "vs",
} as const;

/**
 * The committed daily values for the index leg, oldest first, and the single
 * committed row for the front-month future. These are published values read
 * straight from the artifact — not a rule output, and never labelled as one.
 */
export function publishedCaseSeries(): {
  spot: SessionDay[];
  future: SessionDay;
  spotArtifactHash: string;
  futureArtifactHash: string;
} {
  const baseline = publishedReplaySources[BASELINE_KEY];
  const futures = publishedReplaySources[FUTURES_KEY];
  const spot = baseline.rows
    .map(({ values }) => day(values, INDEX_COLUMNS))
    .sort((left, right) => left.tradingDate.localeCompare(right.tradingDate));
  const futureRow = futures.rows.find(
    ({ values }) => values.isinCd === FUTURE_INSTRUMENT,
  );
  if (futureRow === undefined)
    throw new Error("Committed futures artifact has no front-month row");
  return {
    spot,
    future: day(futureRow.values, INDEX_COLUMNS),
    spotArtifactHash: baseline.sourceArtifactHash,
    futureArtifactHash: futures.sourceArtifactHash,
  };
}

export type PublishedColumn = {
  sourceColumn: string;
  targetField: string;
};

/**
 * The mapped columns of the index artifact, as the reviewed proposal declares
 * them. The page shows these so a reader meets the publisher's own column
 * names before meeting a result computed from them.
 */
export function publishedCaseColumns(): PublishedColumn[] {
  return fscKospi200BaselineProposal.fields.flatMap((field) =>
    field.targetField
      ? [{ sourceColumn: field.sourceColumn, targetField: field.targetField }]
      : [],
  );
}
