import { describe, expect, it } from "vitest";

import {
  SchemaMappingProposalSchema,
  deriveApprovedSourceMapping,
} from "./schema-mapping";

const field = (
  sourceColumn: string,
  targetField: string | null,
  transform: string | null,
) => ({
  sourceColumn,
  targetField,
  transform,
  confidence: 1,
  evidence: "Published execution field.",
  status: "PROPOSED",
});

const base = {
  mappingVersion: "1.8",
  sourceArtifactHash: "a".repeat(64),
  constants: {
    schemaVersion: "1.1",
    datasetId: "synthetic-execution",
    venueId: "SYNTH-X",
    eventType: "TRADE",
  },
  unmappedFields: [],
  fields: [
    field("id", "sourceEventId", "IDENTITY"),
    field("time", "eventTime", "FIX_UTC_TIMESTAMP_TO_ISO"),
    field("symbol", "instrumentId", "IDENTITY"),
    field("side", "side", "FIX_SIDE_CODE"),
  ],
};

describe("intraday execution mapping 1.8", () => {
  it("admits FIX execution transforms without changing legacy mappings", () => {
    const parsed = SchemaMappingProposalSchema.parse(base);

    expect(parsed).toEqual(base);
    expect(deriveApprovedSourceMapping(parsed)).not.toHaveProperty(
      "unmappedFields",
    );
    expect(
      SchemaMappingProposalSchema.safeParse({
        ...base,
        mappingVersion: "1.4",
        constants: {
          schemaVersion: "1.1",
          datasetId: "synthetic-execution",
          venueId: "SYNTH-X",
        },
      }).success,
    ).toBe(false);
    expect(
      SchemaMappingProposalSchema.safeParse({
        ...base,
        fields: base.fields.map((candidate) =>
          candidate.sourceColumn === "time"
            ? { ...candidate, targetField: "price" }
            : candidate,
        ),
      }).success,
    ).toBe(false);
  });

  it("admits one reviewed absent actor and keeps it out of the executable mapping", () => {
    const proposal = {
      ...base,
      unmappedFields: [
        {
          targetField: "actorId",
          confidence: 0,
          evidence: "The published response contains no participant column.",
          status: "REVIEW_REQUIRED",
        },
      ],
    };
    const parsed = SchemaMappingProposalSchema.parse(proposal);
    if (parsed.mappingVersion !== "1.8")
      throw new Error("Expected mapping 1.8");

    expect(parsed.unmappedFields).toEqual(proposal.unmappedFields);
    expect(deriveApprovedSourceMapping(parsed)).not.toHaveProperty(
      "unmappedFields",
    );
    expect(
      SchemaMappingProposalSchema.safeParse({
        ...proposal,
        fields: [...proposal.fields, field("account", "actorId", "IDENTITY")],
      }).success,
    ).toBe(false);
  });

  it("accepts exactly one direct or composite event time", () => {
    const composite = {
      ...base,
      compositeEventTime: {
        sourceColumns: ["date", "time"],
        transform: "KIS_DATE_TIME_TO_KST_ISO",
        confidence: 1,
        evidence: "Published business date and execution time.",
        status: "PROPOSED",
      },
      fields: base.fields.filter(
        ({ targetField }) => targetField !== "eventTime",
      ),
    };
    const parsed = SchemaMappingProposalSchema.parse(composite);

    expect(deriveApprovedSourceMapping(parsed)).toMatchObject({
      compositeEventTime: composite.compositeEventTime,
    });
    expect(
      SchemaMappingProposalSchema.safeParse({
        ...composite,
        fields: base.fields,
      }).success,
    ).toBe(false);
    expect(
      SchemaMappingProposalSchema.safeParse({
        ...composite,
        compositeEventTime: {
          ...composite.compositeEventTime,
          sourceColumns: ["time", "time"],
        },
      }).success,
    ).toBe(false);
  });

  it("keeps execution transforms out of mapping versions 1.5 through 1.7", () => {
    const executionFields = [
      field("time", "eventTime", "FIX_UTC_TIMESTAMP_TO_ISO"),
      field("side", "side", "FIX_SIDE_CODE"),
      field("division", "side", "KIS_CCLD_DVSN"),
    ];
    const dailyConstants = {
      schemaVersion: "1.2",
      datasetId: "daily",
      venueId: "SYNTH-X",
      eventType: "DAILY_QUOTE",
    };
    for (const executionField of executionFields) {
      const proposals = [
        {
          mappingVersion: "1.5",
          sourceArtifactHash: "a".repeat(64),
          constants: dailyConstants,
          fields: [executionField],
        },
        {
          mappingVersion: "1.6",
          sourceArtifactHash: "a".repeat(64),
          constants: dailyConstants,
          compositeSourceEventId: {
            sourceColumns: ["date", "instrument"],
            transform: "NUL_JOIN",
            confidence: 1,
            evidence: "Publisher key.",
            status: "PROPOSED",
          },
          fields: [executionField],
        },
        {
          mappingVersion: "1.7",
          sourceArtifactHash: "a".repeat(64),
          constants: { ...dailyConstants, schemaVersion: "1.3" },
          fields: [field("id", "sourceEventId", "IDENTITY"), executionField],
        },
      ];

      for (const proposal of proposals) {
        expect(SchemaMappingProposalSchema.safeParse(proposal).success).toBe(
          false,
        );
      }
    }
  });
});
