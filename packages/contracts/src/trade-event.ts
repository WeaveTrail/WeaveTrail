import { z } from "zod";

const DecimalStringSchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/, "Expected a canonical decimal string");

export const TradeEventSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    eventId: z.string().min(1),
    sourceEventId: z.string().min(1),
    datasetId: z.string().min(1),
    venueId: z.string().min(1),
    eventTime: z.iso.datetime({ offset: true }),
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

export type TradeEvent = z.infer<typeof TradeEventSchema>;
