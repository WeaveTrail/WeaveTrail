import { afterEach, describe, expect, it } from "vitest";

import {
  MAPPING_CONFIDENCE_REVIEW_THRESHOLD,
  SchemaMappingProposalSchema,
} from "@weavetrail/contracts";
import {
  actorlessMultiInstrumentScenario,
  committedReplayScenarios,
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
  publishedExecutionSchemaScenario,
  publishedExecutionBroadScenario,
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
  it("serves direct and composite mapping 1.7 over synthetic registry specimens", async () => {
    for (const composite of [false, true]) {
      const proposal = SchemaMappingProposalSchema.parse({
        mappingVersion: "1.7",
        sourceArtifactHash: syntheticDailyHash,
        constants: {
          schemaVersion: "1.3",
          eventType: "DAILY_QUOTE",
          datasetId: "synthetic-ohlc-provider",
          venueId: "SYNTH-X",
        },
        ...(composite
          ? {
              compositeSourceEventId: {
                sourceColumns: ["date", "instrument"],
                transform: "NUL_JOIN",
                confidence: 1,
                status: "PROPOSED",
                evidence: "Synthetic composite identity.",
              },
            }
          : {}),
        fields: [
          [
            "id",
            composite ? null : "sourceEventId",
            composite ? null : "IDENTITY",
          ],
          ["instrument", "instrumentId", "IDENTITY"],
          ["date", "eventTime", "YYYYMMDD_TO_KST_DAY_START_ISO"],
          ["open", "openPrice", "PUBLISHER_DECIMAL_STRING"],
          ["high", "highPrice", "PUBLISHER_DECIMAL_STRING"],
          ["low", "lowPrice", "PUBLISHER_DECIMAL_STRING"],
          ["close", "closePrice", "PUBLISHER_DECIMAL_STRING"],
          ["change", "netChange", "PUBLISHER_DECIMAL_STRING"],
          ["volume", "quantity", "DECIMAL_STRING"],
        ].map(([sourceColumn, targetField, transform]) => ({
          sourceColumn,
          targetField,
          transform,
          confidence: 1,
          status: "PROPOSED",
          evidence: "Synthetic registry specimen.",
        })),
      });
      if (proposal.mappingVersion !== "1.7")
        throw new Error("Expected mapping 1.7");
      fixtureMappingsByArtifact.set(syntheticDailyHash, {
        mappingVersion: proposal.mappingVersion,
        constants: proposal.constants,
        fields: new Map(
          proposal.fields.map(({ sourceColumn, ...field }) => [
            sourceColumn,
            field,
          ]),
        ),
        ...(proposal.compositeSourceEventId
          ? { compositeSourceEventId: proposal.compositeSourceEventId }
          : {}),
      });
      expect(
        await provider.propose({
          sourceArtifactHash: syntheticDailyHash,
          constants: proposal.constants,
          columns: proposal.fields.map((field) => field.sourceColumn),
          sampleRows: [],
        }),
      ).toEqual(proposal);
    }
  });

  it("serves the committed actorless multi-instrument mapping", async () => {
    const scenario = actorlessMultiInstrumentScenario;
    const proposal = await provider.propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      constants: scenario.constants,
      columns: [...scenario.columns],
      sampleRows: [],
    });

    expect(proposal).toEqual(scenario.mappingProposal);
  });

  it("serves the registered published execution mappings with absent actor review", async () => {
    for (const scenario of [
      ...Object.values(publishedExecutionSchemaScenario),
      publishedExecutionBroadScenario,
    ]) {
      const proposal = await provider.propose({
        sourceArtifactHash: scenario.sourceArtifactHash,
        constants: scenario.constants,
        columns: [...scenario.columns],
        sampleRows: [],
      });
      expect(proposal).toEqual(scenario.mappingProposal);
      expect(proposal.mappingVersion).toBe("1.8");
    }
    const h0stcnt0 = publishedExecutionSchemaScenario.h0stcnt0.mappingProposal;
    if (h0stcnt0.mappingVersion !== "1.8") {
      throw new Error("Expected mapping 1.8");
    }
    expect(h0stcnt0.unmappedFields).toEqual([
      expect.objectContaining({
        targetField: "actorId",
        status: "REVIEW_REQUIRED",
      }),
    ]);
  });

  it("rejects constants that rebind a registered execution artifact", async () => {
    for (const scenario of [
      ...Object.values(publishedExecutionSchemaScenario),
      publishedExecutionBroadScenario,
    ]) {
      const input = {
        sourceArtifactHash: scenario.sourceArtifactHash,
        constants: scenario.constants,
        columns: [...scenario.columns],
        sampleRows: [],
      };

      for (const constants of [
        { ...scenario.constants, datasetId: "OTHER" },
        { ...scenario.constants, venueId: "OTHER" },
      ]) {
        await expect(provider.propose({ ...input, constants })).rejects.toThrow(
          "must match",
        );
      }
    }
  });

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
    await expect(
      provider.propose({
        ...input,
        sourceArtifactHash: "e".repeat(64),
        constants: { ...constants, schemaVersion: "1.3" },
      }),
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
