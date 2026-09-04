import type {
  ApprovalRecord,
  CaseManifest,
  CaseManifestProposal,
  ReplayReviewResponse,
  SchemaMappingProposal,
} from "@weavetrail/contracts";
import {
  CaseManifestProposalSchema,
  requiresMappingOverride,
  SchemaMappingProposalSchema,
} from "@weavetrail/contracts";

import { sha256Canonical } from "./canonical-hash";
import type { CanonicalJsonInput } from "./canonical-json";
import { CanonicalizationError } from "./canonical-order";
import {
  validateCaseAgainstProfile,
  type CaseProfileValidation,
} from "./case-validation";
import { computeDatasetProfile } from "./dataset-profile";
import { replayFoundation } from "./replay-foundation";
import { replayRapidPriceLift } from "./rapid-price-lift";
import {
  applyApprovedMapping,
  approvedSourceMapping,
  validateApprovedMapping,
  type MappingReviewCode,
  type SourceRow,
} from "./source-ingest";
import { RequestWorkflow } from "./request-workflow";

export type ApprovalIssueCode =
  | "APPROVED_SOURCE_COLUMN_MISSING"
  | "APPROVAL_RECORD_REQUIRED"
  | "APPROVED_ARTIFACT_HASH_MISMATCH"
  | "APPROVAL_REJECTED"
  | "MAPPING_OVERRIDE_REQUIRED"
  | "SOURCE_ROW_MISSING"
  | "SOURCE_ARTIFACT_NOT_APPROVED"
  | "MAPPING_APPLICATION_REVIEW_REQUIRED"
  | "RULE_CONFIGURATION_REQUIRED";

export type ApprovalValidation =
  | { accepted: true }
  | {
      accepted: false;
      status: "REVIEW_REQUIRED";
      issues: { code: ApprovalIssueCode; path: string; message?: string }[];
    };

export function caseManifestProposal(
  manifest: CaseManifest,
): CaseManifestProposal {
  const { approval, ...proposal } = manifest;
  void approval;
  return CaseManifestProposalSchema.parse(proposal);
}

export function mappingApprovalArtifact(
  mapping: SchemaMappingProposal,
): CanonicalJsonInput {
  return SchemaMappingProposalSchema.parse(mapping);
}

function validateApprovalRecord(
  artifact: CanonicalJsonInput,
  approval: ApprovalRecord | undefined,
  path: string,
): { code: ApprovalIssueCode; path: string }[] {
  if (approval === undefined) {
    return [{ code: "APPROVAL_RECORD_REQUIRED", path }];
  }

  const issues: { code: ApprovalIssueCode; path: string }[] = [];
  if (approval.decision !== "APPROVED") {
    issues.push({ code: "APPROVAL_REJECTED", path: `${path}.decision` });
  }
  if (approval.approvedArtifactHash !== sha256Canonical(artifact)) {
    issues.push({
      code: "APPROVED_ARTIFACT_HASH_MISMATCH",
      path: `${path}.approvedArtifactHash`,
    });
  }
  return issues;
}

function justifiedOverridePaths(approval: ApprovalRecord): Set<string> {
  return new Set(
    approval.overrides
      .filter(({ reason }) => reason.trim().length > 0)
      .map(({ fieldPath }) => fieldPath),
  );
}

export function validateReplayApprovals(
  mapping: SchemaMappingProposal,
  mappingApproval: ApprovalRecord | undefined,
  manifest: CaseManifest | undefined,
): ApprovalValidation {
  const mappingValidation = validateMappingApproval(mapping, mappingApproval);
  const issues = mappingValidation.accepted
    ? []
    : [...mappingValidation.issues];

  if (manifest === undefined) {
    issues.push({ code: "APPROVAL_RECORD_REQUIRED", path: "caseApproval" });
  } else {
    issues.push(
      ...validateApprovalRecord(
        caseManifestProposal(manifest),
        manifest.approval,
        "caseApproval",
      ),
    );
  }

  return issues.length === 0
    ? { accepted: true }
    : { accepted: false, status: "REVIEW_REQUIRED", issues };
}

export function replayApproved(
  rows: readonly SourceRow[],
  declaredRows: readonly SourceRow[],
  mapping: SchemaMappingProposal,
  mappingApproval: ApprovalRecord | undefined,
  manifest: CaseManifest | undefined,
  mutation: "baseline" | "shuffle" | "duplicate" = "baseline",
  workflow: RequestWorkflow = new RequestWorkflow(),
) {
  if (workflow.state === "UPLOADED") {
    workflow.requireTransition("MAPPING_PROPOSED");
  }
  const approval = validateMappingApproval(mapping, mappingApproval);
  if (!approval.accepted) {
    workflow.requireTransition("MAPPING_REVIEW_REQUIRED");
    return approval;
  }
  const executable = approvedSourceMapping(mapping);
  const structuralIssues = validateApprovedMapping(executable);
  if (structuralIssues.length > 0) {
    workflow.requireTransition("MAPPING_REVIEW_REQUIRED");
    return {
      accepted: false as const,
      status: "REVIEW_REQUIRED" as const,
      issues: structuralIssues.map((issue) => ({
        code: "MAPPING_APPLICATION_REVIEW_REQUIRED" as const,
        path: `mapping:${issue.code}`,
        message: issue.message,
      })),
    };
  }
  workflow.requireTransition("MAPPING_APPROVED");

  const inputReview = (
    issues: {
      code: ReplayReviewResponse["issues"][number]["code"];
      path: string;
      message?: string;
    }[],
  ) => {
    workflow.requireTransition("INPUT_REVIEW_REQUIRED");
    return {
      accepted: false as const,
      status: "REVIEW_REQUIRED" as const,
      issues,
    };
  };

  const foreignRows = rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        row.coordinate.sourceArtifactHash !== mapping.sourceArtifactHash,
    );
  if (foreignRows.length > 0) {
    return inputReview(
      foreignRows.map(({ index }) => ({
        code: "SOURCE_ARTIFACT_NOT_APPROVED" as const,
        path: `rows.${index}.coordinate.sourceArtifactHash`,
      })),
    );
  }

  const submittedRowNumbers = new Set(
    rows.map(({ coordinate }) => coordinate.rowNumber),
  );
  const missingRowNumbers = [
    ...new Set(
      declaredRows
        .filter(
          ({ coordinate }) =>
            coordinate.sourceArtifactHash === mapping.sourceArtifactHash,
        )
        .map(({ coordinate }) => coordinate.rowNumber),
    ),
  ]
    .filter((rowNumber) => !submittedRowNumbers.has(rowNumber))
    .sort();
  if (missingRowNumbers.length > 0) {
    return inputReview(
      missingRowNumbers.map((rowNumber) => ({
        code: "SOURCE_ROW_MISSING" as const,
        path: `rows.${rowNumber}`,
      })),
    );
  }

  const application = applyApprovedMapping(rows, executable);
  if (application.status === "REVIEW_REQUIRED") {
    return inputReview(
      application.issues.map((issue) =>
        issue.code === "APPROVED_SOURCE_COLUMN_MISSING"
          ? {
              code: issue.code,
              path: `rows.${issue.rowNumber}.values.${issue.sourceColumn}`,
              message: issue.message,
            }
          : {
              code: "MAPPING_APPLICATION_REVIEW_REQUIRED" as const,
              path: `rows${issue.rowNumber ? `.${issue.rowNumber}` : ""}:${issue.code as MappingReviewCode}`,
              message: issue.message,
            },
      ),
    );
  }
  let events = application.events;
  if (mutation === "shuffle") {
    const last = events.at(-1)!;
    events = [last, ...events.slice(0, -1)];
  } else if (mutation === "duplicate") {
    events = [...events, events[0]!];
  }
  if (manifest === undefined) {
    try {
      return replayFoundation(events);
    } catch (error) {
      if (error instanceof CanonicalizationError) {
        return inputReview([
          { code: error.code, path: "rows", message: error.message },
        ]);
      }
      throw error;
    }
  }

  let datasetProfile: ReturnType<typeof computeDatasetProfile>;
  try {
    datasetProfile = computeDatasetProfile(events);
  } catch (error) {
    if (error instanceof CanonicalizationError) {
      return inputReview([
        { code: error.code, path: "rows", message: error.message },
      ]);
    }
    throw error;
  }
  workflow.requireTransition("CASE_PROPOSED");
  const caseApprovalIssues = validateApprovalRecord(
    caseManifestProposal(manifest),
    manifest.approval,
    "caseApproval",
  );
  if (caseApprovalIssues.length > 0) {
    workflow.requireTransition("CASE_REVIEW_REQUIRED");
    return {
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: caseApprovalIssues,
    };
  }
  const profileValidation: CaseProfileValidation = validateCaseAgainstProfile(
    manifest,
    datasetProfile,
  );
  if (!profileValidation.accepted) {
    workflow.requireTransition("CASE_REVIEW_REQUIRED");
    return profileValidation;
  }
  const matchingRules = manifest.rules.filter(
    ({ ruleId, ruleVersion }) =>
      ruleId === "RAPID_PRICE_LIFT" && ruleVersion === "1.1",
  );
  if (matchingRules.length !== 1) {
    workflow.requireTransition("CASE_REVIEW_REQUIRED");
    return {
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: [
        {
          code: "RULE_CONFIGURATION_REQUIRED",
          path: "rules",
        },
      ],
    };
  }
  workflow.requireTransition("CASE_APPROVED");
  const replay = replayRapidPriceLift(events, manifest);
  workflow.requireTransition("REPLAYED");
  return replay;
}

function validateMappingApproval(
  mapping: SchemaMappingProposal,
  mappingApproval: ApprovalRecord | undefined,
): ApprovalValidation {
  const issues = validateApprovalRecord(
    mappingApprovalArtifact(mapping),
    mappingApproval,
    "mappingApproval",
  );
  if (mappingApproval !== undefined) {
    const overridePaths = justifiedOverridePaths(mappingApproval);
    mapping.fields.forEach((field, index) => {
      if (
        requiresMappingOverride(field) &&
        !overridePaths.has(`fields.${index}`)
      ) {
        issues.push({
          code: "MAPPING_OVERRIDE_REQUIRED",
          path: `fields.${index}`,
        });
      }
    });
  }
  return issues.length === 0
    ? { accepted: true }
    : { accepted: false, status: "REVIEW_REQUIRED", issues };
}
