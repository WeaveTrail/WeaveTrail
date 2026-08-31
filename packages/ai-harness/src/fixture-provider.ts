import {
  SchemaMappingProposalSchema,
  type AllowedTransform,
  type SchemaMappingProposal,
} from "@weavetrail/contracts";
import {
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
} from "@weavetrail/scenarios";

import type { MappingInput, SchemaMappingProvider } from "./provider";

type DeclaredField = {
  targetField: string;
  transform: AllowedTransform;
};

function declaredFields(
  fields: readonly (readonly [
    string,
    string | null,
    AllowedTransform | null,
  ])[],
): ReadonlyMap<string, DeclaredField> {
  return new Map(
    fields.flatMap(([sourceColumn, targetField, transform]) =>
      targetField === null || transform === null
        ? []
        : [[sourceColumn, { targetField, transform }] as const],
    ),
  );
}

export const fixtureMappingsByArtifact = new Map<
  string,
  ReadonlyMap<string, DeclaredField>
>([
  [
    concentratedBuyDialectAMapping.sourceArtifactHash,
    declaredFields(concentratedBuyDialectAMapping.fields),
  ],
  [
    concentratedBuyDialectBMapping.sourceArtifactHash,
    declaredFields(concentratedBuyDialectBMapping.fields),
  ],
]);

export class FixtureSchemaMappingProvider implements SchemaMappingProvider {
  readonly mode = "fixture" as const;

  async propose(input: MappingInput): Promise<SchemaMappingProposal> {
    const artifactMapping = fixtureMappingsByArtifact.get(
      input.sourceArtifactHash,
    );
    return SchemaMappingProposalSchema.parse({
      mappingVersion: "1.1",
      sourceArtifactHash: input.sourceArtifactHash,
      fields: input.columns.map((sourceColumn) => {
        const declared = artifactMapping?.get(sourceColumn);
        return {
          sourceColumn,
          targetField: declared?.targetField ?? null,
          transform: declared?.transform,
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
