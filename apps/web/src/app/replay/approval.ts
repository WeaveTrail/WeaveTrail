import type {
  ApprovalRecord,
  ReplayResultResponse,
  ReplayScenario,
  SchemaMappingProposal,
} from "@weavetrail/contracts";
import { requiresMappingOverride } from "@weavetrail/contracts";
import {
  canonicalJson,
  type CanonicalJsonInput,
} from "@weavetrail/replay-engine/canonical-json";

import type { ReplayError } from "./types";

/**
 * What an approval is and when one may be given. A person approves one exact
 * artifact; the browser hashes it with the same canonical bytes the replay
 * boundary checks, and a flagged field needs a reviewer reason first.
 */

export const APPROVAL_HASH_ERROR =
  "Approval hash could not be computed. Approval and replay remain blocked.";

type ApprovalHashCrypto = {
  subtle?: Pick<SubtleCrypto, "digest">;
};

/** One field the proposal flagged, with the label its row is titled by. */
export type FlaggedMappingField = {
  readonly fieldPath: string;
  readonly label: string;
};

/**
 * The fields a person has to answer for before this proposal can be approved,
 * in the order their rows appear. Deriving the summary that names them, the
 * blocked check and the overrides an approval carries from one list is what
 * keeps those three from disagreeing about which fields are flagged.
 */
export function flaggedMappingFields(
  proposal: SchemaMappingProposal,
): readonly FlaggedMappingField[] {
  const mapped = proposal.fields.flatMap((field, index) =>
    requiresMappingOverride(field)
      ? [{ fieldPath: `fields.${index}`, label: field.sourceColumn }]
      : [],
  );
  const absent =
    "unmappedFields" in proposal
      ? proposal.unmappedFields.flatMap((field, index) =>
          requiresMappingOverride(field)
            ? [
                {
                  fieldPath: `unmappedFields.${index}`,
                  label: field.targetField,
                },
              ]
            : [],
        )
      : [];
  return [...mapped, ...absent];
}

/** The flagged fields still without a reviewer reason. */
export function unresolvedMappingFields(
  proposal: SchemaMappingProposal,
  reasons: Readonly<Record<string, string>>,
): readonly FlaggedMappingField[] {
  return flaggedMappingFields(proposal).filter(
    ({ fieldPath }) => !reasons[fieldPath]?.trim(),
  );
}

export function mappingOverrides(
  proposal: SchemaMappingProposal,
  reasons: Readonly<Record<string, string>>,
): ApprovalRecord["overrides"] {
  return flaggedMappingFields(proposal).flatMap(({ fieldPath }) => {
    const reason = reasons[fieldPath]?.trim();
    return reason ? [{ fieldPath, reason }] : [];
  });
}

export function hasUnresolvedMappingReview(
  proposal: SchemaMappingProposal,
  reasons: Readonly<Record<string, string>>,
): boolean {
  return unresolvedMappingFields(proposal, reasons).length > 0;
}

export function resetReplayForScenarioChange(scenario: ReplayScenario) {
  return {
    scenario,
    approval: null,
    caseApproval: null,
    result: null,
    error: null,
  } satisfies {
    scenario: ReplayScenario;
    approval: ApprovalRecord | null;
    caseApproval: ApprovalRecord | null;
    result: ReplayResultResponse | null;
    error: ReplayError | null;
  };
}

export async function approvalFor(
  artifact: CanonicalJsonInput,
  overrides: ApprovalRecord["overrides"] = [],
  cryptoProvider: ApprovalHashCrypto | undefined = globalThis.crypto,
): Promise<ApprovalRecord> {
  try {
    if (cryptoProvider?.subtle === undefined) {
      throw new Error("Web Crypto is unavailable");
    }
    const bytes = new TextEncoder().encode(canonicalJson(artifact));
    const digest = await cryptoProvider.subtle.digest("SHA-256", bytes);
    const approvedArtifactHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return {
      approvedArtifactHash,
      reviewerRef: "reviewer:local-lab",
      decision: "APPROVED",
      overrides,
      approvedAt: new Date().toISOString(),
    };
  } catch {
    throw new Error(APPROVAL_HASH_ERROR);
  }
}

export async function attemptApproval(
  artifact: CanonicalJsonInput,
  overrides: ApprovalRecord["overrides"] = [],
  cryptoProvider: ApprovalHashCrypto | undefined = globalThis.crypto,
): Promise<{ approval: ApprovalRecord | null; error: string | null }> {
  try {
    return {
      approval: await approvalFor(artifact, overrides, cryptoProvider),
      error: null,
    };
  } catch {
    return { approval: null, error: APPROVAL_HASH_ERROR };
  }
}
