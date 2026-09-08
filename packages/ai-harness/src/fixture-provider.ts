import { publishedReplaySources } from "@weavetrail/published-data";
import {
  SchemaMappingProposalSchema,
  type AllowedTransform,
  type SchemaMappingProposal,
} from "@weavetrail/contracts";
import {
  actorlessMultiInstrumentMappingProposal,
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
  publishedExecutionConflictProposal,
  publishedExecutionFixProposal,
  publishedExecutionH0stcnt0Proposal,
  rapidPriceLiftScenarios,
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

function usesRegisteredConstants(mappingVersion: string | undefined): boolean {
  return (
    mappingVersion === "1.5" ||
    mappingVersion === "1.6" ||
    mappingVersion === "1.7" ||
    mappingVersion === "1.8"
  );
}

function eventTypeOf(
  constants: SchemaMappingProposal["constants"],
): string | undefined {
  return "eventType" in constants ? constants.eventType : undefined;
}

const registeredProposals = [
  ...Object.values(publishedReplaySources).map(
    ({ mappingProposal }) => mappingProposal,
  ),
  actorlessMultiInstrumentMappingProposal,
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
  publishedExecutionConflictProposal,
  publishedExecutionFixProposal,
  publishedExecutionH0stcnt0Proposal,
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
          ...("compositeSourceEventId" in proposal &&
          proposal.compositeSourceEventId !== undefined
            ? { compositeSourceEventId: proposal.compositeSourceEventId }
            : {}),
          ...("compositeEventTime" in proposal &&
          proposal.compositeEventTime !== undefined
            ? { compositeEventTime: proposal.compositeEventTime }
            : {}),
          ...("unmappedFields" in proposal
            ? { unmappedFields: proposal.unmappedFields }
            : {}),
        },
      ] as const,
  ),
);

export class FixtureSchemaMappingProvider implements SchemaMappingProvider {
  readonly mode = "fixture" as const;
  readonly trace = {
    mode: this.mode,
    model: "registered-mapping",
    promptVersion: "fixture-mapping/1",
  };

  async propose(input: MappingInput): Promise<SchemaMappingProposal> {
    const artifactMapping = fixtureMappingsByArtifact.get(
      input.sourceArtifactHash,
    );
    const fixtureUsesRegisteredConstants = usesRegisteredConstants(
      artifactMapping?.mappingVersion,
    );
    const inputRequiresRegisteredConstants =
      input.constants.schemaVersion === "1.2" ||
      input.constants.schemaVersion === "1.3" ||
      eventTypeOf(input.constants) === "TRADE";
    if (inputRequiresRegisteredConstants || fixtureUsesRegisteredConstants) {
      if (
        artifactMapping === undefined ||
        !fixtureUsesRegisteredConstants ||
        input.constants.schemaVersion !==
          artifactMapping.constants.schemaVersion ||
        input.constants.datasetId !== artifactMapping.constants.datasetId ||
        input.constants.venueId !== artifactMapping.constants.venueId ||
        eventTypeOf(input.constants) !== eventTypeOf(artifactMapping.constants)
      ) {
        throw new Error(
          "Fixture constants must match a registered fixture artifact",
        );
      }
    }
    return SchemaMappingProposalSchema.parse({
      mappingVersion: artifactMapping?.mappingVersion ?? "1.4",
      sourceArtifactHash: input.sourceArtifactHash,
      constants: input.constants,
      ...(artifactMapping !== undefined &&
      "compositeSourceEventId" in artifactMapping &&
      artifactMapping.compositeSourceEventId !== undefined
        ? { compositeSourceEventId: artifactMapping.compositeSourceEventId }
        : {}),
      ...(artifactMapping !== undefined &&
      "compositeEventTime" in artifactMapping &&
      artifactMapping.compositeEventTime !== undefined
        ? { compositeEventTime: artifactMapping.compositeEventTime }
        : {}),
      ...(artifactMapping !== undefined && "unmappedFields" in artifactMapping
        ? { unmappedFields: artifactMapping.unmappedFields }
        : {}),
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
