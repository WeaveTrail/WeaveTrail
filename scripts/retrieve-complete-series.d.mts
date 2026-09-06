import type {
  CompleteSeriesDeclaration,
  PublisherObservation,
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
  options: {
    declaration: CompleteSeriesDeclaration;
    output: string;
    publisherObservations?: PublisherObservation[];
  },
  adapter: SeriesTransport,
): Promise<SeriesRecord>;
