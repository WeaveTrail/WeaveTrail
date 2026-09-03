import { describe, expect, it } from "vitest";

import {
  canonicalizeDecimalString,
  DecimalStringSchema,
} from "./decimal-string";
import { TradeEventSchema } from "./trade-event";

describe("canonical decimal strings", () => {
  it.each([
    ["100", "100"],
    ["100.0", "100"],
    ["100.00", "100"],
    ["12.3400", "12.34"],
    ["-12.3400", "-12.34"],
    ["0.000", "0"],
    ["-0", "0"],
    ["-0.0", "0"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(canonicalizeDecimalString(input)).toBe(expected);
    expect(DecimalStringSchema.parse(input)).toBe(expected);
  });

  it.each(["1e2", "+1", "01", "-01.0", "Infinity", "NaN", "", ".1"])(
    "rejects invalid decimal input %j",
    (input) => {
      expect(canonicalizeDecimalString(input)).toBeUndefined();
      expect(DecimalStringSchema.safeParse(input).success).toBe(false);
    },
  );

  it("canonicalizes price and quantity during direct TradeEvent parsing", () => {
    const parsed = TradeEventSchema.parse({
      schemaVersion: "1.1",
      eventId: "event-1",
      sourceEventId: "source-1",
      datasetId: "dataset",
      venueId: "venue",
      eventTime: "2026-09-04T00:00:00Z",
      instrumentId: "instrument",
      eventType: "TRADE",
      price: "100.00",
      quantity: "-0.0",
      rawRowHash: "a".repeat(64),
    });

    expect(parsed.price).toBe("100");
    expect(parsed.quantity).toBe("0");
  });
});
