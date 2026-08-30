import type {
  ApprovalRecord,
  CaseManifest,
  CaseManifestProposal,
  SchemaMappingProposal,
} from "@weavetrail/contracts";

import { sha256Canonical, type JsonValue } from "./canonical-json";

export type ApprovalIssueCode =
  | "APPROVAL_RECORD_REQUIRED"
  | "APPROVED_ARTIFACT_HASH_MISMATCH"
  | "APPROVAL_REJECTED";

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
  return {
    manifestVersion: manifest.manifestVersion,
    caseId: manifest.caseId,
    canonicalDatasetHash: manifest.canonicalDatasetHash,
    hypothesis: manifest.hypothesis,
    rules: manifest.rules,
    aiTrace: manifest.aiTrace,
  };
}

export function mappingApprovalArtifact(
  mapping: SchemaMappingProposal,
): JsonValue {
  return {
    mappingVersion: mapping.mappingVersion,
    sourceArtifactHash: mapping.sourceArtifactHash,
    fields: mapping.fields.map((field) => ({
      sourceColumn: field.sourceColumn,
      targetField: field.targetField,
      ...(field.transform === undefined ? {} : { transform: field.transform }),
      confidence: field.confidence,
      evidence: field.evidence,
      status: field.status,
    })),
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
