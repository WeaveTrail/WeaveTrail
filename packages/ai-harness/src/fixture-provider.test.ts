import { describe, expect, it } from "vitest";

import { MAPPING_CONFIDENCE_REVIEW_THRESHOLD } from "@weavetrail/contracts";
import {
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
} from "@weavetrail/scenarios";

import { FixtureSchemaMappingProvider } from "./fixture-provider";

const provider = new FixtureSchemaMappingProvider();

describe("FixtureSchemaMappingProvider", () => {
  it.each([
    ["dialect A", concentratedBuyDialectAMapping],
    ["dialect B", concentratedBuyDialectBMapping],
  ] as const)(
    "uses every declared transform for %s",
    async (_name, mapping) => {
      const proposal = await provider.propose({
        sourceArtifactHash: mapping.sourceArtifactHash,
        columns: mapping.fields.map(([sourceColumn]) => sourceColumn),
        sampleRows: [],
      });

      for (const [sourceColumn, targetField, transform] of mapping.fields) {
        const field = proposal.fields.find(
          (candidate) => candidate.sourceColumn === sourceColumn,
        );
        if (targetField === null) {
          expect(field).toMatchObject({
            sourceColumn,
            targetField: null,
            confidence: 0,
            status: "REVIEW_REQUIRED",
          });
          expect(field?.transform).toBeUndefined();
        } else {
          expect(field).toMatchObject({
            sourceColumn,
            targetField,
            transform,
            confidence: 1,
            status: "PROPOSED",
          });
        }
      }
    },
  );

  it("keeps dialect B source_note below the review threshold", async () => {
    const proposal = await provider.propose({
      sourceArtifactHash: concentratedBuyDialectBMapping.sourceArtifactHash,
      columns: ["source_note"],
      sampleRows: [],
    });

    expect(proposal.fields[0]).toMatchObject({
      sourceColumn: "source_note",
      targetField: null,
      status: "REVIEW_REQUIRED",
    });
    expect(proposal.fields[0]!.confidence).toBeLessThan(
      MAPPING_CONFIDENCE_REVIEW_THRESHOLD,
    );
  });
});
