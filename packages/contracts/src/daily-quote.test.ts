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
