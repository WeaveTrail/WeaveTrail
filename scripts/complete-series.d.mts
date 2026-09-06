export type CompleteSeriesDeclaration = {
  scope: "complete-series";
  date: string | { kind: "range"; begin: string; endExclusive: string };
  filter: {
    kind:
      | "instrument"
      | "index"
      | "series"
      | "date"
      | "index-family"
      | "instrument-family";
    value: string;
  };
  pageSize: string;
  declaredAt: string;
  permission: {
    status: "UNRESTRICTED";
    label: string;
    checkedAt: string;
    termsUrl: string;
    attribution: string;
  };
};
export type SeriesRequest = {
  endpoint: string;
  parameters: Record<string, string>;
};
export type SeriesAdapter = {
  endpoint: string;
  dateParameter: string;
  rangeParameters?: { begin: string; endExclusive: string };
  pageParameter: string;
  pageSizeParameter: string;
  selectors: Partial<
    Record<
      "instrument" | "index" | "series" | "index-family" | "instrument-family",
      string
    >
  >;
  format?: { parameter: string; value: string };
  decodePage(
    bytes: Uint8Array,
    declaration: CompleteSeriesDeclaration,
  ): {
    pageNumber: string;
    pageSize: string;
    total: string;
    rows: Record<string, string>[];
    identityKeys?: string[];
  };
};
export type SeriesRecord = {
  declaration: CompleteSeriesDeclaration;
  retrievedAt: string;
  pageCount: string;
  publisherTotal: string;
  rowCount: string;
  pages: {
    file: string;
    request: SeriesRequest;
    rowCount: string;
    publisherTotal: string;
    sha256: string;
  }[];
  sourceArtifactHash: string;
  publisherObservations: PublisherObservation[];
};
export type PublisherObservation =
  | {
      kind: "RANGE_END_EXCLUSIVE";
      statement: string;
      evidence: string;
      checkedAt: string;
    }
  | {
      kind: "ROUNDED_DECIMAL";
      column: string;
      decimalPlaces: string;
      statement: string;
      evidence: string;
      checkedAt: string;
    };
export function validateCompleteSeriesDeclaration(
  value: unknown,
): CompleteSeriesDeclaration;
export function completeSeriesRequest(
  declaration: CompleteSeriesDeclaration,
  adapter: SeriesAdapter,
  pageNumber: string,
): SeriesRequest;
export function startCompleteSeries(
  declaration: CompleteSeriesDeclaration,
  adapter: SeriesAdapter,
): {
  declaration: CompleteSeriesDeclaration;
  requestAdapter: Omit<SeriesAdapter, "decodePage">;
  pages: SeriesRecord["pages"];
  rows: Record<string, string>[];
  identityKeys: Set<string>;
  total?: bigint;
};
export function appendCompleteSeriesPage(
  state: ReturnType<typeof startCompleteSeries>,
  bytes: Uint8Array,
  adapter: SeriesAdapter,
): boolean;
export function validateCompleteSeriesArtifact(
  record: unknown,
  rawPages: readonly Uint8Array[],
  jsonl: string,
  adapter: SeriesAdapter,
): SeriesRecord;
