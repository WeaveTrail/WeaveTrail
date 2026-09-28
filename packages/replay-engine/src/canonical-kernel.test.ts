import { describe, expect, it } from "vitest";
import * as kernel from "@weavetrail/canonical-kernel";
import { canonicalJson } from "@weavetrail/replay-engine/canonical-json";
import * as engine from "@weavetrail/replay-engine";

describe("canonical kernel compatibility", () => {
  it("retains every kernel runtime export and error identity at the engine entry", () => {
    for (const key of Object.keys(kernel) as (keyof typeof kernel)[]) {
      expect(engine[key], key).toBe(kernel[key]);
    }
    expect(canonicalJson).toBe(kernel.canonicalJson);
    expect(() => canonicalJson([undefined])).toThrow(
      kernel.CanonicalizationError,
    );
  });

  it("orders domain-neutral keys by instant, exact sequence, then UTF-16 identifier", () => {
    const keys = [
      {
        eventTime: "2026-01-01T09:00:00+09:00",
        sequence: "9007199254740993",
        eventId: "A",
      },
      {
        eventTime: "2026-01-01T00:00:00Z",
        sequence: "9007199254740992",
        eventId: "z",
      },
      {
        eventTime: "2026-01-01T00:00:00Z",
        sequence: "09007199254740992",
        eventId: "Z",
      },
      {
        eventTime: "2025-12-31T23:59:59.999999999Z",
        sequence: "9999999999999999",
        eventId: "earlier",
      },
    ];
    const expected = ["earlier", "Z", "z", "A"];
    expect(
      [...keys].sort(kernel.compareCanonicalEvents).map((key) => key.eventId),
    ).toEqual(expected);
    expect(
      [...keys]
        .reverse()
        .sort(kernel.compareCanonicalEvents)
        .map((key) => key.eventId),
    ).toEqual(expected);
  });
});
