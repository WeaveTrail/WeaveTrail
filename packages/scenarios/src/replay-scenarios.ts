import { concentratedBuyEvents } from "./concentrated-buy";
import {
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
} from "./source-mappings";

export const committedReplayScenarios = {
  "concentrated-buy-dialect-a.csv": {
    label: "Dialect A · CSV",
    sourceArtifactHash: concentratedBuyDialectAMapping.sourceArtifactHash,
    columns: concentratedBuyDialectAMapping.fields.map(
      ([sourceColumn]) => sourceColumn,
    ),
    events: concentratedBuyEvents,
  },
  "concentrated-buy-dialect-b.jsonl": {
    label: "Dialect B · JSON Lines",
    sourceArtifactHash: concentratedBuyDialectBMapping.sourceArtifactHash,
    columns: concentratedBuyDialectBMapping.fields.map(
      ([sourceColumn]) => sourceColumn,
    ),
  },
} as const;
