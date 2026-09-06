import { SchemaMappingProposalSchema } from "@weavetrail/contracts";

const sourceArtifactHash =
  "b1eae0149d9903a25e30f66e630d441035b3356b191d54e7c30327fe1853f094";

const constants = {
  schemaVersion: "1.2" as const,
  datasetId: "synthetic-multi-instrument-quotes-v1",
  venueId: "SYNTH-QUOTES",
  eventType: "DAILY_QUOTE" as const,
};

const columns = ["id", "instrument", "date", "close", "volume"] as const;

export const actorlessMultiInstrumentMappingProposal =
  SchemaMappingProposalSchema.parse({
    mappingVersion: "1.5",
    sourceArtifactHash,
    constants,
    fields: [
      ["id", "sourceEventId", "IDENTITY", 1],
      ["instrument", "instrumentId", "IDENTITY", 1],
      ["date", "eventTime", "YYYYMMDD_TO_KST_DAY_START_ISO", 0],
      ["close", "price", "DECIMAL_STRING", 0],
      ["volume", "quantity", "DECIMAL_STRING", 0],
    ].map(([sourceColumn, targetField, transform, confidence]) => ({
      sourceColumn,
      targetField,
      transform,
      confidence,
      evidence:
        confidence === 1
          ? "Matched by the versioned synthetic fixture mapping table."
          : "The synthetic daily interpretation requires explicit review.",
      status: confidence === 1 ? "PROPOSED" : "REVIEW_REQUIRED",
    })),
  });

export const actorlessMultiInstrumentScenario = {
  label: "Actorless multi-instrument quotes · JSON Lines",
  sourceArtifactHash,
  constants,
  columns: [...columns],
  rows: [
    {
      coordinate: { sourceArtifactHash, rowNumber: "1" },
      values: {
        id: "quote-a",
        instrument: "WT-MARKET-A",
        date: "20260901",
        close: "100.00",
        volume: "1000",
      },
    },
    {
      coordinate: { sourceArtifactHash, rowNumber: "2" },
      values: {
        id: "quote-b",
        instrument: "WT-MARKET-B",
        date: "20260901",
        close: "200.00",
        volume: "2000",
      },
    },
  ],
  mappingProposal: actorlessMultiInstrumentMappingProposal,
};
