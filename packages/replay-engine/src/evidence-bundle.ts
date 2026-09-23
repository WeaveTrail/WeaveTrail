import {
  CaseManifestSchema,
  EvidenceBundleV13Schema,
  RapidPriceLiftResultSchema,
  type EvidenceBundleV13,
} from "@weavetrail/contracts";

import { replayApproved } from "./approval-validation";
import { canonicalJson } from "./canonical-json";
import { canonicalDatasetHash } from "./canonical-dataset";
import { evidenceBundleHash } from "./evidence-bundle-hash";
import { canonicalReplayResultHash, ENGINE_VERSION } from "./replay-foundation";
import { RequestWorkflow } from "./request-workflow";
import {
  parseCsvSourceArtifact,
  parseJsonLinesSourceArtifact,
  sourceArtifactHash,
} from "./source-ingest";

export type EvidenceSourceArtifact = {
  bytes: Uint8Array;
  format: "CSV" | "JSON_LINES";
};

export type EvidenceBundleAssemblyInput = {
  sourceArtifacts: readonly EvidenceSourceArtifact[];
  mappings: EvidenceBundleV13["mappings"];
  case?: EvidenceBundleV13["case"];
};

export type EvidenceBundleVerificationIssue = {
  code:
    | "BUNDLE_SCHEMA_INVALID"
    | "BUNDLE_HASH_MISMATCH"
    | "CANONICAL_DATASET_HASH_MISMATCH"
    | "CANONICAL_RESULT_HASH_MISMATCH"
    | "INVALID_CANONICAL_EVENT_SET"
    | "SOURCE_ARTIFACT_MISMATCH"
    | "RECOMPUTED_BUNDLE_MISMATCH"
    | "ASSEMBLY_FAILED";
  path: (string | number)[];
  message: string;
};

export type EvidenceBundleVerification =
  | { verified: true; bundle: EvidenceBundleV13 }
  | {
      verified: false;
      issues: EvidenceBundleVerificationIssue[];
    };

export class EvidenceBundleAssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceBundleAssemblyError";
  }
}

function parseArtifact(artifact: EvidenceSourceArtifact, declaredHash: string) {
  switch (artifact.format) {
    case "CSV":
      return parseCsvSourceArtifact(artifact.bytes, declaredHash);
    case "JSON_LINES":
      return parseJsonLinesSourceArtifact(artifact.bytes, declaredHash);
    default:
      throw new EvidenceBundleAssemblyError(
        `Unsupported source artifact format ${String(artifact.format)}.`,
      );
  }
}

function finishBundle(
  declaration: Omit<EvidenceBundleV13, "bundleHash">,
): EvidenceBundleV13 {
  const unhashed = EvidenceBundleV13Schema.parse({
    ...declaration,
    bundleHash: "0".repeat(64),
  });
  return EvidenceBundleV13Schema.parse({
    ...unhashed,
    bundleHash: evidenceBundleHash(unhashed),
  });
}

/**
 * Assemble a Bundle 1.3 declaration from exact source bytes. The current replay
 * request accepts one mapping, so a multi-mapping declaration fails closed.
 */
export function assembleEvidenceBundle(
  input: EvidenceBundleAssemblyInput,
): EvidenceBundleV13 {
  if (input.sourceArtifacts.length === 0) {
    throw new EvidenceBundleAssemblyError(
      "At least one source artifact is required.",
    );
  }
  if (input.mappings.length > 1) {
    throw new EvidenceBundleAssemblyError(
      "Bundle assembly supports at most one mapping until multi-source replay is defined.",
    );
  }

  const sourceArtifacts = input.sourceArtifacts.map(({ bytes }) => ({
    sourceArtifactHash: sourceArtifactHash(bytes),
  }));
  if (
    new Set(sourceArtifacts.map(({ sourceArtifactHash }) => sourceArtifactHash))
      .size !== sourceArtifacts.length
  ) {
    throw new EvidenceBundleAssemblyError(
      "Source artifact declarations must be unique.",
    );
  }

  if (input.mappings.length === 0) {
    if (input.case !== undefined) {
      throw new EvidenceBundleAssemblyError(
        "A case declaration cannot precede mapping approval.",
      );
    }
    return finishBundle({
      bundleVersion: "1.3",
      sourceArtifacts,
      mappings: [],
      ...(input.case === undefined ? {} : { case: input.case }),
      workflowState: "UPLOADED",
    });
  }

  const mapping = input.mappings[0]!;
  const artifactIndex = sourceArtifacts.findIndex(
    ({ sourceArtifactHash: hash }) =>
      hash === mapping.proposal.sourceArtifactHash,
  );
  if (artifactIndex < 0 || sourceArtifacts.length !== 1) {
    throw new EvidenceBundleAssemblyError(
      "The mapping must resolve exactly one supplied source artifact.",
    );
  }
  const rows = parseArtifact(
    input.sourceArtifacts[artifactIndex]!,
    mapping.proposal.sourceArtifactHash,
  );
  const foundationWorkflow = new RequestWorkflow();
  const foundation = replayApproved(
    rows,
    rows,
    mapping.proposal,
    mapping.approval,
    undefined,
    "baseline",
    foundationWorkflow,
  );

  if (input.case !== undefined && !("canonicalResultHash" in foundation)) {
    throw new EvidenceBundleAssemblyError(
      "A case declaration cannot precede successful normalization.",
    );
  }

  let workflow = foundationWorkflow;
  let result = foundation;
  if (input.case !== undefined && "canonicalResultHash" in foundation) {
    if (input.case.approval === undefined) {
      workflow.requireTransition("CASE_PROPOSED");
      workflow.requireTransition("CASE_REVIEW_REQUIRED");
    } else {
      const approvedCase = CaseManifestSchema.parse({
        ...input.case.proposal,
        approval: input.case.approval,
      });
      const caseWorkflow = new RequestWorkflow();
      const caseResult = replayApproved(
        rows,
        rows,
        mapping.proposal,
        mapping.approval,
        approvedCase,
        "baseline",
        caseWorkflow,
      );
      if (
        !("canonicalResultHash" in caseResult) &&
        caseWorkflow.state !== "CASE_REVIEW_REQUIRED"
      ) {
        throw new EvidenceBundleAssemblyError(
          "Case replay stopped after successful normalization at an unexpected workflow state.",
        );
      }
      workflow = caseWorkflow;
      result = "canonicalResultHash" in caseResult ? caseResult : foundation;
    }
  }

  return finishBundle({
    bundleVersion: "1.3",
    sourceArtifacts,
    mappings: [...input.mappings],
    ...(input.case === undefined ? {} : { case: input.case }),
    workflowState: workflow.state,
    ...("canonicalResultHash" in result
      ? {
          replay: {
            engineVersion: ENGINE_VERSION,
            canonicalDatasetHash: canonicalDatasetHash(result.events),
            events: result.events,
            ...("evaluation" in result
              ? {
                  evaluation: RapidPriceLiftResultSchema.parse(
                    result.evaluation,
                  ),
                }
              : {}),
            canonicalResultHash:
              input.case?.approval === undefined
                ? canonicalReplayResultHash(result.events)
                : result.canonicalResultHash,
          },
        }
      : {}),
  });
}

/** Verify shape, source bytes, approvals, canonical replay output and hashes. */
export function verifyBundle(
  candidate: unknown,
  suppliedArtifacts: readonly EvidenceSourceArtifact[],
): EvidenceBundleVerification {
  const parsed = EvidenceBundleV13Schema.safeParse(candidate);
  if (!parsed.success) {
    return {
      verified: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "BUNDLE_SCHEMA_INVALID",
        path: issue.path.map(String),
        message: issue.message,
      })),
    };
  }

  const bundle = parsed.data;
  const issues: EvidenceBundleVerificationIssue[] = [];
  if (evidenceBundleHash(bundle) !== bundle.bundleHash) {
    issues.push({
      code: "BUNDLE_HASH_MISMATCH",
      path: ["bundleHash"],
      message: "bundleHash does not match the canonical bundle declaration.",
    });
  }
  if (bundle.replay !== undefined) {
    try {
      if (
        canonicalDatasetHash(bundle.replay.events) !==
        bundle.replay.canonicalDatasetHash
      ) {
        issues.push({
          code: "CANONICAL_DATASET_HASH_MISMATCH",
          path: ["replay", "canonicalDatasetHash"],
          message: "canonicalDatasetHash does not match the declared events.",
        });
      }
      if (
        canonicalReplayResultHash(
          bundle.replay.events,
          bundle.replay.evaluation,
        ) !== bundle.replay.canonicalResultHash
      ) {
        issues.push({
          code: "CANONICAL_RESULT_HASH_MISMATCH",
          path: ["replay", "canonicalResultHash"],
          message:
            "canonicalResultHash does not match the canonical replay preimage.",
        });
      }
    } catch (error) {
      issues.push({
        code: "INVALID_CANONICAL_EVENT_SET",
        path: ["replay", "events"],
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const artifactsByHash = new Map(
    suppliedArtifacts.map((artifact) => [
      sourceArtifactHash(artifact.bytes),
      artifact,
    ]),
  );
  const orderedArtifacts = bundle.sourceArtifacts.flatMap(
    ({ sourceArtifactHash: hash }) => {
      const artifact = artifactsByHash.get(hash);
      return artifact === undefined ? [] : [artifact];
    },
  );
  if (
    orderedArtifacts.length !== bundle.sourceArtifacts.length ||
    suppliedArtifacts.length !== bundle.sourceArtifacts.length
  ) {
    issues.push({
      code: "SOURCE_ARTIFACT_MISMATCH",
      path: ["sourceArtifacts"],
      message:
        "Supplied source bytes do not exactly match the declared artifact hashes.",
    });
  } else {
    try {
      const recomputed = assembleEvidenceBundle({
        sourceArtifacts: orderedArtifacts,
        mappings: bundle.mappings,
        ...(bundle.case === undefined ? {} : { case: bundle.case }),
      });
      if (canonicalJson(recomputed) !== canonicalJson(bundle)) {
        issues.push({
          code: "RECOMPUTED_BUNDLE_MISMATCH",
          path: [],
          message:
            "The declaration differs from the bundle recomputed from source bytes and approvals.",
        });
      }
    } catch (error) {
      issues.push({
        code: "ASSEMBLY_FAILED",
        path: [],
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return issues.length === 0
    ? { verified: true, bundle }
    : { verified: false, issues };
}
