import {
  ReplayRequestSchema,
  ReplayResultResponseSchema,
  ReplayReviewResponseSchema,
  type ReplayReviewResponse,
} from "@weavetrail/contracts";
import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import {
  CanonicalizationError,
  replayApproved,
} from "@weavetrail/replay-engine";
import { committedReplayScenarios } from "@weavetrail/scenarios";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const mappingProvider = new FixtureSchemaMappingProvider();

function sourceRowMismatchIssues(
  requestedRows: (typeof committedReplayScenarios)[keyof typeof committedReplayScenarios]["rows"],
  committedRows: (typeof committedReplayScenarios)[keyof typeof committedReplayScenarios]["rows"],
): ReplayReviewResponse["issues"] {
  const committedByCoordinate = new Map(
    committedRows.map((row) => [
      `${row.coordinate.sourceArtifactHash}:${row.coordinate.rowNumber}`,
      row,
    ]),
  );

  return requestedRows.flatMap((row, index) => {
    const committedRow = committedByCoordinate.get(
      `${row.coordinate.sourceArtifactHash}:${row.coordinate.rowNumber}`,
    );
    if (
      committedRow === undefined &&
      row.coordinate.sourceArtifactHash ===
        committedRows[0]?.coordinate.sourceArtifactHash
    ) {
      return [
        {
          code: "SOURCE_ROW_MISMATCH" as const,
          path: ["rows", index, "coordinate", "rowNumber"],
          message: `Source row ${row.coordinate.rowNumber} is not declared by the committed artifact.`,
        },
      ];
    }
    if (committedRow === undefined) return [];

    const columns = [
      ...new Set([
        ...Object.keys(row.values),
        ...Object.keys(committedRow.values),
      ]),
    ].sort();
    return columns
      .filter((column) => row.values[column] !== committedRow.values[column])
      .map((column) => ({
        code: "SOURCE_ROW_MISMATCH" as const,
        path: ["rows", index, "values", column],
        message: `Source row ${row.coordinate.rowNumber} column ${column} does not match the committed artifact.`,
      }));
  });
}

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

  const {
    rows: requestedRows,
    mappingApproval,
    mutation,
    scenario,
  } = parsed.data;
  const scenarioConfig = committedReplayScenarios[scenario];
  const mappingProposal = await mappingProvider.propose({
    sourceArtifactHash: scenarioConfig.sourceArtifactHash,
    constants: scenarioConfig.constants,
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

  const rowIssues = sourceRowMismatchIssues(requestedRows, scenarioConfig.rows);
  if (rowIssues.length > 0) return reviewResponse(rowIssues);

  try {
    const replay = replayApproved(
      requestedRows,
      scenarioConfig.rows,
      mappingProposal,
      mappingApproval,
      undefined,
      mutation,
    );
    if (!("canonicalResultHash" in replay)) {
      return reviewResponse(
        replay.issues.map((issue) => ({
          code: issue.code as ReplayReviewResponse["issues"][number]["code"],
          path: issue.path
            .split(".")
            .map((part) => (/^\d+$/.test(part) ? Number(part) : part)),
          message: `Replay approval boundary rejected ${issue.path}: ${issue.code}.`,
        })),
      );
    }
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
        { code: error.code, path: ["rows"], message: error.message },
      ]);
    }
    throw error;
  }
}
