import { readFileSync } from "node:fs";

import {
  CaseManifestProposalSchema,
  requiresMappingOverride,
  type ApprovalRecord,
  type CaseManifest,
  type SchemaMappingProposal,
} from "@weavetrail/contracts";
import { publishedReplaySources } from "@weavetrail/published-data";
import {
  actorlessMultiInstrumentMappingProposal,
  committedReplayScenarios,
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
  publishedExecutionConflictProposal,
  publishedExecutionManifest,
  rapidPriceLiftScenarios,
} from "@weavetrail/scenarios";
import { describe, expect, it } from "vitest";

import {
  caseManifestProposal,
  mappingApprovalArtifact,
} from "./approval-validation";
import { sha256Canonical } from "./canonical-hash";
import {
  assembleEvidenceBundle,
  verifyBundle,
  type EvidenceSourceArtifact,
} from "./evidence-bundle";
import { evidenceBundleHash } from "./evidence-bundle-hash";
import { canonicalReplayResultHash } from "./replay-foundation";

type Entry = {
  name: string;
  artifact: EvidenceSourceArtifact;
  proposal: SchemaMappingProposal;
  manifest?: CaseManifest;
};

function artifact(path: string): EvidenceSourceArtifact {
  return {
    bytes: readFileSync(new URL(path, import.meta.url)),
    format: path.endsWith(".csv") ? "CSV" : "JSON_LINES",
  };
}

function approvalFor(proposal: SchemaMappingProposal): ApprovalRecord {
  return {
    approvedArtifactHash: sha256Canonical(mappingApprovalArtifact(proposal)),
    reviewerRef: "bundle-verifier-fixture",
    decision: "APPROVED",
    overrides: [
      ...proposal.fields.flatMap((field, index) =>
        requiresMappingOverride(field)
          ? [{ fieldPath: `fields.${index}`, reason: field.evidence }]
          : [],
      ),
      ...("unmappedFields" in proposal
        ? proposal.unmappedFields.flatMap((field, index) =>
            requiresMappingOverride(field)
              ? [
                  {
                    fieldPath: `unmappedFields.${index}`,
                    reason: field.evidence,
                  },
                ]
              : [],
          )
        : []),
    ],
    approvedAt: "2026-09-09T00:00:00Z",
  };
}

const syntheticProposals: Record<string, SchemaMappingProposal> = {
  "actorless-multi-instrument-quotes.jsonl":
    actorlessMultiInstrumentMappingProposal,
  "concentrated-buy-dialect-a.csv": concentratedBuyDialectAProposal,
  "concentrated-buy-dialect-b.jsonl": concentratedBuyDialectBProposal,
  ...Object.fromEntries(
    Object.entries(rapidPriceLiftScenarios).map(([name, scenario]) => [
      name,
      scenario.mappingProposal,
    ]),
  ),
  "published-execution-fix44.csv":
    committedReplayScenarios["published-execution-fix44.csv"].mappingProposal,
  "published-execution-fix44-conflicting-evidence.csv":
    publishedExecutionConflictProposal,
  "published-execution-h0stcnt0.jsonl":
    committedReplayScenarios["published-execution-h0stcnt0.jsonl"]
      .mappingProposal,
};

const syntheticEntries: Entry[] = Object.entries(syntheticProposals).map(
  ([name, proposal]) => ({
    name,
    artifact: artifact(`../../scenarios/src/sources/${name}`),
    proposal,
    ...(name in rapidPriceLiftScenarios
      ? {
          manifest:
            rapidPriceLiftScenarios[
              name as keyof typeof rapidPriceLiftScenarios
            ].manifest,
        }
      : name === "published-execution-fix44.csv"
        ? { manifest: publishedExecutionManifest }
        : {}),
  }),
);

const publishedEntries: Entry[] = Object.entries(publishedReplaySources).map(
  ([name, source]) => ({
    name,
    artifact: artifact(`../../published-data/src/sources/${name}`),
    proposal: source.mappingProposal,
  }),
);

const entries = [...syntheticEntries, ...publishedEntries];

function assemble(entry: Entry) {
  return assembleEvidenceBundle({
    sourceArtifacts: [entry.artifact],
    mappings: [
      { proposal: entry.proposal, approval: approvalFor(entry.proposal) },
    ],
    ...(entry.manifest === undefined
      ? {}
      : {
          case: {
            proposal: CaseManifestProposalSchema.parse(
              caseManifestProposal(entry.manifest),
            ),
            approval: entry.manifest.approval,
          },
        }),
  });
}

describe("Evidence Bundle 1.3 assembly and independent verification", () => {
  it("keeps the assembly matrix exhaustive over committed source artifacts", () => {
    expect(Object.keys(syntheticProposals).sort()).toEqual(
      Object.keys(committedReplayScenarios).sort(),
    );
    expect(entries).toHaveLength(
      Object.keys(committedReplayScenarios).length +
        Object.keys(publishedReplaySources).length,
    );
  });

  it.each(entries)(
    "assembles and verifies committed artifact $name",
    (entry) => {
      const bundle = assemble(entry);

      expect(verifyBundle(bundle, [entry.artifact])).toEqual({
        verified: true,
        bundle,
      });
      if (bundle.replay === undefined) {
        expect(bundle.workflowState).toBe("INPUT_REVIEW_REQUIRED");
      } else {
        expect(
          bundle.replay.events.every(
            ({ rawRowHash }) => rawRowHash.length === 64,
          ),
        ).toBe(true);
      }
    },
  );

  it("covers the schema-grounded FIX execution result", () => {
    const entry = entries.find(
      ({ name }) => name === "published-execution-fix44.csv",
    )!;
    const bundle = assemble(entry);

    expect(bundle.mappings[0]!.proposal.mappingVersion).toBe("1.8");
    expect(bundle.workflowState).toBe("REPLAYED");
    expect(bundle.replay!.evaluation!.result).toBe("SUPPORTED");
  });

  it("assembles a review-required declaration that stops before replay", () => {
    const entry = entries.find(
      ({ name }) => name === "published-execution-h0stcnt0.jsonl",
    )!;
    const bundle = assembleEvidenceBundle({
      sourceArtifacts: [entry.artifact],
      mappings: [{ proposal: entry.proposal }],
    });

    expect(bundle.workflowState).toBe("MAPPING_REVIEW_REQUIRED");
    expect(bundle).not.toHaveProperty("replay");
    expect(verifyBundle(bundle, [entry.artifact]).verified).toBe(true);
  });

  it("omits sensitivity values for an INCONCLUSIVE evaluation", () => {
    const entry = entries.find(
      ({ name }) => name === "rapid-price-lift-insufficient-evidence.csv",
    )!;
    const evaluation = assemble(entry).replay!.evaluation!;

    expect(evaluation.result).toBe("INCONCLUSIVE");
    expect(evaluation.sensitivity).toBeNull();
    expect(evaluation.findings).toEqual([]);
  });

  const protectedMutations = [
    [
      "source",
      (bundle: ReturnType<typeof assemble>) => {
        bundle.sourceArtifacts[0]!.sourceArtifactHash = "b".repeat(64);
      },
    ],
    [
      "approval",
      (bundle: ReturnType<typeof assemble>) => {
        bundle.mappings[0]!.approval!.reviewerRef += "-changed";
      },
    ],
    [
      "manifest",
      (bundle: ReturnType<typeof assemble>) => {
        bundle.case!.proposal.caseId += "-changed";
      },
    ],
    [
      "rule version",
      (bundle: ReturnType<typeof assemble>) => {
        (bundle.replay!.evaluation as { ruleVersion: string }).ruleVersion =
          "1.2";
      },
    ],
    [
      "result",
      (bundle: ReturnType<typeof assemble>) => {
        (bundle.replay!.evaluation as { result: string }).result =
          "NOT_SUPPORTED";
      },
    ],
    [
      "finding",
      (bundle: ReturnType<typeof assemble>) => {
        bundle.replay!.evaluation!.findings[0]!.observedValue = "999";
      },
    ],
    [
      "sensitivity",
      (bundle: ReturnType<typeof assemble>) => {
        const evaluation = bundle.replay!.evaluation!;
        if (evaluation.sensitivity !== null) {
          evaluation.sensitivity.removalSensitivityBps = "999";
        }
      },
    ],
  ] as const;

  it.each(protectedMutations)(
    "rejects a protected %s change",
    (_name, mutate) => {
      const entry = entries.find(
        ({ name }) => name === "rapid-price-lift-supported.csv",
      )!;
      const candidate = structuredClone(assemble(entry));
      mutate(candidate);

      expect(verifyBundle(candidate, [entry.artifact]).verified).toBe(false);
    },
  );

  it("keeps the semantic result hash stable for receivedAt but rejects the changed bundle", () => {
    const entry = entries.find(
      ({ name }) => name === "rapid-price-lift-supported.csv",
    )!;
    const original = assemble(entry);
    const candidate = structuredClone(original);
    candidate.replay!.events[0]!.receivedAt = "2026-09-09T00:00:00Z";

    expect(
      canonicalReplayResultHash(
        candidate.replay!.events,
        candidate.replay!.evaluation,
      ),
    ).toBe(original.replay!.canonicalResultHash);
    expect(verifyBundle(candidate, [entry.artifact]).verified).toBe(false);
  });

  it("recomputes raw-row hashes instead of trusting a self-consistent declaration hash", () => {
    const entry = entries.find(
      ({ name }) => name === "rapid-price-lift-supported.csv",
    )!;
    const candidate = structuredClone(assemble(entry));
    candidate.replay!.events[0]!.rawRowHash = "b".repeat(64);
    candidate.bundleHash = evidenceBundleHash(candidate);

    const verification = verifyBundle(candidate, [entry.artifact]);
    expect(verification.verified).toBe(false);
    if (!verification.verified) {
      expect(verification.issues.map(({ code }) => code)).toContain(
        "RECOMPUTED_BUNDLE_MISMATCH",
      );
    }
  });

  it("rejects source bytes that do not match the declaration", () => {
    const entry = entries.find(
      ({ name }) => name === "rapid-price-lift-supported.csv",
    )!;
    const changedBytes = new Uint8Array(entry.artifact.bytes.length + 1);
    changedBytes.set(entry.artifact.bytes);
    changedBytes[changedBytes.length - 1] = 10;

    expect(
      verifyBundle(assemble(entry), [
        { ...entry.artifact, bytes: changedBytes },
      ]).verified,
    ).toBe(false);
  });
});
