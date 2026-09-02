import { concentratedBuyEvents } from "./concentrated-buy";
import {
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
} from "./source-mappings";

type SourceRow = {
  coordinate: { sourceArtifactHash: string; rowNumber: string };
  values: Record<string, string>;
};

function commonValues(event: (typeof concentratedBuyEvents)[number]) {
  return {
    sourceEventId: event.sourceEventId,
    eventTime: event.eventTime,
    receivedAt: event.receivedAt!,
    sequence: event.sequence!,
    instrumentId: event.instrumentId,
    eventType: event.eventType,
    side: event.side!,
    actorId: event.actorId!,
    counterpartyId: event.counterpartyId!,
    orderId: event.orderId!,
    price: event.price!,
    quantity: event.quantity!,
  };
}

export const concentratedBuyDialectARows: SourceRow[] =
  concentratedBuyEvents.map((event, index) => {
    const value = commonValues(event);
    return {
      coordinate: {
        sourceArtifactHash: concentratedBuyDialectAMapping.sourceArtifactHash,
        rowNumber: String(index + 2),
      },
      values: {
        source_id: value.sourceEventId,
        ts: {
          "source-001": "2026-08-25T09:00:00.000+09:00",
          "source-002": "2026-08-25T09:00:01.000+09:00",
          "source-003": "2026-08-25T09:00:02.000+09:00",
          "source-004": "2026-08-25T09:00:02.000+09:00",
        }[value.sourceEventId]!,
        received: value.receivedAt,
        seq: value.sequence,
        symbol: value.instrumentId,
        kind: "T",
        side_code: value.side === "BUY" ? "B" : "S",
        actor: value.actorId,
        counterparty: value.counterpartyId,
        order_ref: value.orderId,
        px: value.price,
        qty: value.quantity,
      },
    };
  });

export const concentratedBuyDialectBRows: SourceRow[] =
  concentratedBuyEvents.map((event, index) => {
    const value = commonValues(event);
    return {
      coordinate: {
        sourceArtifactHash: concentratedBuyDialectBMapping.sourceArtifactHash,
        rowNumber: String(index + 1),
      },
      values: {
        sourceRef: value.sourceEventId,
        event_timestamp: {
          "source-001": "2026-08-25T00:00:00Z",
          "source-002": "2026-08-25T00:00:01Z",
          "source-003": "2026-08-25T00:00:02Z",
          "source-004": "2026-08-25T00:00:02Z",
        }[value.sourceEventId]!,
        received_timestamp: value.receivedAt,
        source_sequence: value.sequence,
        product: value.instrumentId,
        event_kind: "EXECUTION",
        direction: value.side,
        participant: value.actorId,
        contra: value.counterpartyId,
        order_reference: value.orderId,
        trade_price: value.price,
        trade_quantity: value.quantity,
        source_note: "synthetic-b",
      },
    };
  });
