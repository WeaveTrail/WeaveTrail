import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import { committedReplayScenarios } from "@weavetrail/scenarios";
import type { SchemaMappingProposal } from "@weavetrail/contracts";
import type { ReplayScenarioOption } from "./case-replay";

// Both modes receive the same server-prepared artifacts, never fixture approvals.
export async function prepareReplayScenarios() {
  const provider = new FixtureSchemaMappingProvider();
  const prepared = await Promise.all(
    Object.entries(committedReplayScenarios).map(async ([value, source]) => {
      let manifest: ReplayScenarioOption["manifest"];
      if ("manifest" in source) {
        const { approval: _, ...proposal } = source.manifest;
        void _;
        manifest = proposal;
      }
      const scenario: ReplayScenarioOption = {
        value: value as ReplayScenarioOption["value"],
        label: source.label,
        provenance: source.provenance,
        sourceArtifactHash: source.sourceArtifactHash,
        rows: source.rows,
        ...(manifest ? { manifest } : {}),
      };
      const proposal = await provider.propose({
        sourceArtifactHash: source.sourceArtifactHash,
        constants: source.constants,
        columns: [...source.columns],
        sampleRows: [],
      });
      return { scenario, proposal };
    }),
  );
  const proposals: Record<string, SchemaMappingProposal> = Object.fromEntries(
    prepared.map(({ scenario, proposal }) => [
      scenario.sourceArtifactHash,
      proposal,
    ]),
  );
  return {
    scenarios: prepared.map(({ scenario }) => scenario),
    proposals,
    providerMode: provider.mode,
  };
}
