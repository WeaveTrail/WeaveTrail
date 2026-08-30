import {
  ReplayRequestSchema,
  type ReplayReviewResponse,
} from "@weavetrail/contracts";
import {
  CanonicalizationError,
  replayFoundation,
} from "@weavetrail/replay-engine";
import { concentratedBuyEvents } from "@weavetrail/scenarios";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function reviewResponse(
  issues: ReplayReviewResponse["issues"],
): NextResponse<ReplayReviewResponse> {
  return NextResponse.json(
    { status: "REVIEW_REQUIRED", issues },
    { status: 422 },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = JSON.parse(await request.text()) as unknown;
  } catch {
    return reviewResponse([
      {
        code: "INVALID_JSON",
        path: [],
        message: "Request body must be valid JSON.",
      },
    ]);
  }

  const parsed = ReplayRequestSchema.safeParse(body);
  if (!parsed.success) {
    return reviewResponse(
      parsed.error.issues.map((issue) => ({
        code: "INVALID_REQUEST",
        path: issue.path.map((segment) =>
          typeof segment === "symbol"
            ? (segment.description ?? "symbol")
            : segment,
        ),
        message: issue.message,
      })),
    );
  }

  const { events: requestedEvents, mutation, scenario } = parsed.data;
  let events = [...(requestedEvents ?? concentratedBuyEvents)];

  if (mutation === "shuffle") {
    const last = events.at(-1)!;
    events = [last, ...events.slice(0, -1)];
  }

  if (mutation === "duplicate") {
    events = [...events, events[0]!];
  }

  try {
    return NextResponse.json({
      mode: "fixture",
      scenario,
      mutation,
      replay: replayFoundation(events),
      boundary:
        "Foundation replay verifies ordering, exact deduplication, and hashing only. Pattern evaluation is not implemented.",
    });
  } catch (error) {
    if (error instanceof CanonicalizationError) {
      return reviewResponse([
        { code: error.code, path: ["events"], message: error.message },
      ]);
    }
    throw error;
  }
}
