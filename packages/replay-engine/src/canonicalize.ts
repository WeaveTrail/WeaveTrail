import { TradeEventSchema, type TradeEvent } from "@weavetrail/contracts";

export type CanonicalizationResult = {
  events: TradeEvent[];
  duplicateCount: number;
};

function compareUnsignedIntegerStrings(left = "", right = ""): number {
  const normalizedLeft = left.replace(/^0+(?=\d)/, "");
  const normalizedRight = right.replace(/^0+(?=\d)/, "");

  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length - normalizedRight.length;
  }

  return normalizedLeft.localeCompare(normalizedRight);
}

function compareEvents(left: TradeEvent, right: TradeEvent): number {
  const timeOrder = Date.parse(left.eventTime) - Date.parse(right.eventTime);
  if (timeOrder !== 0) return timeOrder;

  const sequenceOrder = compareUnsignedIntegerStrings(
    left.sequence,
    right.sequence,
  );
  if (sequenceOrder !== 0) return sequenceOrder;

  return left.eventId.localeCompare(right.eventId);
}

export function canonicalizeEvents(
  input: readonly unknown[],
): CanonicalizationResult {
  const validated = input.map((event) => TradeEventSchema.parse(event));
  const seen = new Set<string>();
  const events: TradeEvent[] = [];
  let duplicateCount = 0;

  for (const event of validated) {
    const duplicateKey = `${event.datasetId}\u0000${event.venueId}\u0000${event.sourceEventId}\u0000${event.rawRowHash}`;
    if (seen.has(duplicateKey)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(duplicateKey);
    events.push(event);
  }

  events.sort(compareEvents);
  return { events, duplicateCount };
}
