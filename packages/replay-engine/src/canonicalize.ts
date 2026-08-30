import { TradeEventSchema, type TradeEvent } from "@weavetrail/contracts";

import {
  canonicalJson,
  sha256Canonical,
  type JsonValue,
} from "./canonical-json";
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

export const CANONICAL_EVENT_FIELDS = [
  "schemaVersion",
  "eventId",
  "sourceEventId",
  "datasetId",
  "venueId",
  "eventTime",
  "sequence",
  "instrumentId",
  "eventType",
  "side",
  "actorId",
  "counterpartyId",
  "orderId",
  "price",
  "quantity",
] as const satisfies readonly (keyof TradeEvent)[];

export const COLLECTION_METADATA_FIELDS = [
  "receivedAt",
  "rawRowHash",
] as const satisfies readonly (keyof TradeEvent)[];

export type CanonicalEventProjection = {
  [Field in (typeof CANONICAL_EVENT_FIELDS)[number]]?: JsonValue;
};

export function projectCanonicalEvent(
  event: TradeEvent,
): CanonicalEventProjection {
  const projection: CanonicalEventProjection = {};

  for (const field of CANONICAL_EVENT_FIELDS) {
    const value = event[field];
    if (value !== undefined) projection[field] = value;
  }

  return projection;
}

function sourceIdentity(event: TradeEvent): [string, string, string] {
  return [event.datasetId, event.venueId, event.sourceEventId];
}

function sourceIdentityKey(event: TradeEvent): string {
  return canonicalJson(sourceIdentity(event));
}

function compareDuplicateRepresentatives(
  left: TradeEvent,
  right: TradeEvent,
): number {
  const rawRowOrder = compareUtf16CodeUnits(left.rawRowHash, right.rawRowHash);
  if (rawRowOrder !== 0) return rawRowOrder;
  return compareUtf16CodeUnits(left.receivedAt ?? "", right.receivedAt ?? "");
}

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
  const groups = new Map<string, TradeEvent[]>();

  for (const event of validated) {
    const identityKey = sourceIdentityKey(event);
    const group = groups.get(identityKey);
    if (group) group.push(event);
    else groups.set(identityKey, [event]);
  }

  const events: TradeEvent[] = [];
  let duplicateCount = 0;

  const conflictingSourceGroups = [...groups.entries()]
    .filter(([, group]) => {
      const projectionHashes = new Set(
        group.map((event) => sha256Canonical(projectCanonicalEvent(event))),
      );
      return projectionHashes.size !== 1;
    })
    .sort(([leftKey], [rightKey]) => compareUtf16CodeUnits(leftKey, rightKey));

  if (conflictingSourceGroups.length > 0) {
    const group = conflictingSourceGroups[0]![1];
    const [datasetId, venueId, sourceEventId] = sourceIdentity(group[0]!);
    throw new CanonicalizationError(
      "CONFLICTING_SOURCE_IDENTITY",
      `Conflicting canonical records for source identity datasetId=${JSON.stringify(datasetId)}, venueId=${JSON.stringify(venueId)}, sourceEventId=${JSON.stringify(sourceEventId)}`,
    );
  }

  for (const group of groups.values()) {
    group.sort(compareDuplicateRepresentatives);
    events.push(group[0]!);
    duplicateCount += group.length - 1;
  }

  events.sort(compareEvents);
  return { events, duplicateCount };
}
