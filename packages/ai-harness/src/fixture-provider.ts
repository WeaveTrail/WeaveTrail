import type { SchemaMappingProposal } from "@weavetrail/contracts";

import type { MappingInput, SchemaMappingProvider } from "./provider";

const knownTargets: Record<string, string> = {
  event_id: "sourceEventId",
  timestamp: "eventTime",
  symbol: "instrumentId",
  direction: "side",
  account: "actorId",
  px: "price",
  qty: "quantity",
};

export class FixtureSchemaMappingProvider implements SchemaMappingProvider {
  readonly mode = "fixture" as const;

  async propose(input: MappingInput): Promise<SchemaMappingProposal> {
    return {
      mappingVersion: "1.0",
      datasetHash: input.datasetHash,
      fields: input.columns.map((sourceColumn) => {
        const targetField = knownTargets[sourceColumn] ?? null;
        return {
          sourceColumn,
          targetField,
          transform: "IDENTITY" as const,
          confidence: targetField === null ? 0 : 1,
          evidence:
            targetField === null
              ? "The deterministic fixture has no declared mapping for this column."
              : "Matched by the versioned fixture mapping table.",
          status:
            targetField === null
              ? ("REVIEW_REQUIRED" as const)
              : ("PROPOSED" as const),
        };
      }),
    };
  }
}
