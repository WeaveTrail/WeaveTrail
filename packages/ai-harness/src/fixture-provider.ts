import {
  SchemaMappingProposalSchema,
  type AllowedTransform,
  type SchemaMappingProposal,
} from "@weavetrail/contracts";
import {
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
  rapidPriceLiftScenarios,
  fscStockQuotesProposal,
} from "@weavetrail/scenarios";

import type { MappingInput, SchemaMappingProvider } from "./provider";

type DeclaredField = {
  targetField: string | null;
  transform: AllowedTransform | null;
  confidence: number;
  evidence: string;
  status: "PROPOSED" | "REVIEW_REQUIRED";
};

function declaredFields(
  fields: readonly {
    sourceColumn: string;
    targetField: string | null;
    transform: AllowedTransform | null;
    confidence: number;
    evidence: string;
    status: "PROPOSED" | "REVIEW_REQUIRED";
  }[],
): ReadonlyMap<string, DeclaredField> {
  return new Map(
    fields.map(
      ({
        sourceColumn,
        targetField,
        transform,
        confidence,
        evidence,
        status,
      }) => [
        sourceColumn,
        { targetField, transform, confidence, evidence, status },
      ],
    ),
  );
}

const registeredProposals = [
  fscStockQuotesProposal,
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
  ...Object.values(rapidPriceLiftScenarios).map(
    ({ mappingProposal }) => mappingProposal,
  ),
];

export const fixtureMappingsByArtifact = new Map(
  registeredProposals.map(
    (proposal) =>
      [
        proposal.sourceArtifactHash,
        {
          mappingVersion: proposal.mappingVersion,
          constants: proposal.constants,
          fields: declaredFields(proposal.fields),
        },
      ] as const,
  ),
);

export class FixtureSchemaMappingProvider implements SchemaMappingProvider {
  readonly mode = "fixture" as const;

  async propose(input: MappingInput): Promise<SchemaMappingProposal> {
    const artifactMapping = fixtureMappingsByArtifact.get(
      input.sourceArtifactHash,
    );
    if (
      input.constants.schemaVersion === "1.2" ||
      artifactMapping?.mappingVersion === "1.5"
    ) {
      if (
        artifactMapping?.mappingVersion !== "1.5" ||
        input.constants.schemaVersion !== "1.2" ||
        artifactMapping.constants.schemaVersion !== "1.2" ||
        input.constants.datasetId !== artifactMapping.constants.datasetId ||
        input.constants.venueId !== artifactMapping.constants.venueId ||
        input.constants.eventType !== artifactMapping.constants.eventType
      ) {
        throw new Error(
          "Daily quote constants must match a registered fixture artifact",
        );
      }
    }
    return SchemaMappingProposalSchema.parse({
      mappingVersion: artifactMapping?.mappingVersion ?? "1.4",
      sourceArtifactHash: input.sourceArtifactHash,
      constants: input.constants,
      fields: input.columns.map((sourceColumn) => {
        const declared = artifactMapping?.fields.get(sourceColumn);
        return {
          sourceColumn,
          targetField: declared?.targetField ?? null,
          transform: declared?.transform ?? null,
          confidence: declared?.confidence ?? 0,
          evidence:
            declared?.evidence ??
            "The deterministic fixture has no declared mapping for this artifact and column.",
          status: declared?.status ?? "REVIEW_REQUIRED",
        };
      }),
    });
  }
}
