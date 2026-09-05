import { afterEach, describe, expect, it } from "vitest";

import { MAPPING_CONFIDENCE_REVIEW_THRESHOLD } from "@weavetrail/contracts";
import {
  committedReplayScenarios,
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
} from "@weavetrail/scenarios";

import {
  FixtureSchemaMappingProvider,
  fixtureMappingsByArtifact,
} from "./fixture-provider";

const provider = new FixtureSchemaMappingProvider();
const syntheticDailyHash = "f".repeat(64);
afterEach(() => {
  fixtureMappingsByArtifact.delete(syntheticDailyHash);
});

describe("FixtureSchemaMappingProvider", () => {
  it("selects daily proposal metadata by registered artifact hash and checks constants", async () => {
    const constants = {
      schemaVersion: "1.2",
      eventType: "DAILY_QUOTE",
      datasetId: "synthetic-daily-provider-test",
      venueId: "SYNTH-X",
    } as const;
    fixtureMappingsByArtifact.set(syntheticDailyHash, {
      mappingVersion: "1.5",
      constants,
      fields: new Map([
        [
          "date",
          {
            targetField: "eventTime",
            transform: "YYYYMMDD_TO_KST_DAY_START_ISO",
            confidence: 0,
            status: "REVIEW_REQUIRED",
            evidence:
              "Synthetic trading-date interpretation requires approval.",
          },
        ],
      ]),
    });
    const input = {
      sourceArtifactHash: syntheticDailyHash,
      constants,
      columns: ["date", "unknown"],
      sampleRows: [],
    };
    const proposal = await provider.propose(input);
    expect(proposal).toMatchObject({
      mappingVersion: "1.5",
      constants,
      fields: [
        {
          sourceColumn: "date",
          targetField: "eventTime",
          transform: "YYYYMMDD_TO_KST_DAY_START_ISO",
          confidence: 0,
          status: "REVIEW_REQUIRED",
        },
        {
          sourceColumn: "unknown",
          targetField: null,
          transform: null,
          confidence: 0,
          status: "REVIEW_REQUIRED",
        },
      ],
    });
    for (const changed of [
      { ...constants, datasetId: "OTHER" },
      { ...constants, venueId: "OTHER" },
      {
        schemaVersion: "1.1",
        datasetId: constants.datasetId,
        venueId: constants.venueId,
      } as const,
    ]) {
      await expect(
        provider.propose({ ...input, constants: changed }),
      ).rejects.toThrow("must match");
    }
    await expect(
      provider.propose({ ...input, sourceArtifactHash: "e".repeat(64) }),
    ).rejects.toThrow("registered");
  });

  it("keeps unknown legacy artifacts in review", async () => {
    const proposal = await provider.propose({
      sourceArtifactHash: "e".repeat(64),
      constants: {
        schemaVersion: "1.1",
        datasetId: "synthetic-unknown",
        venueId: "SYNTH-X",
      },
      columns: ["mystery"],
      sampleRows: [],
    });
    expect(proposal).toMatchObject({
      mappingVersion: "1.4",
      fields: [
        {
          sourceColumn: "mystery",
          targetField: null,
          transform: null,
          confidence: 0,
          status: "REVIEW_REQUIRED",
        },
      ],
    });
  });
  it.each([
    ["dialect A", concentratedBuyDialectAMapping],
    ["dialect B", concentratedBuyDialectBMapping],
  ] as const)(
    "uses every declared transform for %s",
    async (_name, mapping) => {
      const proposal = await provider.propose({
        sourceArtifactHash: mapping.sourceArtifactHash,
        constants: mapping.constants,
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
            confidence: sourceColumn === "source_note" ? 0 : 1,
            status:
              sourceColumn === "source_note" ? "REVIEW_REQUIRED" : "PROPOSED",
          });
          expect(field?.transform).toBeNull();
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

  it("presents dialect B source_note for review below the confidence threshold", async () => {
    const proposal = await provider.propose({
      sourceArtifactHash: concentratedBuyDialectBMapping.sourceArtifactHash,
      constants: concentratedBuyDialectBMapping.constants,
      columns: ["source_note"],
      sampleRows: [],
    });

    expect(proposal.fields[0]).toMatchObject({
      sourceColumn: "source_note",
      targetField: null,
      transform: null,
      confidence: 0,
      status: "REVIEW_REQUIRED",
    });
    expect(proposal.fields[0]!.confidence).toBeLessThan(
      MAPPING_CONFIDENCE_REVIEW_THRESHOLD,
    );
  });

  it("reaches source_note review-required through committed dialect B", async () => {
    const scenario =
      committedReplayScenarios["concentrated-buy-dialect-b.jsonl"];
    const proposal = await provider.propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      constants: scenario.constants,
      columns: [...scenario.columns],
      sampleRows: [],
    });

    expect(
      proposal.fields.filter(({ status }) => status === "REVIEW_REQUIRED"),
    ).toEqual([
      expect.objectContaining({
        sourceColumn: "source_note",
        targetField: null,
        transform: null,
        confidence: 0,
        status: "REVIEW_REQUIRED",
      }),
    ]);
  });

  it("keeps dialect A fully resolvable", async () => {
    const scenario = committedReplayScenarios["concentrated-buy-dialect-a.csv"];
    const proposal = await provider.propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      constants: scenario.constants,
      columns: [...scenario.columns],
      sampleRows: [],
    });

    expect(
      proposal.fields.filter(({ status }) => status === "REVIEW_REQUIRED"),
    ).toEqual([]);
  });
});
