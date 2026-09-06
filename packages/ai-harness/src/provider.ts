import type { SchemaMappingProposal } from "@weavetrail/contracts";

export type MappingInput = {
  sourceArtifactHash: string;
  constants: SchemaMappingProposal["constants"];
  columns: string[];
  sampleRows: Array<Record<string, unknown>>;
};

export type ProviderTrace = {
  mode: "fixture" | "ai";
  model: string;
  promptVersion: string;
};

export interface SchemaMappingProvider {
  readonly mode: "fixture" | "ai";
  readonly trace: ProviderTrace;
  propose(input: MappingInput): Promise<SchemaMappingProposal>;
}
