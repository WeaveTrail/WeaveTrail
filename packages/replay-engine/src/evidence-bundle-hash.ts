import type { EvidenceBundleV13 } from "@weavetrail/contracts";

import { sha256Canonical } from "./canonical-hash";

/** Hash a supplied 1.3 declaration; this neither assembles nor verifies evidence. */
export function evidenceBundleHash(bundle: EvidenceBundleV13): string {
  return sha256Canonical({ ...bundle, bundleHash: undefined });
}
