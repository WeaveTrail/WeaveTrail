import type {
  CompleteSeriesDeclaration,
  SeriesAdapter,
  SeriesRecord,
  SeriesRequest,
} from "./complete-series.mjs";
export type SeriesTransport = SeriesAdapter & {
  secrets(): string[];
  fetchPage(
    request: SeriesRequest,
    options: { signal: AbortSignal; redirect: "error" },
  ): Promise<Response>;
};
export function retrieveCompleteSeries(
  options: { declaration: CompleteSeriesDeclaration; output: string },
  adapter: SeriesTransport,
): Promise<SeriesRecord>;
