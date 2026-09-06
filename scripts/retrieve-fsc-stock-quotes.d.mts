export const FSC_STOCK_QUOTE_ENDPOINT: string;
export function retrieveFscStockQuotes(
  options: {
    basDt: string;
    market: string;
    output: string;
    permissionCheckedAt: string;
  },
  fetchResponse?: typeof fetch,
): Promise<unknown>;
