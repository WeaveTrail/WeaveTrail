import {
  CoverageManifestSchema,
  CoverageDatasetSchema,
} from "@weavetrail/contracts";
import stockReceipt from "./sources/real/fsc-stock-quotes-20260903.acquisition.json";
import stockProvenance from "./sources/real/fsc-stock-quotes-20260903.provenance.json";
import indexReceipt from "./sources/real/fsc-kospi-index-family-20260903/acquisition.json";
import baselineReceipt from "./sources/real/fsc-kospi-200-baseline-20260701-20260903/acquisition.json";
import futuresReceipt from "./sources/real/fsc-kospi-200-futures-20260903/acquisition.json";
import optionsReceipt from "./sources/real/fsc-weekly-options-20260903/acquisition.json";
import { publishedReplaySources } from "./real-market-data";
import { publishedInstrumentListing } from "./instrument-listing";

const receipts = [
  {
    path: "real/fsc-kospi-index-family-20260903/acquisition.json",
    record: indexReceipt,
  },
  {
    path: "real/fsc-kospi-200-baseline-20260701-20260903/acquisition.json",
    record: baselineReceipt,
  },
  {
    path: "real/fsc-kospi-200-futures-20260903/acquisition.json",
    record: futuresReceipt,
  },
  {
    path: "real/fsc-weekly-options-20260903/acquisition.json",
    record: optionsReceipt,
  },
];

function date(value: string) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

/** Date arithmetic only; prices and other source values are never transformed. */
function previousDate(value: string) {
  const day = new Date(`${date(value)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

const datasets = Object.entries(publishedReplaySources)
  .map(([artifactId, artifact]) => {
    const source = publishedInstrumentListing.sources.find(
      ({ sourceId }) => sourceId === artifact.constants.datasetId,
    );
    if (
      !source ||
      source.reference.kind !== "committed" ||
      source.reference.artifactId !== artifactId
    )
      throw new Error("Missing committed coverage source");
    const receipt = receipts.find(
      ({ record }) => record.sourceArtifactHash === artifact.sourceArtifactHash,
    );
    const bounded =
      stockReceipt.sourceArtifactHash === artifact.sourceArtifactHash;
    if (!receipt && !bounded)
      throw new Error("Missing coverage acquisition receipt");
    const declaration = receipt?.record.declaration;
    const declaredDate = declaration?.date ?? stockProvenance.basDt;
    const dateWindow =
      typeof declaredDate === "string"
        ? { start: date(declaredDate), endInclusive: date(declaredDate) }
        : {
            start: date(declaredDate.begin),
            endInclusive: previousDate(declaredDate.endExclusive),
          };
    if (
      receipt &&
      receipt.record.retrievedAt !== artifact.provenance.retrievedAt
    )
      throw new Error("Coverage retrieval disagrees with acquisition receipt");
    if (source.reference.sha256 !== artifact.sourceArtifactHash)
      throw new Error("Coverage artifact pin mismatch");
    if (
      !("eventType" in artifact.constants) ||
      artifact.constants.eventType !== "DAILY_QUOTE"
    )
      throw new Error("Coverage derivation does not support this resolution");
    return CoverageDatasetSchema.parse({
      datasetId: artifact.constants.datasetId,
      acquisitionRecord:
        receipt?.path ?? "real/fsc-stock-quotes-20260903.acquisition.json",
      acquisitionScope: declaration?.scope ?? stockReceipt.scope,
      instrumentFamily: declaration?.filter ?? {
        kind: "market",
        value: stockProvenance.request.mrktCls,
      },
      fields: [...artifact.columns],
      dateWindow,
      resolution: "DAILY",
      source,
      observations: artifact.rows.map((row) => {
        const values: Record<string, string> = row.values;
        return {
          instrumentId: (values.isinCd ?? values.idxNm)!,
          date: date(values.basDt!),
          rowNumber: row.coordinate.rowNumber,
        };
      }),
    });
  })
  .sort((a, b) =>
    a.datasetId < b.datasetId ? -1 : a.datasetId > b.datasetId ? 1 : 0,
  );

/** No wall clock, network, generated file or manually maintained date bounds. */
export const publishedCoverageManifest = CoverageManifestSchema.parse({
  schemaVersion: "1.0",
  derivationVersion: "published-coverage-v1",
  asOf: [...datasets.map((dataset) => dataset.source.retrievedAt)]
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .at(-1),
  datasets,
});
