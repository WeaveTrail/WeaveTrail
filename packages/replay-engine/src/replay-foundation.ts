import type { RapidPriceLiftResult, TradeEvent } from "@weavetrail/contracts";

import { sha256Canonical } from "./canonical-hash";
import { canonicalizeEvents, projectCanonicalEvent } from "./canonicalize";

export const ENGINE_VERSION = "0.5.0-rule";

export type FoundationReplay = {
  engineVersion: string;
  inputEventCount: number;
  canonicalEventCount: number;
  duplicateCount: number;
  orderedEventIds: string[];
  canonicalResultHash: string;
  events: TradeEvent[];
};

export function canonicalReplayResultHash(
  events: readonly TradeEvent[],
  evaluation?: RapidPriceLiftResult,
): string {
  return sha256Canonical({
    engineVersion: ENGINE_VERSION,
    events: events.map(projectCanonicalEvent),
    ...(evaluation === undefined ? {} : { evaluation }),
  });
}

export function replayFoundation(input: readonly unknown[]): FoundationReplay {
  const { events, duplicateCount } = canonicalizeEvents(input);
  return {
    engineVersion: ENGINE_VERSION,
    inputEventCount: input.length,
    canonicalEventCount: events.length,
    duplicateCount,
    orderedEventIds: events.map(({ eventId }) => eventId),
    canonicalResultHash: canonicalReplayResultHash(events),
    events,
  };
}
