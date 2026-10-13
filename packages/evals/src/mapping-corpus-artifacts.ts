import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import {
  CORPUS_VERSION,
  GENERATION_SEED,
  GENERATOR_VERSION,
  GenerationReceiptSchema,
} from "./mapping-corpus-contract";
import { generateMappingStudy, sha256 } from "./mapping-corpus-generator";
import {
  overlapReport,
  preflight,
  requireInvariant,
} from "./mapping-corpus-preflight";

import { corpusReview } from "./mapping-corpus-review";

// Formatting is a pure byte transformation. Cache exact serialized values,
// while regenerating and preflighting the study on every invocation. Different
// generated content always formats again and still fails byte verification.
const formattedJson = new Map<string, string>();
async function jsonBytes(value: unknown) {
  const serialized = JSON.stringify(value);
  const cached = formattedJson.get(serialized);
  if (cached !== undefined) return cached;
  const bytes = await format(serialized, { parser: "json" });
  if (formattedJson.size >= 32)
    formattedJson.delete(formattedJson.keys().next().value!);
  formattedJson.set(serialized, bytes);
  return bytes;
}

export const corpusDirectory = new URL(
  "../fixtures/mapping-study-v1/",
  import.meta.url,
);
export async function renderMappingStudy() {
  const study = generateMappingStudy();
  const report = preflight(study);
  const review = corpusReview(study);
  const artifacts: Record<string, unknown> = {
    "families.json": {
      version: CORPUS_VERSION,
      status: "UNSEALED",
      records: study.families,
    },
    "drift-relations.json": {
      version: CORPUS_VERSION,
      status: "UNSEALED",
      records: study.relations,
    },
    "base-approvals.json": {
      version: CORPUS_VERSION,
      status: "UNSEALED",
      records: study.baseApprovals,
    },
    "review-ledger.json": {
      version: CORPUS_VERSION,
      status: review.status,
      baselineSha256: review.baselineSha256,
      reviewDocumentSha256: review.reviewDocumentSha256,
      records: review.records,
      corrections: review.corrections,
    },
    "exclusions.json": {
      version: CORPUS_VERSION,
      status: "UNSEALED",
      records: review.exclusions,
    },
    "seal-readiness.json": review.sealReadiness,
    "exposure-ledger.json": {
      version: CORPUS_VERSION,
      status: "UNSEALED",
      records: [
        {
          audience: "REPOSITORY_READERS_AND_AUTHORING_ASSISTANT",
          scope: "All generated inputs, proposed gold, briefs and relations",
          secret: false,
          providerCalls: "NONE_BY_THIS_GENERATOR",
          independentReviewerExposure:
            "Recorded in docs/MAPPING_STUDY_V1_GOLD_REVIEW.md; current replacements not independently reviewed",
          originalReviewBaselineSha256: review.baselineSha256,
          limitation:
            "Public synthetic inputs cannot establish absence of training exposure; review is applied with unresolved lineage findings and no experiment is represented as complete.",
        },
      ],
    },
    "overlap-report.json": overlapReport(study),
    "preflight.json": report,
  };
  for (const split of study.splits) {
    artifacts[`${split.input.split}.inputs.json`] = split.input;
    artifacts[`${split.input.split}.gold.json`] = split.gold;
  }
  const bytes: Record<string, string> = Object.fromEntries(
    await Promise.all(
      Object.entries(artifacts).map(
        async ([name, value]) => [name, await jsonBytes(value)] as const,
      ),
    ),
  );
  const sourcePaths = [
    "mapping-corpus-authoring.ts",
    "mapping-corpus-contract.ts",
    "mapping-corpus-generator.ts",
    "mapping-corpus-preflight.ts",
    "mapping-corpus-artifacts.ts",
    "mapping-corpus-review.ts",
  ];
  const manifest = {
    version: CORPUS_VERSION,
    status: "UNSEALED",
    generatorVersion: GENERATOR_VERSION,
    seed: GENERATION_SEED,
    specificationSha256: sha256(
      readFileSync(
        new URL("../../../docs/MAPPING_CORPUS_SPEC.md", import.meta.url),
      ),
    ),
    sourceFiles: sourcePaths.map((path) => ({
      path: `packages/evals/src/${path}`,
      sha256: sha256(readFileSync(new URL(path, import.meta.url))),
    })),
    commandSource: {
      path: "scripts/generate-mapping-study.mts",
      sha256: sha256(
        readFileSync(
          new URL(
            "../../../scripts/generate-mapping-study.mts",
            import.meta.url,
          ),
        ),
      ),
    },
    lockfileSha256: sha256(
      readFileSync(new URL("../../../pnpm-lock.yaml", import.meta.url)),
    ),
    files: Object.entries(bytes).map(([path, content]) => ({
      path,
      sha256: sha256(content),
    })),
    independentGoldReview: review.status,
    reviewBaseline: {
      path: "packages/evals/fixtures/mapping-study-review-v1/baseline.json",
      sha256: review.baselineSha256,
      reviewDocumentSha256: review.reviewDocumentSha256,
      originalSourceCommit: review.sourceCommit,
    },
    sealReadiness: "BLOCKED",
    experimentPreRegistration: "PLANNED",
    liveRunnerEligible: false,
    note: "Checksums bind corrected drafts, applied independent decisions and replacements, not an evaluation seal. Unresolved lineage and changed-input review block sealing. Existing runners reject these split/version contracts.",
  };
  bytes["manifest.json"] = await jsonBytes(manifest);
  return bytes;
}

export async function verifyMappingStudy(
  directory: string | URL = corpusDirectory,
) {
  const first = await renderMappingStudy(),
    second = await renderMappingStudy();
  requireInvariant(
    JSON.stringify(first) === JSON.stringify(second),
    "two generations must give identical bytes",
  );
  const root =
    typeof directory === "string"
      ? resolve(directory)
      : fileURLToPath(directory);
  const expectedFiles = new Set([
    ...Object.keys(first),
    "README.md", // Authored documentation, outside generated JSON byte checks.
    "generation-receipt.json", // Volatile capture, validated separately below.
    "generation-receipt.sha256",
  ]);
  for (const entry of readdirSync(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (entry.isDirectory()) continue;
    const name = relative(root, join(entry.parentPath, entry.name));
    requireInvariant(
      entry.isFile() && expectedFiles.has(name),
      `unexpected corpus artifact: ${name}`,
    );
  }
  for (const [name, bytes] of Object.entries(first)) {
    requireInvariant(
      readFileSync(join(root, name), "utf8") === bytes,
      `${name} differs from committed authoring; verification never updates expectations`,
    );
  }
  const receiptBytes = readFileSync(
    join(root, "generation-receipt.json"),
    "utf8",
  );
  const receipt = GenerationReceiptSchema.parse(JSON.parse(receiptBytes));
  requireInvariant(
    readFileSync(join(root, "generation-receipt.sha256"), "utf8") ===
      `${sha256(receiptBytes)}  generation-receipt.json\n`,
    "generation receipt checksum mismatch",
  );
  requireInvariant(
    receipt.manifestSha256 === sha256(first["manifest.json"]!),
    "generation receipt manifest binding mismatch",
  );
  return first;
}
