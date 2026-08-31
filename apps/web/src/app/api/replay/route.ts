import {
  ReplayRequestSchema,
  ReplayResultResponseSchema,
  ReplayReviewResponseSchema,
  type ReplayReviewResponse,
} from "@weavetrail/contracts";
import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import {
  CanonicalizationError,
  replayFoundation,
} from "@weavetrail/replay-engine";
import { committedReplayScenarios } from "@weavetrail/scenarios";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function reviewResponse(
  issues: ReplayReviewResponse["issues"],
): NextResponse<ReplayReviewResponse> {
  const body = ReplayReviewResponseSchema.parse({
    status: "REVIEW_REQUIRED",
    issues,
  });
  return NextResponse.json(body, { status: 422 });
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
  const scenarioConfig = committedReplayScenarios[scenario];
  const mappingProposal = await new FixtureSchemaMappingProvider().propose({
    sourceArtifactHash: scenarioConfig.sourceArtifactHash,
    columns: [...scenarioConfig.columns],
    sampleRows: [],
  });
  if (
    mappingProposal.fields.some(({ status }) => status === "REVIEW_REQUIRED")
  ) {
    return reviewResponse([
      {
        code: "MAPPING_REVIEW_REQUIRED",
        path: ["scenario"],
        message: `Scenario ${scenario} has mapping fields that require review.`,
      },
    ]);
  }

  const committedEvents =
    "events" in scenarioConfig ? scenarioConfig.events : undefined;
  const selectedEvents = requestedEvents ?? committedEvents;
  if (selectedEvents === undefined) {
    return reviewResponse([
      {
        code: "MAPPING_REVIEW_REQUIRED",
        path: ["scenario"],
        message: `Scenario ${scenario} has no committed event set.`,
      },
    ]);
  }
  let events = [...selectedEvents];

  if (mutation === "shuffle") {
    const last = events.at(-1)!;
    events = [last, ...events.slice(0, -1)];
  }

  if (mutation === "duplicate") {
    events = [...events, events[0]!];
  }

  try {
    const replay = replayFoundation(events);
    const response = ReplayResultResponseSchema.parse({
      mode: "fixture",
      scenario,
      mutation,
      replay: {
        engineVersion: replay.engineVersion,
        inputEventCount: replay.inputEventCount,
        canonicalEventCount: replay.canonicalEventCount,
        duplicateCount: replay.duplicateCount,
        orderedEventIds: replay.orderedEventIds,
        canonicalResultHash: replay.canonicalResultHash,
      },
      boundary:
        "Foundation replay verifies ordering, exact deduplication, and hashing only. Pattern evaluation is not implemented.",
    });
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof CanonicalizationError) {
      return reviewResponse([
        { code: error.code, path: ["events"], message: error.message },
      ]);
    }
    throw error;
  }
}
