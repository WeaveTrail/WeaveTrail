import { z } from "zod";
import { DecimalStringSchema } from "./decimal-string";

const EventTimeSchema = z.iso
  .datetime({ offset: true })
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ),
    "Expected an ISO datetime with an explicit offset and at most nanosecond precision",
  );

export const LegacyTradeEventSchema = z
  .object({
    schemaVersion: z.literal("1.1"),
    eventId: z.string().min(1),
    sourceEventId: z.string().min(1),
    datasetId: z.string().min(1),
    venueId: z.string().min(1),
    eventTime: EventTimeSchema,
    receivedAt: z.iso.datetime({ offset: true }).optional(),
    sequence: z.string().regex(/^\d+$/).optional(),
    instrumentId: z.string().min(1),
    eventType: z.enum(["ORDER_NEW", "ORDER_CANCEL", "TRADE"]),
    side: z.enum(["BUY", "SELL"]).optional(),
    actorId: z.string().min(1).optional(),
    counterpartyId: z.string().min(1).optional(),
    orderId: z.string().min(1).optional(),
    price: DecimalStringSchema.optional(),
    quantity: DecimalStringSchema.optional(),
    rawRowHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const DailyQuoteEventSchema = LegacyTradeEventSchema.extend({
  schemaVersion: z.literal("1.2"),
  eventType: z.literal("DAILY_QUOTE"),
}).strict();

export const TradeEventSchema = z.discriminatedUnion("schemaVersion", [
  LegacyTradeEventSchema,
  DailyQuoteEventSchema,
]);

export type TradeEvent = z.infer<typeof TradeEventSchema>;
