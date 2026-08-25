import { replayFoundation } from "@weavetrail/replay-engine";
import { concentratedBuyEvents } from "@weavetrail/scenarios";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    mutation?: unknown;
  };
  let events = [...concentratedBuyEvents];

  if (body.mutation === "shuffle") {
    events = [events[2]!, events[0]!, events[3]!, events[1]!];
  }

  if (body.mutation === "duplicate") {
    events = [...events, events[1]!];
  }

  return NextResponse.json({
    mode: "fixture",
    scenario: "synthetic-concentrated-buy-v1",
    mutation: typeof body.mutation === "string" ? body.mutation : "baseline",
    replay: replayFoundation(events),
    boundary:
      "Foundation replay verifies ordering, exact deduplication, and hashing only. Pattern evaluation is not implemented.",
  });
}
