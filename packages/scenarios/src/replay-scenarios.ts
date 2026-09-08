import { actorlessMultiInstrumentScenario } from "./actorless-multi-instrument";
import {
  concentratedBuyDialectARows,
  concentratedBuyDialectBRows,
} from "./source-rows";
import {
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
} from "./source-mappings";
import { rapidPriceLiftScenarios } from "./rapid-price-lift-scenarios";
import { publishedExecutionSchemaScenario } from "./published-execution-schema";
import { syntheticSourceProvenanceByArtifact } from "./source-provenance";

const syntheticScenarios = {
  "actorless-multi-instrument-quotes.jsonl": actorlessMultiInstrumentScenario,
  "concentrated-buy-dialect-a.csv": {
    label: "Dialect A · CSV",
    sourceArtifactHash: concentratedBuyDialectAMapping.sourceArtifactHash,
    constants: concentratedBuyDialectAProposal.constants,
    columns: concentratedBuyDialectAProposal.fields.map(
      ({ sourceColumn }) => sourceColumn,
    ),
    rows: concentratedBuyDialectARows,
  },
  "concentrated-buy-dialect-b.jsonl": {
    label: "Dialect B · JSON Lines",
    sourceArtifactHash: concentratedBuyDialectBMapping.sourceArtifactHash,
    constants: concentratedBuyDialectBProposal.constants,
    columns: concentratedBuyDialectBProposal.fields.map(
      ({ sourceColumn }) => sourceColumn,
    ),
    rows: concentratedBuyDialectBRows,
  },
  "published-execution-fix44.csv": publishedExecutionSchemaScenario.fix,
  "published-execution-h0stcnt0.jsonl":
    publishedExecutionSchemaScenario.h0stcnt0,
  ...rapidPriceLiftScenarios,
} as const;

export const committedReplayScenarios = Object.fromEntries(
  Object.entries(syntheticScenarios).map(([name, scenario]) => [
    name,
    {
      ...scenario,
      provenance:
        syntheticSourceProvenanceByArtifact[
          name as keyof typeof syntheticSourceProvenanceByArtifact
        ],
    },
  ]),
) as {
  [
    Name in keyof typeof syntheticScenarios
  ]: (typeof syntheticScenarios)[Name] & {
    provenance: (typeof syntheticSourceProvenanceByArtifact)[Name];
  };
};
