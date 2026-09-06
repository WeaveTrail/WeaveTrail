import type { SourceProvenance } from "@weavetrail/contracts";

export const syntheticSourceProvenance = {
  kind: "synthetic",
  provider: "WeaveTrail",
  attribution: "Synthetic fixtures authored by the WeaveTrail contributors.",
} as const satisfies SourceProvenance;
