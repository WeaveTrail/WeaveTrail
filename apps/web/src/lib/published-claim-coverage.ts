import type { ClaimCoverageRequest } from "@weavetrail/contracts";
import { publishedCoverageManifest } from "@weavetrail/published-data";
import { resolveClaimCoverage } from "@weavetrail/replay-engine";
import { coverageReasons } from "./coverage-copy";

/** Coverage preflight only. Numeric definitions and full claim grading are planned.
 * The caller cannot supply a manifest or invent a bound definition. */
export function checkPublishedClaimCoverage(request: ClaimCoverageRequest) {
  const result = resolveClaimCoverage(request, publishedCoverageManifest);
  if (result.status === "UNCONFIRMABLE")
    return { ...result, reason: coverageReasons[result.reasonCode] };
  return result;
}
