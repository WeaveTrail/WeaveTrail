export function validTradingDate(value: unknown): boolean;
export function deriveFscStockQuotes(
  bytes: Uint8Array,
  window: { basDt: string; market: string },
): {
  jsonl: string;
  generatedRows: string;
  rows: {
    coordinate: { sourceArtifactHash: string; rowNumber: string };
    values: Record<string, string>;
  }[];
  rawResponseHash: string;
  sourceArtifactHash: string;
  generatedRowsHash: string;
  columns: string[];
  pagination: {
    pageNo: number | string;
    numOfRows: number | string;
    totalCount: number | string;
  };
};
