import { TradeEventSchema, type TradeEvent } from "@weavetrail/contracts";

import {
  CanonicalizationError,
  compareCanonicalEventTimes,
  compareUtf16CodeUnits,
  normalizeEventTime,
} from "./canonical-order";

export type CanonicalizationResult = {
  events: TradeEvent[];
  duplicateCount: number;
};

function compareUnsignedIntegerStrings(left: string, right: string): number {
  const normalizedLeft = left.replace(/^0+(?=\d)/, "");
  const normalizedRight = right.replace(/^0+(?=\d)/, "");

  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length - normalizedRight.length;
  }

  return compareUtf16CodeUnits(normalizedLeft, normalizedRight);
}

function compareEvents(left: TradeEvent, right: TradeEvent): number {
  const timeOrder = compareCanonicalEventTimes(left.eventTime, right.eventTime);
  if (timeOrder !== 0) return timeOrder;

  if (left.sequence !== undefined && right.sequence !== undefined) {
    const sequenceOrder = compareUnsignedIntegerStrings(
      left.sequence,
      right.sequence,
    );
    if (sequenceOrder !== 0) return sequenceOrder;
  }

  return compareUtf16CodeUnits(left.eventId, right.eventId);
}

function requireConsistentSequencePresence(
  events: readonly TradeEvent[],
): void {
  const sequenceCount = events.filter(
    ({ sequence }) => sequence !== undefined,
  ).length;

  if (sequenceCount > 0 && sequenceCount < events.length) {
    throw new CanonicalizationError(
      "MIXED_SEQUENCE_PRESENCE",
      "A canonical dataset may not mix events with and without sequence values",
    );
  }
}

export function canonicalizeEvents(
  input: readonly unknown[],
): CanonicalizationResult {
  const validated = input.map((event) => {
    const parsed = TradeEventSchema.parse(event);
    return { ...parsed, eventTime: normalizeEventTime(parsed.eventTime) };
  });
  requireConsistentSequencePresence(validated);
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
