import {
  DailyQuoteBindingSchema,
  InstrumentListingSchema,
  ListingSourceSchema,
  type InstrumentIdentifier,
  type ListedInstrument,
} from "@weavetrail/contracts/instrument-resolution";
import stockProvenance from "./sources/real/fsc-stock-quotes-20260903.provenance.json";
import indexReceipt from "./sources/real/fsc-kospi-index-family-20260903/acquisition.json";
import baselineReceipt from "./sources/real/fsc-kospi-200-baseline-20260701-20260903/acquisition.json";
import futuresReceipt from "./sources/real/fsc-kospi-200-futures-20260903/acquisition.json";
import optionsReceipt from "./sources/real/fsc-weekly-options-20260903/acquisition.json";
import { publishedReplaySources } from "./real-market-data";

export const PUBLISHED_LISTING_VERSION = "fsc-admitted-quote-identifiers-v1";

const receipts = {
  "real/fsc-kospi-index-family-20260903/source.jsonl": indexReceipt,
  "real/fsc-kospi-200-baseline-20260701-20260903/source.jsonl": baselineReceipt,
  "real/fsc-kospi-200-futures-20260903/source.jsonl": futuresReceipt,
  "real/fsc-weekly-options-20260903/source.jsonl": optionsReceipt,
};

const instruments = new Map<string, ListedInstrument>();
const sources = [];
const quotes = [];

// A projection of the closed, already admitted catalog, not a new acquisition
// or evidence that today's publisher terms permit a future retrieval.
for (const [artifactId, artifact] of Object.entries(publishedReplaySources)) {
  const provenance = artifact.provenance;
  const originalBytes =
    artifactId === "real/fsc-stock-quotes-20260903.jsonl"
      ? [stockProvenance.artifacts.rawResponse]
      : receipts[artifactId as keyof typeof receipts].pages.map((page) => ({
          path: page.file,
          sha256: page.sha256,
        }));
  const source = ListingSourceSchema.parse({
    sourceId: artifact.constants.datasetId,
    reference: {
      kind: "committed",
      artifactId,
      sha256: artifact.sourceArtifactHash,
      originalBytes,
    },
    provenanceRecordUrl: provenance.recordUrl,
    source: {
      originUrl: provenance.originUrl,
      publisher: provenance.provider,
      licence: {
        ...provenance.licence,
        permitsStorage: true,
        permitsModification: true,
        permitsRedistribution: true,
      },
      collectorVersion: PUBLISHED_LISTING_VERSION,
    },
    retrievedAt: provenance.retrievedAt,
  });
  sources.push(source);
  const dates = new Map<string, Set<string>>();
  for (const row of artifact.rows) {
    const values: Record<string, string> = row.values;
    const rawDate = values.basDt!;
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const isIndex = "idxNm" in values;
    const instrumentId = isIndex ? values.idxNm! : values.isinCd!;
    const instrument = instruments.get(instrumentId) ?? {
      instrumentId,
      kind: isIndex ? "INDEX" : "INSTRUMENT",
      identifiers: [],
    };
    const add = (kind: InstrumentIdentifier["kind"], column: string) => {
      const value = values[column];
      if (!value) return;
      instrument.identifiers.push({
        kind,
        value,
        validFrom: date,
        validThrough: date,
        evidence: {
          sourceId: source.sourceId,
          rowNumber: row.coordinate.rowNumber,
          column,
        },
      });
    };
    add("KOREAN_NAME", isIndex ? "idxNm" : "itmsNm");
    add("SHORT_CODE", "srtnCd");
    add("ISIN", "isinCd");
    instruments.set(instrumentId, instrument);
    const available = dates.get(instrumentId) ?? new Set<string>();
    available.add(date);
    dates.set(instrumentId, available);
  }
  for (const [instrumentId, available] of dates) {
    quotes.push(
      DailyQuoteBindingSchema.parse({
        datasetId: artifact.constants.datasetId,
        instrumentId,
        source,
        availableDates: [...available].sort(),
      }),
    );
  }
}

/** Only publisher-observed dates and identifiers, with original-byte references.
 * No English translation, abbreviation, former name or validity interval is invented. */
export const publishedInstrumentListing = InstrumentListingSchema.parse({
  schemaVersion: "1.0",
  listingId: PUBLISHED_LISTING_VERSION,
  sources,
  instruments: [...instruments.values()],
});

export const publishedDailyQuoteBindings = quotes;
