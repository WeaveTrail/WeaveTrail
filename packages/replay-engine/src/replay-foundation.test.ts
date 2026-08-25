import { describe, expect, it } from "vitest";

import { concentratedBuyEvents } from "@weavetrail/scenarios";
import { replayFoundation } from "./replay-foundation";

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
});
