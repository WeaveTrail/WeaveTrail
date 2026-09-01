import type { SchemaMappingProposal } from "@weavetrail/contracts";

export type MappingInput = {
  sourceArtifactHash: string;
  constants: { schemaVersion: "1.0"; datasetId: string; venueId: string };
  columns: string[];
  sampleRows: Array<Record<string, unknown>>;
};

export interface SchemaMappingProvider {
  readonly mode: "fixture" | "ai";
  propose(input: MappingInput): Promise<SchemaMappingProposal>;
}
