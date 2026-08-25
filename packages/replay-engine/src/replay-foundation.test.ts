import { describe, expect, it } from "vitest";

import type { TradeEvent } from "@weavetrail/contracts";
import { concentratedBuyEvents } from "@weavetrail/scenarios";
import { canonicalJson } from "./canonical-json";
import { CanonicalizationError, normalizeEventTime } from "./canonical-order";
import { replayFoundation } from "./replay-foundation";

function syntheticEvent(overrides: Partial<TradeEvent>): TradeEvent {
  return { ...concentratedBuyEvents[0]!, ...overrides };
}

describe("replayFoundation", () => {
  it("produces the same canonical result after row shuffling", () => {
    const baseline = replayFoundation(concentratedBuyEvents);
    const shuffled = replayFoundation([
      concentratedBuyEvents[2],
      concentratedBuyEvents[0],
      concentratedBuyEvents[3],
      concentratedBuyEvents[1],
    ]);

    expect(shuffled.orderedEventIds).toEqual(baseline.orderedEventIds);
    expect(shuffled.canonicalResultHash).toBe(baseline.canonicalResultHash);
  });

  it("ignores an exact source-row duplicate", () => {
    const baseline = replayFoundation(concentratedBuyEvents);
    const withDuplicate = replayFoundation([
      ...concentratedBuyEvents,
      concentratedBuyEvents[1],
    ]);

    expect(withDuplicate.duplicateCount).toBe(1);
    expect(withDuplicate.events).toEqual(baseline.events);
    expect(withDuplicate.canonicalResultHash).toBe(
      baseline.canonicalResultHash,
    );
  });

  it("uses sequence and event ID as deterministic timestamp tie-breakers", () => {
    const result = replayFoundation(concentratedBuyEvents);
    expect(result.orderedEventIds).toEqual([
      "evt-001",
      "evt-002",
      "evt-003",
      "evt-004",
    ]);
  });

  it("normalizes equivalent offset and Z event times before hashing", () => {
    const baseline = replayFoundation(concentratedBuyEvents);
    const offsetNotation = replayFoundation(
      concentratedBuyEvents.map((event) => ({
        ...event,
        eventTime: event.eventTime
          .replace("T00:", "T09:")
          .replace("Z", "+09:00"),
      })),
    );

    expect(offsetNotation.events).toEqual(baseline.events);
    expect(offsetNotation.canonicalResultHash).toBe(
      baseline.canonicalResultHash,
    );
    expect(baseline.events[0]?.eventTime).toBe(
      "2026-08-25T00:00:00.000000000Z",
    );
  });

  it("normalizes explicit offsets across a UTC date boundary", () => {
    expect(normalizeEventTime("2026-01-01T00:30:00+01:00")).toBe(
      "2025-12-31T23:30:00.000000000Z",
    );
  });

  it("preserves event ordering within one millisecond", () => {
    const later = syntheticEvent({
      eventId: "evt-earlier-sequence",
      sourceEventId: "source-submillisecond-later",
      eventTime: "2026-08-25T00:00:00.000000800Z",
      sequence: "1",
      rawRowHash:
        "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    });
    const earlier = syntheticEvent({
      eventId: "evt-later-sequence",
      sourceEventId: "source-submillisecond-earlier",
      eventTime: "2026-08-25T00:00:00.000000100Z",
      sequence: "2",
      rawRowHash:
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    });

    expect(replayFoundation([later, earlier]).orderedEventIds).toEqual([
      "evt-later-sequence",
      "evt-earlier-sequence",
    ]);
  });

  it("uses UTF-16 code-unit order for equal-time and equal-sequence event IDs", () => {
    const umlautId = syntheticEvent({
      eventId: "evt-ödipus",
      sourceEventId: "source-umlaut",
      eventTime: "2026-08-25T00:00:00Z",
      sequence: "7",
      rawRowHash:
        "1111111111111111111111111111111111111111111111111111111111111111",
    });
    const asciiId = syntheticEvent({
      eventId: "evt-zebra",
      sourceEventId: "source-ascii",
      eventTime: "2026-08-25T00:00:00.000000000Z",
      sequence: "7",
      rawRowHash:
        "2222222222222222222222222222222222222222222222222222222222222222",
    });

    expect(replayFoundation([umlautId, asciiId]).orderedEventIds).toEqual([
      "evt-zebra",
      "evt-ödipus",
    ]);
  });

  it("uses event ID when every equal-time event omits sequence", () => {
    const laterId = syntheticEvent({
      eventId: "evt-b",
      sourceEventId: "source-without-sequence-b",
      eventTime: "2026-08-25T00:00:00Z",
      rawRowHash:
        "4444444444444444444444444444444444444444444444444444444444444444",
    });
    const earlierId = syntheticEvent({
      eventId: "evt-a",
      sourceEventId: "source-without-sequence-a",
      eventTime: "2026-08-25T00:00:00Z",
      rawRowHash:
        "5555555555555555555555555555555555555555555555555555555555555555",
    });
    delete laterId.sequence;
    delete earlierId.sequence;

    expect(replayFoundation([laterId, earlierId]).orderedEventIds).toEqual([
      "evt-a",
      "evt-b",
    ]);
  });

  it("fails closed when sequence presence is mixed", () => {
    const withoutSequence = syntheticEvent({
      eventId: "evt-without-sequence",
      sourceEventId: "source-without-sequence",
      rawRowHash:
        "3333333333333333333333333333333333333333333333333333333333333333",
    });
    delete withoutSequence.sequence;

    expect(() =>
      replayFoundation([concentratedBuyEvents[0], withoutSequence]),
    ).toThrowError(CanonicalizationError);
    expect(() =>
      replayFoundation([concentratedBuyEvents[0], withoutSequence]),
    ).toThrowError(/may not mix events with and without sequence values/);
  });

  it("rejects event times finer than the supported nanosecond precision", () => {
    const unsupported = syntheticEvent({
      eventTime: "2026-08-25T00:00:00.1234567890Z",
    });

    expect(() => replayFoundation([unsupported])).toThrowError(
      /at most nanosecond precision/,
    );
  });
});

describe("canonicalJson", () => {
  it("orders non-ASCII keys by UTF-16 code units without locale data", () => {
    expect(
      canonicalJson({
        ödipus: 1,
        zebra: 2,
        evt_a: 3,
        "evt-B": 4,
      }),
    ).toBe('{"evt-B":4,"evt_a":3,"zebra":2,"ödipus":1}');
  });
});
