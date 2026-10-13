import { readFileSync } from "node:fs";
import { format } from "prettier";
import {
  CORPUS_VERSION,
  GENERATION_SEED,
  GENERATOR_VERSION,
} from "./mapping-corpus-contract";
import { generateMappingStudy, sha256 } from "./mapping-corpus-generator";
import {
  overlapReport,
  preflight,
  requireInvariant,
} from "./mapping-corpus-preflight";

export const corpusDirectory = new URL(
  "../fixtures/mapping-study-v1/",
  import.meta.url,
);
export async function renderMappingStudy() {
  const study = generateMappingStudy();
  const report = preflight(study);
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
      status: "PENDING_INDEPENDENT_REVIEW",
      records: study.families.map((f) => ({
        familyId: f.id,
        author: f.author,
        authoringDate: "2026-10-13",
        ...f.review,
        disagreements: [],
        resolutions: [],
      })),
    },
    "exclusions.json": {
      version: CORPUS_VERSION,
      status: "UNSEALED",
      records: [],
    },
    "exposure-ledger.json": {
      version: CORPUS_VERSION,
      status: "UNSEALED",
      records: [
        {
          audience: "REPOSITORY_READERS_AND_AUTHORING_ASSISTANT",
          scope: "All generated inputs, proposed gold, briefs and relations",
          secret: false,
          providerCalls: "NONE_BY_THIS_GENERATOR",
          independentReviewerExposure: "NOT_RECORDED_YET",
          limitation:
            "Public synthetic inputs cannot establish absence of training exposure; no independent review or experiment is represented as complete.",
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
        async ([name, value]) =>
          [
            name,
            await format(JSON.stringify(value), { parser: "json" }),
          ] as const,
      ),
    ),
  );
  const sourcePaths = [
    "mapping-corpus-authoring.ts",
    "mapping-corpus-contract.ts",
    "mapping-corpus-generator.ts",
    "mapping-corpus-preflight.ts",
    "mapping-corpus-artifacts.ts",
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
    independentGoldReview: "PENDING",
    experimentPreRegistration: "PLANNED",
    liveRunnerEligible: false,
    note: "Checksums identify draft bytes, not an evaluation seal. Review/exclusion hashes are draft placeholders pending independent decisions. Existing runners reject these split/version contracts.",
  };
  bytes["manifest.json"] = await format(JSON.stringify(manifest), {
    parser: "json",
  });
  return bytes;
}

export async function verifyMappingStudy() {
  const first = await renderMappingStudy(),
    second = await renderMappingStudy();
  requireInvariant(
    JSON.stringify(first) === JSON.stringify(second),
    "two generations must give identical bytes",
  );
  for (const [name, bytes] of Object.entries(first)) {
    requireInvariant(
      readFileSync(new URL(name, corpusDirectory), "utf8") === bytes,
      `${name} differs from committed authoring; verification never updates expectations`,
    );
  }
  return first;
}
