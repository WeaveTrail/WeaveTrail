import {
  DatasetProfileSchema,
  type DatasetProfile,
} from "@weavetrail/contracts";

import { sha256Canonical } from "./canonical-hash";
import { compareUtf16CodeUnits } from "./canonical-order";
import { canonicalizeEvents, projectCanonicalEvent } from "./canonicalize";

function sortedDistinct(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16CodeUnits);
}

export function computeDatasetProfile(
  input: readonly unknown[],
): DatasetProfile {
  const { events } = canonicalizeEvents(input);
  const firstEvent = events[0];
  const lastEvent = events.at(-1);

  if (firstEvent === undefined || lastEvent === undefined) {
    throw new Error("A dataset profile requires at least one canonical event");
  }

  const actorIds = events.flatMap(({ actorId }) =>
    actorId === undefined ? [] : [actorId],
  );

  return DatasetProfileSchema.parse({
    canonicalDatasetHash: sha256Canonical(events.map(projectCanonicalEvent)),
    instrumentIds: sortedDistinct(
      events.map(({ instrumentId }) => instrumentId),
    ),
    actorIds: sortedDistinct(actorIds),
    earliestEventTime: firstEvent.eventTime,
    latestEventTime: lastEvent.eventTime,
  });
}
