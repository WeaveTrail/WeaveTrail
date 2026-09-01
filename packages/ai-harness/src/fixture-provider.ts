import {
  SchemaMappingProposalSchema,
  type AllowedTransform,
  type SchemaMappingProposal,
} from "@weavetrail/contracts";
import {
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
} from "@weavetrail/scenarios";

import type { MappingInput, SchemaMappingProvider } from "./provider";

type DeclaredField = {
  targetField: string | null;
  transform: AllowedTransform | null;
};

function declaredFields(
  fields: readonly {
    sourceColumn: string;
    targetField: string | null;
    transform: AllowedTransform | null;
  }[],
): ReadonlyMap<string, DeclaredField> {
  return new Map(
    fields.map(({ sourceColumn, targetField, transform }) => [
      sourceColumn,
      { targetField, transform },
    ]),
  );
}

export const fixtureMappingsByArtifact = new Map<
  string,
  ReadonlyMap<string, DeclaredField>
>([
  [
    concentratedBuyDialectAProposal.sourceArtifactHash,
    declaredFields(concentratedBuyDialectAProposal.fields),
  ],
  [
    concentratedBuyDialectBProposal.sourceArtifactHash,
    declaredFields(concentratedBuyDialectBProposal.fields),
  ],
]);

export class FixtureSchemaMappingProvider implements SchemaMappingProvider {
  readonly mode = "fixture" as const;

  async propose(input: MappingInput): Promise<SchemaMappingProposal> {
    const artifactMapping = fixtureMappingsByArtifact.get(
      input.sourceArtifactHash,
    );
    return SchemaMappingProposalSchema.parse({
      mappingVersion: "1.2",
      sourceArtifactHash: input.sourceArtifactHash,
      constants: input.constants,
      fields: input.columns.map((sourceColumn) => {
        const declared = artifactMapping?.get(sourceColumn);
        return {
          sourceColumn,
          targetField: declared?.targetField ?? null,
          transform: declared?.transform ?? null,
          confidence: declared === undefined ? 0 : 1,
          evidence: declared
            ? "Matched by the versioned per-artifact fixture mapping table."
            : "The deterministic fixture has no declared mapping for this artifact and column.",
          status: declared === undefined ? "REVIEW_REQUIRED" : "PROPOSED",
        };
      }),
    });
  }
}
