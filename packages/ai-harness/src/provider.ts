import type { SchemaMappingProposal } from "@weavetrail/contracts";

export type MappingInput = {
  datasetHash: string;
  columns: string[];
  sampleRows: Array<Record<string, unknown>>;
};

export interface SchemaMappingProvider {
  readonly mode: "fixture" | "ai";
  propose(input: MappingInput): Promise<SchemaMappingProposal>;
}
