import {
  SourceTraceEventSchema,
  SourceTraceSchema,
  type RapidPriceLiftFinding,
  type SourceTrace,
  type TradeEvent,
} from "@weavetrail/contracts";

import {
  deriveRawRowHash,
  requireUniqueSourceCoordinates,
  type SourceRow,
} from "./source-ingest";

/** Resolve only server-validated canonical events against trusted source rows. */
export function buildFindingSourceTrace(
  events: readonly TradeEvent[],
  findings: readonly Pick<RapidPriceLiftFinding, "referencedEventIds">[],
  rows: readonly SourceRow[],
): SourceTrace {
  requireUniqueSourceCoordinates(rows);
  const byHash = new Map<string, SourceRow>();
  for (const row of rows) {
    const hash = deriveRawRowHash(row);
    if (byHash.has(hash))
      throw new Error("Ambiguous source row hash in finding trace");
    byHash.set(hash, row);
  }
  const references = new Set(
    findings.flatMap((finding) => finding.referencedEventIds),
  );
  const seenIds = new Set<string>();
  const entries: SourceTrace["entries"] = [];
  for (const event of events) {
    if (seenIds.has(event.eventId))
      throw new Error("Ambiguous canonical event ID in finding trace");
    seenIds.add(event.eventId);
    if (!references.has(event.eventId)) continue;
    const sourceRow = byHash.get(event.rawRowHash);
    if (!sourceRow) throw new Error("Missing source row for finding event");
    const projection = Object.fromEntries(
      Object.keys(SourceTraceEventSchema.shape).flatMap((key) => {
        const value = event[key as keyof TradeEvent];
        return value === undefined ? [] : [[key, value]];
      }),
    );
    entries.push({
      event: SourceTraceEventSchema.parse(projection),
      sourceRow,
    });
  }
  if (entries.length !== references.size)
    throw new Error("Missing canonical event for finding reference");
  // Zod returns a deep copy, keeping presentation consumers off shared inputs.
  return SourceTraceSchema.parse({ traceVersion: "1.0", entries });
}
