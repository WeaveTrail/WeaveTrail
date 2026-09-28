import { ClaimCoverageRequestSchema } from "@weavetrail/contracts";
import { checkPublishedClaimCoverage } from "../../../../lib/published-claim-coverage";

export const runtime = "nodejs";

/** A structured scope check, not pasted-text extraction or numeric grading. */
export async function POST(request: Request) {
  const parsed = ClaimCoverageRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { state: "REVIEW_REQUIRED", code: "INVALID_COVERAGE_REQUEST" },
      { status: 422 },
    );
  return Response.json(checkPublishedClaimCoverage(parsed.data));
}
