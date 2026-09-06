import type { SeriesAdapter } from "./complete-series.mjs";
export function verifyPublishedAcquisitions(
  directory: string,
  adapters?: Record<string, SeriesAdapter>,
): Promise<number>;
