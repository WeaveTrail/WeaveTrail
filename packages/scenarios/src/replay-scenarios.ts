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

export const committedReplayScenarios = {
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
  ...rapidPriceLiftScenarios,
} as const;
