import type {
  ApprovalRecord,
  CaseManifest,
  CaseManifestProposal,
  SchemaMappingProposal,
} from "@weavetrail/contracts";
import {
  CaseManifestProposalSchema,
  MAPPING_CONFIDENCE_REVIEW_THRESHOLD,
  SchemaMappingProposalSchema,
} from "@weavetrail/contracts";

import { sha256Canonical, type CanonicalJsonInput } from "./canonical-json";
import {
  validateCaseAgainstProfile,
  type CaseProfileValidation,
} from "./case-validation";
import { computeDatasetProfile } from "./dataset-profile";
import { replayFoundation, type FoundationReplay } from "./replay-foundation";
import {
  applyApprovedMapping,
  approvedSourceMapping,
  type MappingReviewCode,
  type SourceRow,
} from "./source-ingest";

export type ApprovalIssueCode =
  | "APPROVAL_RECORD_REQUIRED"
  | "APPROVED_ARTIFACT_HASH_MISMATCH"
  | "APPROVAL_REJECTED"
  | "MAPPING_OVERRIDE_REQUIRED"
  | "SOURCE_ARTIFACT_NOT_APPROVED"
  | "MAPPING_APPLICATION_REVIEW_REQUIRED";

export type ApprovalValidation =
  | { accepted: true }
  | {
      accepted: false;
      status: "REVIEW_REQUIRED";
      issues: { code: ApprovalIssueCode; path: string }[];
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

export function validateReplayApprovals(
  mapping: SchemaMappingProposal,
  mappingApproval: ApprovalRecord | undefined,
  manifest: CaseManifest | undefined,
): ApprovalValidation {
  const issues = validateApprovalRecord(
    mappingApprovalArtifact(mapping),
    mappingApproval,
    "mappingApproval",
  );
  if (mappingApproval !== undefined) {
    const overridePaths = new Set(
      mappingApproval.overrides.map(({ fieldPath }) => fieldPath),
    );
    for (const [index, field] of mapping.fields.entries()) {
      const requiresOverride =
        field.status === "REVIEW_REQUIRED" ||
        field.confidence < MAPPING_CONFIDENCE_REVIEW_THRESHOLD;
      const fieldPath = `fields.${index}`;
      if (requiresOverride && !overridePaths.has(fieldPath)) {
        issues.push({ code: "MAPPING_OVERRIDE_REQUIRED", path: fieldPath });
      }
    }
  }

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
  mapping: SchemaMappingProposal,
  mappingApproval: ApprovalRecord | undefined,
  manifest: CaseManifest | undefined,
  mutation: "baseline" | "shuffle" | "duplicate" = "baseline",
):
  | FoundationReplay
  | Exclude<ApprovalValidation, { accepted: true }>
  | Exclude<CaseProfileValidation, { accepted: true }> {
  const approval = validateMappingApproval(mapping, mappingApproval);
  if (!approval.accepted) return approval;
  const executable = approvedSourceMapping(mapping);
  const foreignRows = rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        row.coordinate.sourceArtifactHash !== mapping.sourceArtifactHash,
    );
  if (foreignRows.length > 0) {
    return {
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: foreignRows.map(({ index }) => ({
        code: "SOURCE_ARTIFACT_NOT_APPROVED" as const,
        path: `rows.${index}.coordinate.sourceArtifactHash`,
      })),
    };
  }

  const application = applyApprovedMapping(rows, executable);
  if (application.status === "REVIEW_REQUIRED") {
    return {
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: application.issues.map((issue) => ({
        code: "MAPPING_APPLICATION_REVIEW_REQUIRED" as const,
        path: `rows${issue.rowNumber ? `.${issue.rowNumber}` : ""}:${issue.code as MappingReviewCode}`,
      })),
    };
  }
  let events = application.events;
  if (mutation === "shuffle") {
    const last = events.at(-1)!;
    events = [last, ...events.slice(0, -1)];
  } else if (mutation === "duplicate") {
    events = [...events, events[0]!];
  }
  if (manifest === undefined) return replayFoundation(events);

  const profileValidation = validateCaseAgainstProfile(
    manifest,
    computeDatasetProfile(events),
  );
  if (!profileValidation.accepted) return profileValidation;
  return replayFoundation(events);
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
    const overridePaths = new Set(
      mappingApproval.overrides.map(({ fieldPath }) => fieldPath),
    );
    mapping.fields.forEach((field, index) => {
      if (
        (field.status === "REVIEW_REQUIRED" ||
          field.confidence < MAPPING_CONFIDENCE_REVIEW_THRESHOLD) &&
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
