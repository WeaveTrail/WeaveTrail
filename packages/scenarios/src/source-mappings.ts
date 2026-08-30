const SHARED_CONSTANTS = {
  schemaVersion: "1.0",
  datasetId: "synthetic-concentrated-buy-v1",
  venueId: "SYNTH-X",
} as const;

export const concentratedBuyDialectAMapping = {
  mappingVersion: "1.0",
  sourceArtifactHash:
    "d4bd80adf6a853adcf98f9ee08092f786b9b9276b349ad11fef6d0af078b867e",
  constants: SHARED_CONSTANTS,
  fields: [
    ["source_id", "sourceEventId", "IDENTITY"],
    ["ts", "eventTime", "ISO_DATETIME"],
    ["received", "receivedAt", "ISO_DATETIME"],
    ["seq", "sequence", "IDENTITY"],
    ["symbol", "instrumentId", "IDENTITY"],
    ["kind", "eventType", "EVENT_TYPE_CODE"],
    ["side_code", "side", "BUY_SELL_CODE"],
    ["actor", "actorId", "IDENTITY"],
    ["counterparty", "counterpartyId", "IDENTITY"],
    ["order_ref", "orderId", "IDENTITY"],
    ["px", "price", "DECIMAL_STRING"],
    ["qty", "quantity", "DECIMAL_STRING"],
  ],
} as const;

export const concentratedBuyDialectBMapping = {
  mappingVersion: "1.0",
  sourceArtifactHash:
    "71a367b78a9bfefa685b9f40414b778712860b358882537b7f87127ab1584cff",
  constants: SHARED_CONSTANTS,
  fields: [
    ["sourceRef", "sourceEventId", "IDENTITY"],
    ["event_timestamp", "eventTime", "ISO_DATETIME"],
    ["received_timestamp", "receivedAt", "ISO_DATETIME"],
    ["source_sequence", "sequence", "IDENTITY"],
    ["product", "instrumentId", "IDENTITY"],
    ["event_kind", "eventType", "EVENT_TYPE_CODE"],
    ["direction", "side", "BUY_SELL_CODE"],
    ["participant", "actorId", "IDENTITY"],
    ["contra", "counterpartyId", "IDENTITY"],
    ["order_reference", "orderId", "IDENTITY"],
    ["trade_price", "price", "DECIMAL_STRING"],
    ["trade_quantity", "quantity", "DECIMAL_STRING"],
    ["source_note", null, null],
  ],
} as const;
