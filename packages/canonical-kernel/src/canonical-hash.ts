import { createHash } from "node:crypto";

import { canonicalJson, type CanonicalJsonInput } from "./canonical-json";

export function sha256Canonical(value: CanonicalJsonInput): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
