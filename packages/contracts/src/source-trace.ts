import { z } from "zod";

import { LegacyTradeEventSchema } from "./trade-event";

// Deliberate allowlist: new internal event fields must not leak into this view.
export const SourceTraceEventSchema = LegacyTradeEventSchema.pick({
  schemaVersion: true,
  eventId: true,
  sourceEventId: true,
  datasetId: true,
  venueId: true,
  eventTime: true,
  sequence: true,
  instrumentId: true,
  eventType: true,
  side: true,
  actorId: true,
  counterpartyId: true,
  orderId: true,
  price: true,
  quantity: true,
  rawRowHash: true,
}).strict();

export const SourceTraceRowSchema = z
  .object({
    coordinate: z
      .object({
        sourceArtifactHash: LegacyTradeEventSchema.shape.rawRowHash,
        rowNumber: z.string().regex(/^[1-9]\d*$/),
      })
      .strict(),
    values: z.record(z.string(), z.string()),
  })
  .strict();

export const SourceTraceSchema = z
  .object({
    traceVersion: z.literal("1.0"),
    entries: z.array(
      z
        .object({
          event: SourceTraceEventSchema,
          sourceRow: SourceTraceRowSchema,
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((trace, ctx) => {
    const ids = new Set<string>();
    for (const [index, entry] of trace.entries.entries()) {
      if (ids.has(entry.event.eventId)) {
        ctx.addIssue({
          code: "custom",
          path: ["entries", index, "event", "eventId"],
          message: "Trace event IDs must be unique",
        });
      }
      ids.add(entry.event.eventId);
    }
  });

export type SourceTrace = z.infer<typeof SourceTraceSchema>;
