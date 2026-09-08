import type { SourceProvenance } from "@weavetrail/contracts";

import actorlessMultiInstrumentQuotes from "./sources/actorless-multi-instrument-quotes.provenance.json";
import concentratedBuyDialectA from "./sources/concentrated-buy-dialect-a.provenance.json";
import concentratedBuyDialectB from "./sources/concentrated-buy-dialect-b.provenance.json";
import publishedExecutionFix44 from "./sources/published-execution-fix44.provenance.json";
import publishedExecutionH0stcnt0 from "./sources/published-execution-h0stcnt0.provenance.json";
import rapidPriceLiftBroadParticipation from "./sources/rapid-price-lift-broad-participation.provenance.json";
import rapidPriceLiftInsufficientEvidence from "./sources/rapid-price-lift-insufficient-evidence.provenance.json";
import rapidPriceLiftSupported from "./sources/rapid-price-lift-supported.provenance.json";

const RECORD_ROOT =
  "https://github.com/WeaveTrail/WeaveTrail/blob/develop/packages/scenarios/src/sources";

function withRecordUrl<
  Record extends {
    provider: string;
    title: string;
    attribution: string;
  },
>(recordName: string, record: Record) {
  return {
    ...record,
    kind: "synthetic" as const,
    recordUrl: `${RECORD_ROOT}/${recordName}`,
  } satisfies SourceProvenance;
}

export const syntheticSourceProvenanceByArtifact = {
  "actorless-multi-instrument-quotes.jsonl": withRecordUrl(
    "actorless-multi-instrument-quotes.provenance.json",
    actorlessMultiInstrumentQuotes,
  ),
  "concentrated-buy-dialect-a.csv": withRecordUrl(
    "concentrated-buy-dialect-a.provenance.json",
    concentratedBuyDialectA,
  ),
  "concentrated-buy-dialect-b.jsonl": withRecordUrl(
    "concentrated-buy-dialect-b.provenance.json",
    concentratedBuyDialectB,
  ),
  "published-execution-fix44.csv": withRecordUrl(
    "published-execution-fix44.provenance.json",
    publishedExecutionFix44,
  ),
  "published-execution-h0stcnt0.jsonl": withRecordUrl(
    "published-execution-h0stcnt0.provenance.json",
    publishedExecutionH0stcnt0,
  ),
  "rapid-price-lift-broad-participation.csv": withRecordUrl(
    "rapid-price-lift-broad-participation.provenance.json",
    rapidPriceLiftBroadParticipation,
  ),
  "rapid-price-lift-insufficient-evidence.csv": withRecordUrl(
    "rapid-price-lift-insufficient-evidence.provenance.json",
    rapidPriceLiftInsufficientEvidence,
  ),
  "rapid-price-lift-supported.csv": withRecordUrl(
    "rapid-price-lift-supported.provenance.json",
    rapidPriceLiftSupported,
  ),
} as const satisfies Record<string, SourceProvenance>;
