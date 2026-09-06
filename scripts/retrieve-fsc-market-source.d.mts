import type { PublisherObservation, SeriesRecord } from "./complete-series.mjs";

export function retrieveFscMarketSource(options: {
  adapterName: string;
  declarationPath: string;
  output: string;
  publisherObservations?: PublisherObservation[];
}): Promise<SeriesRecord>;
