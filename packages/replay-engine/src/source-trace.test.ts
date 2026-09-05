import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  committedReplayScenarios,
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
} from "@weavetrail/scenarios";
import * as sourceIngest from "./source-ingest";
import { buildFindingSourceTrace } from "./source-trace";
import {
  applyApprovedMapping,
  deriveRawRowHash,
  parseCsvSourceArtifact,
  parseJsonLinesSourceArtifact,
} from "./source-ingest";
import { replayFoundation } from "./replay-foundation";

function fixture(
  name: "concentrated-buy-dialect-a.csv" | "concentrated-buy-dialect-b.jsonl",
) {
  const bytes = readFileSync(
    new URL(`../../scenarios/src/sources/${name}`, import.meta.url),
  );
  const parser = name.endsWith(".csv")
    ? parseCsvSourceArtifact
    : parseJsonLinesSourceArtifact;
  const rows = parser(bytes, committedReplayScenarios[name].sourceArtifactHash);
  const mapped = applyApprovedMapping(
    rows,
    name.endsWith(".csv")
      ? concentratedBuyDialectAMapping
      : concentratedBuyDialectBMapping,
  );
  if (mapped.status !== "APPROVED") throw new Error("Fixture mapping rejected");
  const { events } = replayFoundation(mapped.events);
  const findings = [
    { referencedEventIds: events.map(({ eventId }) => eventId).reverse() },
    { referencedEventIds: [events[0]!.eventId] },
  ];
  return { rows, events, findings };
}

describe("finding source trace", () => {
  it.each([
    "concentrated-buy-dialect-a.csv",
    "concentrated-buy-dialect-b.jsonl",
  ] as const)(
    "resolves %s from artifact bytes in canonical order without mutation",
    (name) => {
      const input = fixture(name);
      const before = structuredClone(input);
      const trace = buildFindingSourceTrace(
        input.events,
        input.findings,
        input.rows,
      );
      expect(trace.entries.map(({ event }) => event.eventId)).toEqual(
        input.events.map(({ eventId }) => eventId),
      );
      for (const entry of trace.entries) {
        const matches = input.rows.filter(
          (row) => deriveRawRowHash(row) === entry.event.rawRowHash,
        );
        expect(matches).toEqual([entry.sourceRow]);
        expect(entry.event).not.toHaveProperty("receivedAt");
      }
      expect(
        buildFindingSourceTrace(
          input.events,
          input.findings,
          [...input.rows].reverse(),
        ),
      ).toEqual(trace);
      expect(
        buildFindingSourceTrace(
          replayFoundation([...input.events, input.events[0]!]).events,
          input.findings,
          input.rows,
        ),
      ).toEqual(trace);
      trace.entries[0]!.sourceRow.values.changed = "presentation edit";
      trace.entries[0]!.sourceRow.coordinate.rowNumber = "999";
      trace.entries[0]!.event.price = "999";
      expect(input).toEqual(before);
    },
  );

  it("does not borrow evidence when there are no findings", () => {
    const { events, rows } = fixture("concentrated-buy-dialect-a.csv");
    expect(buildFindingSourceTrace(events, [], rows)).toEqual({
      traceVersion: "1.0",
      entries: [],
    });
  });

  it.each([
    "missing event",
    "duplicate event",
    "missing row",
    "duplicate coordinate",
    "changed row",
    "conflicting coordinate",
  ] as const)("rejects %s instead of producing partial evidence", (kind) => {
    const { events, rows, findings } = fixture(
      "concentrated-buy-dialect-a.csv",
    );
    if (kind === "missing event") events.pop();
    if (kind === "duplicate event") events.push(events[0]!);
    if (kind === "missing row") rows.pop();
    if (kind === "duplicate coordinate") rows.push(structuredClone(rows[0]!));
    if (kind === "changed row") rows[0]!.values.px = "999";
    if (kind === "conflicting coordinate")
      rows.push({ ...rows[0]!, values: { px: "999" } });
    expect(() => buildFindingSourceTrace(events, findings, rows)).toThrow();
  });
});

it("rejects ambiguous raw-row hash resolutions rather than overwriting", () => {
  const { events, rows, findings } = fixture("concentrated-buy-dialect-a.csv");
  const hash = vi
    .spyOn(sourceIngest, "deriveRawRowHash")
    .mockReturnValue("a".repeat(64));
  try {
    expect(() => buildFindingSourceTrace(events, findings, rows)).toThrow(
      "Ambiguous source row hash",
    );
  } finally {
    hash.mockRestore();
  }
});
