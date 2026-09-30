import type {
  ClaimCoverageRequest,
  CoverageReasonCode,
} from "@weavetrail/contracts";

/** Authored structured scopes, not collected messages or asserted source facts.
 * No extractor, numeric definition or test-only definition is used. */
export const claimCoverageEvaluation = {
  version: "published-claim-coverage-v1",
  baselineDatasetIds: [
    "fsc-stock-quotes-20260903-v1",
    "fsc-kospi-index-family-20260903-v1",
    "fsc-kospi-200-baseline-20260701-20260903-v1",
    "fsc-kospi-200-futures-20260903-v1",
    "fsc-weekly-options-20260903-v1",
  ],
  // A repository payload budget, not a market threshold or licence decision.
  datasetByteLimit: "16777216",
} as const;

type ScopeCase = {
  id: string;
  description: string;
  request: ClaimCoverageRequest;
  expectedBefore: CoverageReasonCode;
  expectedAfter: CoverageReasonCode;
};

function scope(
  instrumentId: string,
  field: string,
  start = "2026-09-03",
  endInclusive = start,
  resolution: ClaimCoverageRequest["resolution"] = "DAILY",
): ClaimCoverageRequest {
  return {
    instrumentId,
    field,
    dateWindow: { start, endInclusive },
    resolution,
  };
}

function specimen(
  id: string,
  description: string,
  request: ClaimCoverageRequest,
  reason: CoverageReasonCode,
): ScopeCase {
  return {
    id,
    description,
    request,
    expectedBefore: reason,
    expectedAfter: reason,
  };
}

export const claimCoverageCases: readonly ScopeCase[] = [
  specimen(
    "admitted-stock-close",
    "Observed stock close",
    scope("KR7000020008", "clpr"),
    "DEFINITION_NOT_BOUND",
  ),
  specimen(
    "admitted-stock-volume",
    "Observed stock volume",
    scope("KR7000020008", "trqu"),
    "DEFINITION_NOT_BOUND",
  ),
  specimen(
    "admitted-kospi-close",
    "Observed KOSPI close",
    scope("코스피", "clpr"),
    "DEFINITION_NOT_BOUND",
  ),
  specimen(
    "admitted-index-baseline",
    "Observed KOSPI 200 baseline window",
    scope("코스피 200", "clpr", "2026-07-01", "2026-09-03"),
    "DEFINITION_NOT_BOUND",
  ),
  specimen(
    "stock-outside-first-page",
    "Stock identity absent from the admitted first page",
    scope("KR7005930003", "clpr"),
    "OUTSIDE_COVERAGE",
  ),
  specimen(
    "unadmitted-kosdaq-stock",
    "Synthetic identity probe for an unadmitted KOSDAQ stock",
    scope("SYNTHETIC-UNADMITTED-KOSDAQ-STOCK", "clpr"),
    "OUTSIDE_COVERAGE",
  ),
  specimen(
    "unadmitted-kosdaq-index",
    "KOSDAQ index absent from the admitted family",
    scope("코스닥", "clpr"),
    "OUTSIDE_COVERAGE",
  ),
  specimen(
    "index-after-window",
    "KOSPI date after its admitted day",
    scope("코스피", "clpr", "2026-09-04"),
    "OUTSIDE_COVERAGE",
  ),
  specimen(
    "index-before-baseline",
    "KOSPI 200 date before its admitted baseline",
    scope("코스피 200", "clpr", "2026-06-30"),
    "OUTSIDE_COVERAGE",
  ),
  specimen(
    "intraday-index-close",
    "Intraday request against daily observations",
    scope("코스피 200", "clpr", "2026-09-03", "2026-09-03", "INTRADAY"),
    "RESOLUTION_TOO_COARSE",
  ),
  specimen(
    "unadmitted-expiry-calendar",
    "Illustrative expiry-calendar field, not a publisher column",
    scope("코스피 200", "expiryDate"),
    "OUTSIDE_COVERAGE",
  ),
  specimen(
    "unadmitted-investor-flow",
    "Illustrative investor-flow field, not a publisher column",
    scope("코스피 200", "foreignNetVolume"),
    "OUTSIDE_COVERAGE",
  ),
];
