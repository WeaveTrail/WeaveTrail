import { deepStrictEqual } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { expect, it } from "vitest";
import { publishedCoverageManifest } from "@weavetrail/published-data";
import { runClaimCoverageEvaluation } from "./claim-coverage-runner";

it("reproduces the coverage evaluation and payload inventory without updating expectations", async () => {
  const result = await runClaimCoverageEvaluation();
  const committed = readFileSync(
    new URL("../results/published-claim-coverage-v1.json", import.meta.url),
    "utf8",
  );
  deepStrictEqual(result, JSON.parse(committed));
  const output = await format(JSON.stringify(result, null, 2), {
    parser: "json",
  });
  deepStrictEqual(output, committed);
  if (process.env.WEAVETRAIL_COVERAGE_EVALUATION_OUTPUT)
    writeFileSync(process.env.WEAVETRAIL_COVERAGE_EVALUATION_OUTPUT, output);
});

it("fails if a coverage change invalidates an authored claim scope", async () => {
  const changed = structuredClone(publishedCoverageManifest);
  for (const dataset of changed.datasets)
    dataset.observations = dataset.observations.filter(
      (observation) => observation.instrumentId !== "KR7000020008",
    );
  await expect(runClaimCoverageEvaluation(changed)).rejects.toThrow(
    "Before: admitted-stock-close",
  );
});

it("fails if the manifest omits an offline verified dataset", async () => {
  const changed = structuredClone(publishedCoverageManifest);
  changed.datasets = changed.datasets.filter(
    (dataset) => dataset.instrumentFamily.kind !== "market",
  );
  await expect(runClaimCoverageEvaluation(changed)).rejects.toThrow(
    "Manifest must include every verified dataset",
  );
});
