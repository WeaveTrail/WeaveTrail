import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CoverageManifestSchema } from "@weavetrail/contracts";
import { publishedCoverageManifest } from "./coverage";

const root = fileURLToPath(new URL("./sources/", import.meta.url));
const real = resolve(root, "real");
const inventory = readdirSync(real, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => resolve(entry.parentPath, entry.name));
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("derived published coverage inventory", () => {
  it("includes every committed published artifact and acquisition record, discovered independently of the catalog", () => {
    const artifactIds = inventory
      .filter((path) => path.endsWith(".jsonl"))
      .map((path) => relative(root, path))
      .sort();
    const receiptPaths = inventory
      .filter((path) => path.endsWith("acquisition.json"))
      .map((path) => relative(root, path))
      .sort();
    expect(
      publishedCoverageManifest.datasets
        .map((dataset) => {
          if (dataset.source.reference.kind !== "committed")
            throw new Error("Not committed");
          return dataset.source.reference.artifactId;
        })
        .sort(),
    ).toEqual(artifactIds);
    expect(
      publishedCoverageManifest.datasets
        .map((dataset) => dataset.acquisitionRecord)
        .sort(),
    ).toEqual(receiptPaths);
    const provenancePins = inventory
      .filter((path) => path.endsWith(".provenance.json"))
      .map((path) => json(path).artifacts.runtimeJsonl.sha256)
      .sort();
    expect(
      publishedCoverageManifest.datasets
        .map((dataset) => dataset.source.reference.sha256)
        .sort(),
    ).toEqual(provenancePins);
  });

  it("projects the recorded selectors, fields, dates, resolution and provenance without widening a partial window", () => {
    for (const dataset of publishedCoverageManifest.datasets) {
      const receiptPath = resolve(root, dataset.acquisitionRecord);
      const receipt = json(receiptPath);
      const provenancePath = receipt.provenanceFile
        ? resolve(dirname(receiptPath), receipt.provenanceFile)
        : inventory.find(
            (path) =>
              dirname(path) === dirname(receiptPath) &&
              path.endsWith(".provenance.json"),
          )!;
      const provenance = json(provenancePath);
      expect(dataset.fields).toEqual(provenance.derivation.columns);
      expect(dataset.source.reference.sha256).toBe(receipt.sourceArtifactHash);
      expect(dataset.source.retrievedAt).toBe(
        receipt.retrievedAt ?? provenance.retrievedAt,
      );
      expect(dataset.source.source.publisher).toBe(provenance.provider);
      expect(dataset.source.source.originUrl).toBe(provenance.originUrl);
      expect(dataset.source.source.licence.label).toBe(
        provenance.licence.label,
      );
      expect(dataset.resolution).toBe("DAILY");
      expect(dataset.observations).toHaveLength(
        Number(receipt.rowCount ?? provenance.rowCount),
      );
      expect(dataset.instrumentFamily).toEqual(
        receipt.declaration?.filter ?? {
          kind: "market",
          value: provenance.request.mrktCls,
        },
      );
    }
    const stock = publishedCoverageManifest.datasets.find(
      (dataset) => dataset.acquisitionScope === "bounded-window",
    )!;
    expect(stock.observations).toHaveLength(40);
    expect(stock.dateWindow).toEqual({
      start: "2026-09-03",
      endInclusive: "2026-09-03",
    });
    const baseline = publishedCoverageManifest.datasets.find(
      (dataset) => dataset.instrumentFamily.kind === "index",
    )!;
    expect(baseline.dateWindow).toEqual({
      start: "2026-07-01",
      endInclusive: "2026-09-03",
    });
    expect(publishedCoverageManifest.asOf).toBe("2026-09-06T16:01:57.018Z");
  });

  it("fails closed on stale asOf, duplicate source identities or observations outside the window", () => {
    const stale = structuredClone(publishedCoverageManifest);
    stale.asOf = "2026-09-01T00:00:00Z";
    expect(CoverageManifestSchema.safeParse(stale).success).toBe(false);
    const duplicate = structuredClone(publishedCoverageManifest);
    duplicate.datasets.push(duplicate.datasets[0]!);
    expect(CoverageManifestSchema.safeParse(duplicate).success).toBe(false);
    const outside = structuredClone(publishedCoverageManifest);
    outside.datasets[0]!.observations[0]!.date = "2020-01-01";
    expect(CoverageManifestSchema.safeParse(outside).success).toBe(false);
    const conflicting = structuredClone(publishedCoverageManifest);
    conflicting.datasets[0]!.observations.push(
      conflicting.datasets[0]!.observations[0]!,
    );
    expect(CoverageManifestSchema.safeParse(conflicting).success).toBe(false);
  });
});
