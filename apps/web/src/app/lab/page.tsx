import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import { committedReplayScenarios } from "@weavetrail/scenarios";

import { Lab } from "./lab";

export default async function LabPage() {
  const provider = new FixtureSchemaMappingProvider();
  const scenarios = Object.entries(committedReplayScenarios).map(
    ([value, scenario]) => ({
      value: value as keyof typeof committedReplayScenarios,
      label: scenario.label,
      sourceArtifactHash: scenario.sourceArtifactHash,
      columns: [...scenario.columns],
    }),
  );
  const proposals = Object.fromEntries(
    await Promise.all(
      scenarios.map(async (scenario) => [
        scenario.sourceArtifactHash,
        await provider.propose({
          sourceArtifactHash: scenario.sourceArtifactHash,
          columns: scenario.columns,
          sampleRows: [],
        }),
      ]),
    ),
  );

  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">Guided replay lab</span>
        <h1>Inspect the deterministic foundation.</h1>
        <p>
          Run one synthetic fixture as-is, shuffled, or with an exact duplicate.
          The canonical event order and result hash should remain identical.
        </p>
      </div>
      <Lab
        proposals={proposals}
        providerMode={provider.mode}
        scenarios={scenarios.map(({ value, label, sourceArtifactHash }) => ({
          value,
          label,
          sourceArtifactHash,
        }))}
      />
    </main>
  );
}
