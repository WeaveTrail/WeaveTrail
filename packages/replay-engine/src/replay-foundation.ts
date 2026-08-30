import type { TradeEvent } from "@weavetrail/contracts";

import { sha256Canonical } from "./canonical-json";
import { canonicalizeEvents, projectCanonicalEvent } from "./canonicalize";

export const ENGINE_VERSION = "0.2.0-foundation";

export type FoundationReplay = {
  engineVersion: string;
  inputEventCount: number;
  canonicalEventCount: number;
  duplicateCount: number;
  orderedEventIds: string[];
  canonicalResultHash: string;
  events: TradeEvent[];
};

export function replayFoundation(input: readonly unknown[]): FoundationReplay {
  const { events, duplicateCount } = canonicalizeEvents(input);
  const stablePayload = {
    engineVersion: ENGINE_VERSION,
    events: events.map(projectCanonicalEvent),
  };

  return {
    engineVersion: ENGINE_VERSION,
    inputEventCount: input.length,
    canonicalEventCount: events.length,
    duplicateCount,
    orderedEventIds: events.map(({ eventId }) => eventId),
    canonicalResultHash: sha256Canonical(stablePayload),
    events,
  };
}
