import type {
  CrossMarketSessionReversalResult,
  RapidPriceLiftResult,
  TradeEvent,
} from "@weavetrail/contracts";

import { sha256Canonical } from "./canonical-hash";
import { canonicalizeEvents, projectCanonicalEvent } from "./canonicalize";

export const ENGINE_VERSION = "0.7.0-canonical-decimal";

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
  evaluation?: RapidPriceLiftResult | CrossMarketSessionReversalResult,
  engineVersion = ENGINE_VERSION,
): string {
  return sha256Canonical({
    engineVersion,
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
