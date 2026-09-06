import { describe, expect, it } from "vitest";
import {
  SchemaMappingProposalSchema,
  deriveApprovedSourceMapping,
} from "./schema-mapping";
import { TradeEventSchema } from "./trade-event";

const constants = {
  schemaVersion: "1.2",
  datasetId: "synthetic-daily-v1",
  venueId: "SYNTH-X",
  eventType: "DAILY_QUOTE",
};
const field = {
  sourceColumn: "date",
  targetField: "eventTime",
  transform: "YYYYMMDD_TO_KST_DAY_START_ISO",
  confidence: 0,
  evidence: "Synthetic trading-date anchor requiring review.",
  status: "REVIEW_REQUIRED",
};
const proposal = {
  mappingVersion: "1.5",
  sourceArtifactHash: "a".repeat(64),
  constants,
  fields: [field],
};
const event = {
  ...constants,
  eventId: "synthetic-event",
  sourceEventId: "synthetic-issue",
  instrumentId: "SYNTH-INSTRUMENT",
  eventTime: "2024-02-29T00:00:00+09:00",
  rawRowHash: "b".repeat(64),
};

describe("daily-only version coexistence", () => {
  it("admits reviewed OHLC and absolute net-change fields only in mapping 1.7", () => {
    const fields = [
      ["open", "openPrice"],
      ["high", "highPrice"],
      ["low", "lowPrice"],
      ["close", "closePrice"],
      ["change", "netChange"],
    ].map(([sourceColumn, targetField]) => ({
      sourceColumn,
      targetField,
      transform: "PUBLISHER_DECIMAL_STRING",
      confidence: 0,
      evidence: "Reviewed synthetic publisher decimal.",
      status: "REVIEW_REQUIRED",
    }));
    const input = {
      ...proposal,
      mappingVersion: "1.7",
      constants: { ...constants, schemaVersion: "1.3" },
      fields: [
        field,
        {
          sourceColumn: "id",
          targetField: "sourceEventId",
          transform: "IDENTITY",
          confidence: 1,
          evidence: "Publisher identity.",
          status: "PROPOSED",
        },
        ...fields,
      ],
    };
    expect(SchemaMappingProposalSchema.parse(input)).toEqual(input);
    expect(
      SchemaMappingProposalSchema.safeParse({
        ...input,
        mappingVersion: "1.5",
      }).success,
    ).toBe(false);
    expect(
      SchemaMappingProposalSchema.safeParse({
        ...input,
        mappingVersion: "1.5",
        constants,
      }).success,
    ).toBe(false);
  });

  it("admits an ordered composite publisher identity only in mapping 1.6", () => {
    const composite = {
      ...proposal,
      mappingVersion: "1.6",
      compositeSourceEventId: {
        sourceColumns: ["date", "index_name"],
        transform: "NUL_JOIN",
        confidence: 1,
        evidence: "Publisher natural key.",
        status: "PROPOSED",
      },
    };
    const parsed = SchemaMappingProposalSchema.parse(composite);
    expect(deriveApprovedSourceMapping(parsed)).toMatchObject({
      mappingVersion: "1.6",
      compositeSourceEventId: composite.compositeSourceEventId,
    });
    expect(
      SchemaMappingProposalSchema.safeParse({
        ...composite,
        compositeSourceEventId: {
          ...composite.compositeSourceEventId,
          sourceColumns: ["date", "date"],
        },
      }).success,
    ).toBe(false);
    for (const compositeSourceEventId of [
      { ...composite.compositeSourceEventId, confidence: 0 },
      { ...composite.compositeSourceEventId, status: "REVIEW_REQUIRED" },
    ]) {
      expect(
        SchemaMappingProposalSchema.safeParse({
          ...composite,
          compositeSourceEventId,
        }).success,
      ).toBe(false);
    }
    expect(
      SchemaMappingProposalSchema.safeParse({
        ...proposal,
        compositeSourceEventId: composite.compositeSourceEventId,
      }).success,
    ).toBe(false);
  });
  it("preserves accepted payloads and the executable version/constants verbatim", () => {
    const parsed = SchemaMappingProposalSchema.parse(proposal);
    expect(parsed).toEqual(proposal);
    expect(deriveApprovedSourceMapping(parsed)).toMatchObject({
      mappingVersion: "1.5",
      constants,
    });
    expect(TradeEventSchema.parse(event)).toEqual(event);
  });

  it.each([
    { ...event, schemaVersion: "1.1" },
    { ...event, eventType: "TRADE" },
    { ...event, eventType: "ORDER_NEW" },
    { ...event, schemaVersion: "1.3" },
    { ...event, publisherTime: "invented" },
  ])("rejects incompatible event versions, kinds and extra fields", (input) => {
    expect(TradeEventSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    { ...proposal, mappingVersion: "1.4" },
    { ...proposal, constants: { ...constants, schemaVersion: "1.1" } },
    { ...proposal, constants: { ...constants, eventType: "TRADE" } },
    { ...proposal, constants: { ...constants, side: "BUY" } },
    {
      ...proposal,
      constants: { schemaVersion: "1.2", datasetId: "d", venueId: "v" },
    },
    { ...proposal, fields: [{ ...field, targetField: "receivedAt" }] },
    { ...proposal, fields: [{ ...field, targetField: "price" }] },
    { ...proposal, fields: [{ ...field, transform: "YYYYMMDD_TO_ISO" }] },
    { ...proposal, fields: [{ ...field, targetField: null }] },
    {
      ...proposal,
      mappingVersion: "1.4",
      constants: { schemaVersion: "1.1", datasetId: "d", venueId: "v" },
    },
    {
      ...proposal,
      mappingVersion: "1.4",
      fields: [],
      constants: {
        schemaVersion: "1.1",
        datasetId: "d",
        venueId: "v",
        eventType: "DAILY_QUOTE",
      },
    },
  ])(
    "rejects incompatible proposal versions, constants and transforms",
    (input) => {
      expect(SchemaMappingProposalSchema.safeParse(input).success).toBe(false);
    },
  );
});
