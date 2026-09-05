import {
  SchemaMappingProposalSchema,
  type SchemaMappingProposal,
} from "@weavetrail/contracts";
import rows from "./generated/fsc-stock-quotes-20260903-rows.json";
import provenance from "./sources/real/fsc-stock-quotes-20260903.provenance.json";
import type { SourceProvenance } from "./source-provenance";

export const fscStockQuotesProvenance = {
  ...provenance,
  kind: "real" as const,
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

export const realMarketDataScenarios = {
  "real/fsc-stock-quotes-20260903.jsonl": {
    label: "FSC · KOSPI daily quotes · 2026-09-03",
    sourceArtifactHash: fscStockQuotesProposal.sourceArtifactHash,
    constants: fscStockQuotesProposal.constants,
    columns: fields.map(({ sourceColumn }) => sourceColumn),
    rows,
    mappingProposal: fscStockQuotesProposal,
    provenance: fscStockQuotesProvenance,
  },
} as const;
