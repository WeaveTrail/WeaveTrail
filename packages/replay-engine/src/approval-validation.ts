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
  replayRapidPriceLift,
  type RapidPriceLiftReplay,
} from "./rapid-price-lift";
import {
  applyApprovedMapping,
  approvedSourceMapping,
  type MappingReviewCode,
  type SourceRow,
} from "./source-ingest";

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
  const issues = validateApprovalRecord(
    mappingApprovalArtifact(mapping),
    mappingApproval,
    "mappingApproval",
  );
  if (mappingApproval !== undefined) {
    const overridePaths = justifiedOverridePaths(mappingApproval);
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
  declaredRows: readonly SourceRow[],
  mapping: SchemaMappingProposal,
  mappingApproval: ApprovalRecord | undefined,
  manifest: CaseManifest | undefined,
  mutation: "baseline" | "shuffle" | "duplicate" = "baseline",
):
  | FoundationReplay
  | RapidPriceLiftReplay
  | Exclude<ApprovalValidation, { accepted: true }>
  | Exclude<CaseProfileValidation, { accepted: true }> {
  const approval = validateMappingApproval(mapping, mappingApproval);
  if (!approval.accepted) return approval;
  if (manifest !== undefined) {
    const caseApprovalIssues = validateApprovalRecord(
      caseManifestProposal(manifest),
      manifest.approval,
      "caseApproval",
    );
    if (caseApprovalIssues.length > 0) {
      return {
        accepted: false,
        status: "REVIEW_REQUIRED",
        issues: caseApprovalIssues,
      };
    }
  }
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
    return {
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: missingRowNumbers.map((rowNumber) => ({
        code: "SOURCE_ROW_MISSING" as const,
        path: `rows.${rowNumber}`,
      })),
    };
  }

  const application = applyApprovedMapping(rows, executable);
  if (application.status === "REVIEW_REQUIRED") {
    return {
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: application.issues.map((issue) =>
        issue.code === "APPROVED_SOURCE_COLUMN_MISSING"
          ? {
              code: issue.code,
              path: `rows.${issue.rowNumber}.values.${issue.sourceColumn}`,
            }
          : {
              code: "MAPPING_APPLICATION_REVIEW_REQUIRED" as const,
              path: `rows${issue.rowNumber ? `.${issue.rowNumber}` : ""}:${issue.code as MappingReviewCode}`,
            },
      ),
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
  const matchingRules = manifest.rules.filter(
    ({ ruleId, ruleVersion }) =>
      ruleId === "RAPID_PRICE_LIFT" && ruleVersion === "1.1",
  );
  if (matchingRules.length !== 1) {
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
  return replayRapidPriceLift(events, manifest);
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
