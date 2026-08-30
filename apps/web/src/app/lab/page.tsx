import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import {
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
} from "@weavetrail/scenarios";

import { Lab } from "./lab";

export default async function LabPage() {
  const provider = new FixtureSchemaMappingProvider();
  const mappings = [
    concentratedBuyDialectAMapping,
    concentratedBuyDialectBMapping,
  ] as const;
  const proposals = Object.fromEntries(
    await Promise.all(
      mappings.map(async (mapping) => [
        mapping.sourceArtifactHash,
        await provider.propose({
          sourceArtifactHash: mapping.sourceArtifactHash,
          columns: mapping.fields.map(([sourceColumn]) => sourceColumn),
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
      <Lab proposals={proposals} providerMode={provider.mode} />
    </main>
  );
}
