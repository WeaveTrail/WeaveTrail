import {
  PublicSourceSchema,
  type PublicSource,
  type SnapshotReference,
} from "@weavetrail/contracts";
import type { SnapshotStore } from "./snapshot-store";

/** Operator-selected, unauthenticated public endpoints only; no browser URL input. */
export async function collectPublicSource(
  store: SnapshotStore,
  source: PublicSource,
  fetchResponse: typeof fetch = globalThis.fetch,
): Promise<SnapshotReference> {
  const admitted = PublicSourceSchema.parse(source);
  let bytes: Uint8Array;
  try {
    const response = await fetchResponse(admitted.originUrl, {
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
      credentials: "omit",
    });
    if (!response.ok || response.redirected || response.status === 206) {
      throw new Error("Incomplete or unsuccessful public response");
    }
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    throw new Error(
      "Public source collection failed at the transport boundary",
    );
  }
  return store.storeSnapshot(bytes, {
    source: admitted,
    retrievedAt: new Date().toISOString(),
  });
}
