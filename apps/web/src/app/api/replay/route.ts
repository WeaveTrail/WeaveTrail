import {
  ReplayRequestSchema,
  ReplayResultResponseSchema,
  ReplayReviewResponseSchema,
  type ReplayReviewResponse,
} from "@weavetrail/contracts";
import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import {
  CanonicalizationError,
  RequestWorkflow,
  replayApproved,
} from "@weavetrail/replay-engine";
import { committedReplayScenarios } from "@weavetrail/scenarios";
import { NextResponse } from "next/server";

import { existingRequestPath } from "./review-path";

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
          message: `Source row ${row.coordinate.rowNumber} in artifact ${row.coordinate.sourceArtifactHash} is not declared by the committed artifact.`,
        },
      ];
    }
    if (committedRow === undefined) return [];

    const columns = Object.keys(row.values).sort();
    return columns
      .filter((column) => row.values[column] !== committedRow.values[column])
      .map((column) => ({
        code: "SOURCE_ROW_MISMATCH" as const,
        path: ["rows", index, "values", column],
        message: `Source row ${row.coordinate.rowNumber} column ${column} in artifact ${row.coordinate.sourceArtifactHash} does not match the committed artifact.`,
      }));
  });
}

function reviewResponse(
  workflowState: unknown,
  issues: { code: string; path: (string | number)[]; message: string }[],
  requestBody: unknown,
): NextResponse<ReplayReviewResponse> {
  const body = ReplayReviewResponseSchema.parse({
    status: "REVIEW_REQUIRED",
    workflowState,
    issues: issues.map((issue) => ({
      ...issue,
      path: existingRequestPath(requestBody, issue.path),
    })),
  });
  return NextResponse.json(body, { status: 422 });
}

export async function POST(request: Request) {
  const workflow = new RequestWorkflow();
  let body: unknown;
  try {
    body = JSON.parse(await request.text()) as unknown;
  } catch {
    workflow.requireTransition("INPUT_REVIEW_REQUIRED");
    return reviewResponse(
      "INPUT_REVIEW_REQUIRED",
      [
        {
          code: "INVALID_JSON",
          path: [],
          message: "Request body must be valid JSON.",
        },
      ],
      body,
    );
  }

  const parsed = ReplayRequestSchema.safeParse(body);
  if (!parsed.success) {
    workflow.requireTransition("INPUT_REVIEW_REQUIRED");
    return reviewResponse(
      "INPUT_REVIEW_REQUIRED",
      parsed.error.issues.map((issue) => ({
        code: "INVALID_REQUEST",
        path: existingRequestPath(body, issue.path),
        message: issue.message,
      })),
      body,
    );
  }

  const {
    caseManifest,
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
  workflow.requireTransition("MAPPING_PROPOSED");
  const rowIssues = sourceRowMismatchIssues(requestedRows, scenarioConfig.rows);
  if (rowIssues.length > 0) {
    workflow.requireTransition("INPUT_REVIEW_REQUIRED");
    return reviewResponse("INPUT_REVIEW_REQUIRED", rowIssues, body);
  }

  try {
    const replay = replayApproved(
      requestedRows,
      scenarioConfig.rows,
      mappingProposal,
      mappingApproval,
      caseManifest,
      mutation,
      workflow,
    );
    if (!("canonicalResultHash" in replay)) {
      return reviewResponse(
        workflow.state,
        replay.issues.map((issue) => ({
          code: issue.code,
          path: issue.path,
          message:
            ("message" in issue ? issue.message : undefined) ??
            `Replay approval boundary rejected ${JSON.stringify(issue.path)}: ${issue.code}.`,
        })),
        body,
      );
    }
    const response = ReplayResultResponseSchema.parse({
      mode: "fixture",
      workflowState: workflow.state,
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
      ...("evaluation" in replay ? { evaluation: replay.evaluation } : {}),
      boundary:
        caseManifest === undefined
          ? "Foundation replay verifies ordering, exact deduplication, and hashing."
          : "Approved case replay evaluates a versioned pattern hypothesis with deterministic rules.",
    });
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof CanonicalizationError) {
      workflow.requireTransition("INPUT_REVIEW_REQUIRED");
      return reviewResponse(
        "INPUT_REVIEW_REQUIRED",
        [{ code: error.code, path: ["rows"], message: error.message }],
        body,
      );
    }
    throw error;
  }
}
