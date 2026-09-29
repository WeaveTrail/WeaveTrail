import { deepStrictEqual } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CoverageManifestSchema,
  type CoverageManifest,
} from "@weavetrail/contracts";
import { publishedCoverageManifest } from "@weavetrail/published-data";
import {
  resolveClaimCoverage,
  sha256Canonical,
} from "@weavetrail/replay-engine";
import { fscMarketAdaptersByEndpoint } from "../../../scripts/fsc-market-adapters.mjs";
import { verifyPublishedAcquisitions } from "../../../scripts/verify-published-acquisitions.mjs";
import {
  claimCoverageCases,
  claimCoverageEvaluation,
} from "./claim-coverage-cases";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const sources = resolve(repository, "packages/published-data/src/sources");
const real = resolve(sources, "real");
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));

function payloads(manifest: CoverageManifest) {
  const provenanceFiles = readdirSync(real, {
    recursive: true,
    withFileTypes: true,
  })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".provenance.json"),
    )
    .map((entry) => resolve(entry.parentPath, entry.name));
  return manifest.datasets.map((dataset) => {
    const reference = dataset.source.reference;
    if (reference.kind !== "committed")
      throw new Error("Expected committed dataset");
    const provenancePath = provenanceFiles.find(
      (path) => json(path).artifacts.runtimeJsonl.sha256 === reference.sha256,
    );
    if (!provenancePath) throw new Error("Missing payload provenance");
    const provenance = json(provenancePath);
    const directory = dirname(provenancePath);
    const receiptPath = resolve(sources, dataset.acquisitionRecord);
    const receipt = json(receiptPath);
    const paths = new Set([
      provenancePath,
      receiptPath,
      resolve(directory, provenance.artifacts.runtimeJsonl.path),
      resolve(directory, provenance.artifacts.generatedRows.path),
      ...reference.originalBytes.map((original) =>
        resolve(directory, original.path),
      ),
      ...(dataset.acquisitionScope === "complete-series"
        ? [resolve(directory, "declaration.json")]
        : []),
    ]);
    const files = [...paths]
      .map((path) => {
        const bytes = readFileSync(path);
        return {
          path: relative(repository, path),
          bytes: String(bytes.length),
          sha256: createHash("sha256").update(bytes).digest("hex"),
        };
      })
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const totalBytes = files.reduce(
      (sum, file) => sum + BigInt(file.bytes),
      0n,
    );
    return {
      datasetId: dataset.datasetId,
      rowCount: String(dataset.observations.length),
      publisherTotal: String(
        receipt.publisherTotal ?? provenance.pagination.totalCount,
      ),
      totalBytes: String(totalBytes),
      withinByteLimit:
        totalBytes <= BigInt(claimCoverageEvaluation.datasetByteLimit),
      files,
    };
  });
}

function evaluate(manifest: CoverageManifest, phase: "Before" | "After") {
  const cases = claimCoverageCases.map((specimen) => {
    // Same empty definition registry as the current public coverage endpoint.
    const result = resolveClaimCoverage(specimen.request, manifest);
    deepStrictEqual(
      result.status === "UNCONFIRMABLE" ? result.reasonCode : result.status,
      specimen[`expected${phase}`],
      `${phase}: ${specimen.id}`,
    );
    return {
      id: specimen.id,
      description: specimen.description,
      request: result.request,
      status: result.status,
      reasonCode: result.status === "UNCONFIRMABLE" ? result.reasonCode : null,
    };
  });
  return {
    manifestSha256: sha256Canonical(manifest),
    datasetIds: manifest.datasets.map((dataset) => dataset.datasetId),
    sampleCount: String(cases.length),
    unconfirmableShare: {
      numerator: String(
        cases.filter((item) => item.status === "UNCONFIRMABLE").length,
      ),
      denominator: String(cases.length),
    },
    reasons: Object.fromEntries(
      ["OUTSIDE_COVERAGE", "RESOLUTION_TOO_COARSE", "DEFINITION_NOT_BOUND"].map(
        (reason) => [
          reason,
          String(cases.filter((item) => item.reasonCode === reason).length),
        ],
      ),
    ),
    cases,
  };
}

/** Offline scope evaluation only; it grants no reuse permission or sentence grade. */
export async function runClaimCoverageEvaluation(
  input = publishedCoverageManifest,
) {
  const manifest = CoverageManifestSchema.parse(input);
  const verified = await verifyPublishedAcquisitions(
    real,
    fscMarketAdaptersByEndpoint,
  );
  deepStrictEqual(
    manifest.datasets.length,
    verified,
    "Manifest must include every verified dataset",
  );
  const baselineIds = new Set<string>(
    claimCoverageEvaluation.baselineDatasetIds,
  );
  const baselineDatasets = manifest.datasets.filter((dataset) =>
    baselineIds.has(dataset.datasetId),
  );
  deepStrictEqual(
    baselineDatasets.length,
    baselineIds.size,
    "Missing baseline dataset",
  );
  const baseline = CoverageManifestSchema.parse({
    ...manifest,
    datasets: baselineDatasets,
    asOf: baselineDatasets
      .map((dataset) => dataset.source.retrievedAt)
      .sort((a, b) => Date.parse(a) - Date.parse(b))
      .at(-1),
  });
  return {
    schemaVersion: "1.0",
    evaluationVersion: claimCoverageEvaluation.version,
    sampleDefinition:
      "Twelve authored structured claim scopes, counted once each; includes an explicitly synthetic missing-stock probe. No pasted-text extraction or numeric grading.",
    definitionRegistry:
      "Empty, matching the current public coverage endpoint; no test-only definitions.",
    before: evaluate(baseline, "Before"),
    after: evaluate(manifest, "After"),
    datasetByteLimit: claimCoverageEvaluation.datasetByteLimit,
    payloadDefinition:
      "Uncompressed original responses, runtime JSONL, generated rows, acquisition receipt, provenance and complete-series declaration; unique paths per dataset. Excludes source code, documentation and Git history/compression.",
    payloads: payloads(manifest),
    limitations: [
      "No new dataset was admitted: current candidate permissions do not authorize modification and redistribution.",
      "UNCONFIRMABLE here is coverage preflight status, not a sentence evidence grade or an estimate for circulating messages.",
      "Covered daily scopes still lack bound numeric definitions; READY would not establish COMPUTED or DIFFERS.",
      "Baseline datasets are frozen by identity; the committed summary pins both manifest hashes and every payload file hash.",
      "The payload budget is a repository admission review bound, not a transport limit or storage/redistribution permission.",
    ],
  };
}
