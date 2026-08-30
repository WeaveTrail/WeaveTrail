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

import { sha256Canonical, type JsonValue } from "./canonical-json";
import {
  validateCaseAgainstProfile,
  type CaseProfileValidation,
} from "./case-validation";
import { computeDatasetProfile } from "./dataset-profile";
import { replayFoundation, type FoundationReplay } from "./replay-foundation";

export type ApprovalIssueCode =
  | "APPROVAL_RECORD_REQUIRED"
  | "APPROVED_ARTIFACT_HASH_MISMATCH"
  | "APPROVAL_REJECTED"
  | "MAPPING_OVERRIDE_REQUIRED";

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
): JsonValue {
  const parsed = SchemaMappingProposalSchema.parse(mapping);
  return {
    mappingVersion: parsed.mappingVersion,
    sourceArtifactHash: parsed.sourceArtifactHash,
    fields: parsed.fields.map((field): JsonValue => {
      const artifactField: { [key: string]: JsonValue } = {
        sourceColumn: field.sourceColumn,
        targetField: field.targetField,
        confidence: field.confidence,
        evidence: field.evidence,
        status: field.status,
      };
      if (field.transform !== undefined) {
        artifactField.transform = field.transform;
      }
      return artifactField;
    }),
  };
}

function validateApprovalRecord(
  artifact: JsonValue,
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
  events: readonly unknown[],
  mapping: SchemaMappingProposal,
  mappingApproval: ApprovalRecord | undefined,
  manifest: CaseManifest | undefined,
):
  | FoundationReplay
  | Exclude<ApprovalValidation, { accepted: true }>
  | Exclude<CaseProfileValidation, { accepted: true }> {
  const approval = validateReplayApprovals(mapping, mappingApproval, manifest);
  if (!approval.accepted) return approval;
  if (manifest === undefined) {
    return {
      accepted: false,
      status: "REVIEW_REQUIRED",
      issues: [{ code: "APPROVAL_RECORD_REQUIRED", path: "caseApproval" }],
    };
  }

  const profileValidation = validateCaseAgainstProfile(
    manifest,
    computeDatasetProfile(events),
  );
  if (!profileValidation.accepted) return profileValidation;
  return replayFoundation(events);
}
