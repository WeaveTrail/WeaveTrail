import { CoverageManifestSchema } from "@weavetrail/contracts";

// Entirely synthetic scope metadata; no quote values or admitted publisher data.
export const syntheticCoverageManifest = CoverageManifestSchema.parse({
  schemaVersion: "1.0",
  derivationVersion: "published-coverage-v1",
  asOf: "2024-03-01T00:00:00Z",
  datasets: [
    {
      datasetId: "synthetic-quotes-v1",
      acquisitionRecord: "synthetic/acquisition.json",
      acquisitionScope: "complete-series",
      instrumentFamily: { kind: "index", value: "SYNTH-INDEX" },
      fields: ["close"],
      dateWindow: { start: "2024-02-28", endInclusive: "2024-02-29" },
      resolution: "DAILY",
      source: {
        sourceId: "synthetic-quotes-v1",
        reference: {
          kind: "committed",
          artifactId: "synthetic/quotes.jsonl",
          sha256: "a".repeat(64),
          originalBytes: [{ path: "synthetic.json", sha256: "a".repeat(64) }],
        },
        provenanceRecordUrl: "https://example.invalid/synthetic/provenance",
        retrievedAt: "2024-03-01T00:00:00Z",
        source: {
          originUrl: "https://example.invalid/synthetic/quotes",
          publisher: "Synthetic test fixture",
          collectorVersion: "synthetic-fixture-v1",
          licence: {
            label: "Synthetic fixture",
            termsUrl: "https://example.invalid/synthetic/terms",
            checkedAt: "2024-02-01T00:00:00Z",
            attributionRequirements: "Label synthetic",
            attribution: "Synthetic test fixture",
            permitsStorage: true,
            permitsModification: true,
            permitsRedistribution: true,
          },
        },
      },
      observations: [
        { instrumentId: "SYNTH-INDEX", date: "2024-02-28", rowNumber: "1" },
        { instrumentId: "SYNTH-INDEX", date: "2024-02-29", rowNumber: "2" },
      ],
    },
  ],
});
