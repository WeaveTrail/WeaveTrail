import { describe, expect, it } from "vitest";

import { TradeEventSchema, type TradeEvent } from "@weavetrail/contracts";
import { concentratedBuyEvents } from "@weavetrail/scenarios";
import { canonicalJson, sha256Canonical } from "./canonical-json";
import {
  CanonicalizationError,
  compareCanonicalEventTimes,
  normalizeEventTime,
} from "./canonical-order";
import {
  CANONICAL_EVENT_FIELDS,
  COLLECTION_METADATA_FIELDS,
  projectCanonicalEvent,
} from "./canonicalize";
import { ENGINE_VERSION, replayFoundation } from "./replay-foundation";

function syntheticEvent(overrides: Partial<TradeEvent>): TradeEvent {
  return { ...concentratedBuyEvents[0]!, ...overrides };
}

describe("replayFoundation", () => {
  it("versions the conflict-safe canonical hash definition", () => {
    expect(ENGINE_VERSION).toBe("0.3.0-foundation");
  });

  it("pins the concentrated-buy canonical result hash", () => {
    expect(replayFoundation(concentratedBuyEvents).canonicalResultHash).toBe(
      "42effb2884a481780106155712be7500ae5cffe89ee0c1d89622e62f7dafd4c8",
    );
  });

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

  it("excludes receivedAt from the canonical result hash", () => {
    const baseline = replayFoundation(concentratedBuyEvents);
    const changedReceivedAt = replayFoundation(
      concentratedBuyEvents.map((event, index) =>
        index === 0
          ? { ...event, receivedAt: "2026-08-25T12:34:56.789Z" }
          : event,
      ),
    );

    expect(changedReceivedAt.canonicalResultHash).toBe(
      baseline.canonicalResultHash,
    );
  });

  it("rejects conflicting reuse of a source identity independent of input order", () => {
    const original = concentratedBuyEvents[0]!;
    const conflicting = {
      ...original,
      eventId: "evt-conflicting",
      price: "999.99",
      rawRowHash:
        "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    };
    const attempts = [
      [original, conflicting],
      [conflicting, original],
    ];
    const failures = attempts.map((events) => {
      let replayHash: string | undefined;
      try {
        replayHash = replayFoundation(events).canonicalResultHash;
        throw new Error("expected conflicting identity to fail");
      } catch (error) {
        expect(replayHash).toBeUndefined();
        expect(error).toBeInstanceOf(CanonicalizationError);
        expect(error).toMatchObject({ code: "CONFLICTING_SOURCE_IDENTITY" });
        return (error as Error).message;
      }
    });

    expect(failures[0]).toBe(failures[1]);
    expect(failures[0]).toContain(
      'datasetId="synthetic-concentrated-buy-v1", venueId="SYNTH-X", sourceEventId="source-003"',
    );
  });

  it("uses sequence and event ID as deterministic timestamp tie-breakers", () => {
    const result = replayFoundation(concentratedBuyEvents);
    expect(result.orderedEventIds).toEqual([
      "event:synthetic-concentrated-buy-v1:SYNTH-X:source-001",
      "event:synthetic-concentrated-buy-v1:SYNTH-X:source-002",
      "event:synthetic-concentrated-buy-v1:SYNTH-X:source-003",
      "event:synthetic-concentrated-buy-v1:SYNTH-X:source-004",
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
  it("preserves UTF-16 key order for integer-index keys", () => {
    expect(canonicalJson({ "10": 1, "2": 2, a: 3 })).toBe(
      '{"10":1,"2":2,"a":3}',
    );
  });

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

  it("orders nested keys while preserving array index order", () => {
    expect(
      canonicalJson({ ö: { "2": 2, "10": 1 }, z: [{ ö: 1, z: 2 }, 3] }),
    ).toBe('{"z":[{"z":2,"ö":1},3],"ö":{"10":1,"2":2}}');
  });

  it("rejects non-finite numbers instead of converting them to null", () => {
    for (const value of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(() => canonicalJson(value)).toThrowError(CanonicalizationError);
      try {
        canonicalJson(value);
      } catch (error) {
        expect(error).toMatchObject({ code: "NON_FINITE_NUMBER" });
        expect(error).toHaveProperty(
          "message",
          expect.stringContaining("does not support non-finite numbers"),
        );
      }
    }
    expect(canonicalJson(-0)).toBe("0");
  });
});

describe("canonical event projection", () => {
  it("classifies every TradeEvent field as protected or collection metadata", () => {
    const classifiedFields = [
      ...CANONICAL_EVENT_FIELDS,
      ...COLLECTION_METADATA_FIELDS,
    ].sort();

    expect(classifiedFields).toEqual(
      [...TradeEventSchema.keyof().options].sort(),
    );
    expect(new Set(classifiedFields).size).toBe(classifiedFields.length);
  });

  it.each(CANONICAL_EVENT_FIELDS)(
    "changes the projection hash when protected field %s changes",
    (field) => {
      const projection = projectCanonicalEvent(concentratedBuyEvents[0]!);
      const changedProjection = {
        ...projection,
        [field]: `${String(projection[field])}-changed`,
      };

      expect(sha256Canonical(changedProjection)).not.toBe(
        sha256Canonical(projection),
      );
    },
  );

  it.each(COLLECTION_METADATA_FIELDS)(
    "excludes collection metadata field %s from the projection",
    (field) => {
      expect(
        projectCanonicalEvent(concentratedBuyEvents[0]!),
      ).not.toHaveProperty(field);
    },
  );
});

describe("canonical event time validation", () => {
  const invalidEventTimes = [
    ["month", "2026-00-01T00:00:00Z"],
    ["month", "2026-13-01T00:00:00Z"],
    ["day", "2026-02-29T00:00:00Z"],
    ["day", "2026-04-31T00:00:00Z"],
    ["hour", "2026-01-01T24:00:00Z"],
    ["minute", "2026-01-01T00:60:00Z"],
    ["second", "2026-01-01T00:00:60Z"],
    ["offset hour", "2026-01-01T00:00:00+24:00"],
    ["offset minute", "2026-01-01T00:00:00+00:60"],
  ] as const;

  it.each(invalidEventTimes)(
    "rejects an invalid %s",
    (component, eventTime) => {
      for (const call of [
        () => normalizeEventTime(eventTime),
        () => compareCanonicalEventTimes(eventTime, "2026-01-01T00:00:00Z"),
      ]) {
        try {
          call();
          throw new Error("expected canonicalization to fail");
        } catch (error) {
          expect(error).toBeInstanceOf(CanonicalizationError);
          expect(error).toMatchObject({ code: "UNSUPPORTED_EVENT_TIME" });
          expect(error).toHaveProperty(
            "message",
            expect.stringContaining(component),
          );
        }
      }
    },
  );

  it.each([
    "2024-02-29T00:00:00Z",
    "2026-06-01T00:00:00+23:59",
    "2026-06-01T00:00:00-23:59",
    "0000-01-01T00:00:00Z",
    "9999-12-31T23:59:59.999999999Z",
  ])("normalizes supported boundary value %s", (eventTime) => {
    expect(normalizeEventTime(eventTime)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}Z$/,
    );
  });
});
