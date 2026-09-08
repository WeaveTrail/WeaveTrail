import {
  SchemaMappingProposalSchema,
  type SchemaMappingProposal,
} from "@weavetrail/contracts";
import rows from "./generated/fsc-stock-quotes-20260903-rows.json";
import provenance from "./sources/real/fsc-stock-quotes-20260903.provenance.json";
import indexRows from "./sources/real/fsc-kospi-index-family-20260903/rows.json";
import indexProvenance from "./sources/real/fsc-kospi-index-family-20260903/fsc-kospi-index-family-20260903.provenance.json";
import baselineRows from "./sources/real/fsc-kospi-200-baseline-20260701-20260903/rows.json";
import baselineProvenance from "./sources/real/fsc-kospi-200-baseline-20260701-20260903/fsc-kospi-200-baseline-20260701-20260903.provenance.json";
import futuresRows from "./sources/real/fsc-kospi-200-futures-20260903/rows.json";
import futuresProvenance from "./sources/real/fsc-kospi-200-futures-20260903/fsc-kospi-200-futures-20260903.provenance.json";
import optionsRows from "./sources/real/fsc-weekly-options-20260903/rows.json";
import optionsProvenance from "./sources/real/fsc-weekly-options-20260903/fsc-weekly-options-20260903.provenance.json";
import type { SourceProvenance } from "@weavetrail/contracts";

const RECORD_ROOT =
  "https://github.com/WeaveTrail/WeaveTrail/blob/develop/packages/published-data/src/sources/real";

export const fscStockQuotesProvenance = {
  ...provenance,
  kind: "real" as const,
  recordUrl: `${RECORD_ROOT}/fsc-stock-quotes-20260903.provenance.json`,
} satisfies SourceProvenance;

const fields: SchemaMappingProposal["fields"] = [
  {
    sourceColumn: "basDt",
    targetField: "eventTime",
    transform: "YYYYMMDD_TO_KST_DAY_START_ISO",
    confidence: 0,
    status: "REVIEW_REQUIRED",
    evidence:
      "The publisher supplies a trading date, not execution time. Approve a Korean day-start anchor at 00:00:00+09:00; the offset is a declared interpretation.",
  },
  {
    sourceColumn: "srtnCd",
    targetField: "sourceEventId",
    transform: "IDENTITY",
    confidence: 1,
    status: "PROPOSED",
    evidence:
      "Publisher issue key; all 40 srtnCd values are nonempty and unique within this single-date artifact. This is not an execution identifier.",
  },
  {
    sourceColumn: "isinCd",
    targetField: "instrumentId",
    transform: "IDENTITY",
    confidence: 1,
    status: "PROPOSED",
    evidence:
      "Publisher instrument identifier; all 40 isinCd values are nonempty and unique in the accepted response.",
  },
  {
    sourceColumn: "itmsNm",
    targetField: null,
    transform: null,
    confidence: 1,
    status: "PROPOSED",
    evidence:
      "Publisher instrument name retained in source; canonical instrument identity uses isinCd and has no name field.",
  },
  {
    sourceColumn: "mrktCtg",
    targetField: null,
    transform: null,
    confidence: 1,
    status: "PROPOSED",
    evidence:
      "All returned market categories are KOSPI under the documented mrktCls=KOSPI request. The KRX-KOSPI venue is declared artifact metadata; the original market string remains in source.",
  },
  {
    sourceColumn: "clpr",
    targetField: "price",
    transform: "DECIMAL_STRING",
    confidence: 0,
    status: "REVIEW_REQUIRED",
    evidence:
      "Publisher daily closing price, not a specified execution price. Approve its daily-quote interpretation and canonical decimal spelling.",
  },
  {
    sourceColumn: "vs",
    targetField: null,
    transform: null,
    confidence: 1,
    status: "PROPOSED",
    evidence:
      "Publisher change from previous close; no canonical daily-change field. Preserve the original value.",
  },
  {
    sourceColumn: "fltRt",
    targetField: null,
    transform: null,
    confidence: 1,
    status: "PROPOSED",
    evidence:
      "Publisher daily percentage change, not a rule threshold or execution price. Preserve its original decimal spelling without canonical mapping.",
  },
  {
    sourceColumn: "mkp",
    targetField: null,
    transform: null,
    confidence: 1,
    status: "PROPOSED",
    evidence:
      "Publisher daily opening price; the approved price target is the closing price. Retain the opening price in source.",
  },
  {
    sourceColumn: "hipr",
    targetField: null,
    transform: null,
    confidence: 1,
    status: "PROPOSED",
    evidence:
      "Publisher daily high, with no observed execution time; preserve in source instead of creating an execution or another price target.",
  },
  {
    sourceColumn: "lopr",
    targetField: null,
    transform: null,
    confidence: 1,
    status: "PROPOSED",
    evidence:
      "Publisher daily low, with no observed execution time; preserve in source instead of creating an execution or another price target.",
  },
  {
    sourceColumn: "trqu",
    targetField: "quantity",
    transform: "DECIMAL_STRING",
    confidence: 0,
    status: "REVIEW_REQUIRED",
    evidence:
      "Publisher daily aggregate volume, not an individual execution size. Approve its daily-quote interpretation; closing price times aggregate volume is not asserted to be traded value.",
  },
  {
    sourceColumn: "trPrc",
    targetField: null,
    transform: null,
    confidence: 1,
    status: "PROPOSED",
    evidence:
      "Publisher aggregate traded value is a sum of execution notionals. No canonical aggregate-value field; preserve without recalculating from closing price and volume.",
  },
  {
    sourceColumn: "lstgStCnt",
    targetField: null,
    transform: null,
    confidence: 1,
    status: "PROPOSED",
    evidence:
      "Publisher listed share count is not traded quantity; retain as an unmapped source column.",
  },
  {
    sourceColumn: "mrktTotAmt",
    targetField: null,
    transform: null,
    confidence: 1,
    status: "PROPOSED",
    evidence:
      "Publisher market capitalization is not execution value; retain as an unmapped source column.",
  },
];

export const fscStockQuotesProposal = SchemaMappingProposalSchema.parse({
  mappingVersion: "1.5",
  sourceArtifactHash: provenance.artifacts.runtimeJsonl.sha256,
  constants: {
    schemaVersion: "1.2",
    datasetId: "fsc-stock-quotes-20260903-v1",
    venueId: provenance.venue.value,
    eventType: "DAILY_QUOTE",
  },
  fields,
});

const dailyField = (
  sourceColumn: string,
  targetField:
    | "eventTime"
    | "sourceEventId"
    | "instrumentId"
    | "price"
    | "quantity"
    | "openPrice"
    | "highPrice"
    | "lowPrice"
    | "closePrice"
    | "netChange"
    | null,
  evidence: string,
) => ({
  sourceColumn,
  targetField,
  transform:
    targetField === null
      ? null
      : targetField === "eventTime"
        ? ("YYYYMMDD_TO_KST_DAY_START_ISO" as const)
        : targetField === "price" ||
            targetField === "quantity" ||
            targetField === "openPrice" ||
            targetField === "highPrice" ||
            targetField === "lowPrice" ||
            targetField === "closePrice" ||
            targetField === "netChange"
          ? targetField === "price" || targetField === "quantity"
            ? ("DECIMAL_STRING" as const)
            : ("PUBLISHER_DECIMAL_STRING" as const)
          : ("IDENTITY" as const),
  confidence:
    targetField === "eventTime" ||
    targetField === "price" ||
    targetField === "quantity" ||
    targetField === "openPrice" ||
    targetField === "highPrice" ||
    targetField === "lowPrice" ||
    targetField === "closePrice" ||
    targetField === "netChange"
      ? 0
      : 1,
  status:
    targetField === "eventTime" ||
    targetField === "price" ||
    targetField === "quantity" ||
    targetField === "openPrice" ||
    targetField === "highPrice" ||
    targetField === "lowPrice" ||
    targetField === "closePrice" ||
    targetField === "netChange"
      ? ("REVIEW_REQUIRED" as const)
      : ("PROPOSED" as const),
  evidence,
});

const indexColumns = indexProvenance.derivation.columns;
const indexFields = (mapOhlc: boolean) =>
  indexColumns.map((column) => {
    const target =
      column === "basDt"
        ? "eventTime"
        : column === "idxNm"
          ? "instrumentId"
          : column === "mkp" && mapOhlc
            ? "openPrice"
            : column === "hipr" && mapOhlc
              ? "highPrice"
              : column === "lopr" && mapOhlc
                ? "lowPrice"
                : column === "clpr"
                  ? mapOhlc
                    ? "closePrice"
                    : "price"
                  : column === "vs" && mapOhlc
                    ? "netChange"
                    : column === "trqu"
                      ? "quantity"
                      : null;
    return dailyField(
      column,
      target,
      target === null
        ? `Publisher column ${column} is retained verbatim but has no canonical daily-quote target; admission is deferred until a versioned consumer requires it.`
        : column === "basDt"
          ? "Publisher trading date is interpreted as Korean day start and also participates in the ordered publisher observation identity."
          : column === "idxNm"
            ? "Publisher index name is the instrument identity and also participates in the ordered publisher observation identity."
            : `Publisher ${column} is interpreted as the daily aggregate ${target}.`,
    );
  });

function indexProposal(
  artifactHash: string,
  datasetId: string,
  venueId: string,
  mapOhlc: boolean,
) {
  return SchemaMappingProposalSchema.parse({
    mappingVersion: mapOhlc ? "1.7" : "1.6",
    sourceArtifactHash: artifactHash,
    constants: {
      schemaVersion: mapOhlc ? "1.3" : "1.2",
      datasetId,
      venueId,
      eventType: "DAILY_QUOTE",
    },
    compositeSourceEventId: {
      sourceColumns: ["basDt", "idxNm"],
      transform: "NUL_JOIN",
      confidence: 1,
      status: "PROPOSED",
      evidence:
        "The publisher natural key is the ordered pair (basDt, idxNm). NUL cannot occur in admitted values and makes the join injective without modifying source rows.",
    },
    fields: indexFields(mapOhlc),
  });
}

const derivativeFields = (columns: readonly string[], mapOhlc: boolean) =>
  columns.map((column) => {
    const target =
      column === "basDt"
        ? "eventTime"
        : column === "srtnCd"
          ? "sourceEventId"
          : column === "isinCd"
            ? "instrumentId"
            : column === "mkp" && mapOhlc
              ? "openPrice"
              : column === "hipr" && mapOhlc
                ? "highPrice"
                : column === "lopr" && mapOhlc
                  ? "lowPrice"
                  : column === "clpr" && mapOhlc
                    ? "closePrice"
                    : column === "vs" && mapOhlc
                      ? "netChange"
                      : column === "trqu"
                        ? "quantity"
                        : null;
    return dailyField(
      column,
      target,
      target === null
        ? `Publisher column ${column} is retained verbatim but has no canonical daily-quote target; admission is deferred until a versioned consumer requires it.`
        : column === "basDt"
          ? "Publisher trading date is interpreted as Korean day start."
          : column === "srtnCd"
            ? "Publisher short code uniquely identifies the returned derivative series on this trading date."
            : column === "isinCd"
              ? "Publisher ISIN is the canonical instrument identity."
              : `Publisher ${column} is interpreted as the daily aggregate ${target}.`,
    );
  });

function derivativeProposal(
  artifactHash: string,
  datasetId: string,
  venueId: string,
  fields: ReturnType<typeof derivativeFields>,
) {
  const ohlc = fields.some(({ targetField }) => targetField === "openPrice");
  return SchemaMappingProposalSchema.parse({
    mappingVersion: ohlc ? "1.7" : "1.5",
    sourceArtifactHash: artifactHash,
    constants: {
      schemaVersion: ohlc ? "1.3" : "1.2",
      datasetId,
      venueId,
      eventType: "DAILY_QUOTE",
    },
    fields,
  });
}

export const fscKospiIndexFamilyProposal = indexProposal(
  indexProvenance.artifacts.runtimeJsonl.sha256,
  "fsc-kospi-index-family-20260903-v1",
  indexProvenance.venue.value,
  false,
);
export const fscKospi200BaselineProposal = indexProposal(
  baselineProvenance.artifacts.runtimeJsonl.sha256,
  "fsc-kospi-200-baseline-20260701-20260903-v1",
  baselineProvenance.venue.value,
  true,
);
export const fscKospi200FuturesProposal = derivativeProposal(
  futuresProvenance.artifacts.runtimeJsonl.sha256,
  "fsc-kospi-200-futures-20260903-v1",
  futuresProvenance.venue.value,
  derivativeFields(futuresProvenance.derivation.columns, true),
);
export const fscWeeklyOptionsProposal = derivativeProposal(
  optionsProvenance.artifacts.runtimeJsonl.sha256,
  "fsc-weekly-options-20260903-v1",
  optionsProvenance.venue.value,
  derivativeFields(optionsProvenance.derivation.columns, false),
);

export const publishedReplaySources = {
  "real/fsc-stock-quotes-20260903.jsonl": {
    label: "FSC · KOSPI daily quotes · 2026-09-03",
    sourceArtifactHash: fscStockQuotesProposal.sourceArtifactHash,
    constants: fscStockQuotesProposal.constants,
    columns: fields.map(({ sourceColumn }) => sourceColumn),
    rows,
    mappingProposal: fscStockQuotesProposal,
    provenance: fscStockQuotesProvenance,
  },
  "real/fsc-kospi-index-family-20260903/source.jsonl": {
    label: "FSC · KOSPI index family · 2026-09-03",
    sourceArtifactHash: fscKospiIndexFamilyProposal.sourceArtifactHash,
    constants: fscKospiIndexFamilyProposal.constants,
    columns: indexColumns,
    rows: indexRows,
    mappingProposal: fscKospiIndexFamilyProposal,
    provenance: {
      ...indexProvenance,
      kind: "real" as const,
      recordUrl: `${RECORD_ROOT}/fsc-kospi-index-family-20260903/fsc-kospi-index-family-20260903.provenance.json`,
    },
  },
  "real/fsc-kospi-200-baseline-20260701-20260903/source.jsonl": {
    label: "FSC · KOSPI 200 baseline · 2026-07-01–2026-09-03",
    sourceArtifactHash: fscKospi200BaselineProposal.sourceArtifactHash,
    constants: fscKospi200BaselineProposal.constants,
    columns: indexColumns,
    rows: baselineRows,
    mappingProposal: fscKospi200BaselineProposal,
    provenance: {
      ...baselineProvenance,
      kind: "real" as const,
      recordUrl: `${RECORD_ROOT}/fsc-kospi-200-baseline-20260701-20260903/fsc-kospi-200-baseline-20260701-20260903.provenance.json`,
    },
  },
  "real/fsc-kospi-200-futures-20260903/source.jsonl": {
    label: "FSC · KOSPI 200 futures · 2026-09-03",
    sourceArtifactHash: fscKospi200FuturesProposal.sourceArtifactHash,
    constants: fscKospi200FuturesProposal.constants,
    columns: futuresProvenance.derivation.columns,
    rows: futuresRows,
    mappingProposal: fscKospi200FuturesProposal,
    provenance: {
      ...futuresProvenance,
      kind: "real" as const,
      recordUrl: `${RECORD_ROOT}/fsc-kospi-200-futures-20260903/fsc-kospi-200-futures-20260903.provenance.json`,
    },
  },
  "real/fsc-weekly-options-20260903/source.jsonl": {
    label: "FSC · weekly options · 2026-09-03",
    sourceArtifactHash: fscWeeklyOptionsProposal.sourceArtifactHash,
    constants: fscWeeklyOptionsProposal.constants,
    columns: optionsProvenance.derivation.columns,
    rows: optionsRows,
    mappingProposal: fscWeeklyOptionsProposal,
    provenance: {
      ...optionsProvenance,
      kind: "real" as const,
      recordUrl: `${RECORD_ROOT}/fsc-weekly-options-20260903/fsc-weekly-options-20260903.provenance.json`,
    },
  },
} as const;
