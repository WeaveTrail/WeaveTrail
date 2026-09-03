import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import { committedReplayScenarios } from "@weavetrail/scenarios";

import { Lab } from "./lab";

export default async function LabPage() {
  const provider = new FixtureSchemaMappingProvider();
  const preparedScenarios = await Promise.all(
    Object.entries(committedReplayScenarios).map(async ([value, scenario]) => ({
      scenario: {
        value: value as keyof typeof committedReplayScenarios,
        label: scenario.label,
        sourceArtifactHash: scenario.sourceArtifactHash,
        rows: scenario.rows,
        ...(value.startsWith("rapid-price-lift-") && "manifest" in scenario
          ? (() => {
              const { approval: _, ...manifest } = scenario.manifest;
              void _;
              return { manifest };
            })()
          : {}),
      },
      proposal: await provider.propose({
        sourceArtifactHash: scenario.sourceArtifactHash,
        constants: scenario.constants,
        columns: [...scenario.columns],
        sampleRows: [],
      }),
    })),
  );
  const { proposals, scenarios } = preparedScenarios.reduce(
    (result, { proposal, scenario }) => {
      result.scenarios.push(scenario);
      result.proposals[scenario.sourceArtifactHash] = proposal;
      return result;
    },
    {
      proposals: {} as Record<
        string,
        (typeof preparedScenarios)[number]["proposal"]
      >,
      scenarios: [] as Array<(typeof preparedScenarios)[number]["scenario"]>,
    },
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
        scenarios={scenarios}
      />
    </main>
  );
}
