import type { SeriesAdapter } from "./complete-series.mjs";
import type { SeriesTransport } from "./retrieve-complete-series.mjs";

export const FSC_STOCK_INDEX_ENDPOINT: string;
export const FSC_STOCK_FUTURES_ENDPOINT: string;
export const FSC_OPTIONS_ENDPOINT: string;
export const fscStockIndexAdapter: SeriesAdapter;
export const fscStockFuturesAdapter: SeriesAdapter;
export const fscOptionsAdapter: SeriesAdapter;
export const fscMarketAdapters: Record<string, SeriesAdapter>;
export const fscMarketAdaptersByEndpoint: Record<string, SeriesAdapter>;
export function withFscTransport(
  adapter: SeriesAdapter,
  fetchResponse?: (
    input: URL,
    init: { signal: AbortSignal; redirect: "error" },
  ) => Promise<Response>,
): SeriesTransport;
