import { sha256Canonical } from "./canonical-hash";
import { canonicalizeEvents, projectCanonicalEvent } from "./canonicalize";

export function canonicalDatasetHash(input: readonly unknown[]): string {
  const { events } = canonicalizeEvents(input);
  return sha256Canonical(events.map(projectCanonicalEvent));
}
