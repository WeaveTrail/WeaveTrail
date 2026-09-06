import { ApprovalRecordSchema } from "@weavetrail/contracts";
import { CrossMarketRuleError } from "@weavetrail/replay-engine";
import { NextResponse } from "next/server";

import { replayPublishedCase } from "../../../lib/published-case";

export const runtime = "nodejs";

/**
 * Runs the authored 2026-09-03 case over the committed published artifacts.
 * The visitor's approval travels in the request and is revalidated here against
 * the scope this server rebuilds from those artifacts, so an approval made
 * against anything else authorizes nothing.
 */
export async function POST(request: Request) {
  const parsed = ApprovalRecordSchema.safeParse(
    (await request.json().catch(() => null))?.approval,
  );
  if (!parsed.success)
    return NextResponse.json(
      {
        state: "CASE_REVIEW_REQUIRED",
        code: "APPROVAL_REQUIRED",
        message:
          "A case scope approval record is required before this case runs.",
      },
      { status: 422 },
    );

  try {
    return NextResponse.json(replayPublishedCase(parsed.data));
  } catch (error) {
    if (error instanceof CrossMarketRuleError)
      return NextResponse.json(
        {
          state: "CASE_REVIEW_REQUIRED",
          code: error.code,
          message: error.message,
        },
        { status: 422 },
      );
    throw error;
  }
}
