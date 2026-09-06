import process from "node:process";

import { validTradingDate } from "./derive-fsc-stock-quotes.mjs";

export const FSC_STOCK_INDEX_ENDPOINT =
  "https://apis.data.go.kr/1160100/service/GetMarketIndexInfoService/getStockMarketIndex";
export const FSC_STOCK_FUTURES_ENDPOINT =
  "https://apis.data.go.kr/1160100/service/GetDerivativeProductInfoService/getStockFuturesPriceInfo";
export const FSC_OPTIONS_ENDPOINT =
  "https://apis.data.go.kr/1160100/service/GetDerivativeProductInfoService/getOptionsPriceInfo";

const stockIndexColumns = [
  "lsYrEdVsFltRt",
  "basPntm",
  "basIdx",
  "basDt",
  "idxCsf",
  "idxNm",
  "epyItmsCnt",
  "clpr",
  "vs",
  "fltRt",
  "mkp",
  "hipr",
  "lopr",
  "trqu",
  "trPrc",
  "lstgMrktTotAmt",
  "lsYrEdVsFltRg",
  "yrWRcrdHgst",
  "yrWRcrdHgstDt",
  "yrWRcrdLwst",
  "yrWRcrdLwstDt",
];

const stockFuturesColumns = [
  "basDt",
  "prdCtg",
  "srtnCd",
  "isinCd",
  "itmsNm",
  "clpr",
  "vs",
  "mkp",
  "hipr",
  "lopr",
  "sptPrc",
  "stmPrc",
  "trqu",
  "trPrc",
  "opnint",
];

const optionsColumns = [
  "vs",
  "mkp",
  "hipr",
  "lopr",
  "nxtDdBsPrc",
  "iptVlty",
  "trqu",
  "trPrc",
  "opnint",
  "clpr",
  "basDt",
  "prdCtg",
  "srtnCd",
  "isinCd",
  "itmsNm",
];

const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function integerString(value) {
  if (
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) ||
    (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value))
  )
    return String(value);
  throw new Error("Publisher pagination is not a canonical integer");
}

function selectedDates(declaration) {
  return typeof declaration.date === "string"
    ? { begin: declaration.date, endExclusive: undefined }
    : declaration.date;
}

function sameColumns(row, expected) {
  const actual = Object.keys(row);
  return (
    actual.length === expected.length &&
    expected.every((column) => Object.hasOwn(row, column))
  );
}

function decoder({ columns, filterColumn, identity }) {
  return (bytes, declaration) => {
    let envelope;
    try {
      envelope = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      throw new Error("Publisher response must be a UTF-8 JSON envelope");
    }
    const response = envelope?.response;
    if (!object(response) || response.header?.resultCode !== "00")
      throw new Error("Publisher response is not successful");
    const body = response.body;
    const rows = body?.items?.item;
    if (!object(body) || !Array.isArray(rows))
      throw new Error("Publisher response does not expose an item array");

    const dates = selectedDates(declaration);
    const seen = new Set();
    for (const row of rows) {
      if (
        !object(row) ||
        Object.values(row).some((value) => typeof value !== "string") ||
        !sameColumns(row, columns) ||
        !validTradingDate(row.basDt) ||
        row.basDt < dates.begin ||
        (dates.endExclusive === undefined
          ? row.basDt !== dates.begin
          : row.basDt >= dates.endExclusive) ||
        (declaration.filter.kind === "index"
          ? row[filterColumn] !== declaration.filter.value
          : !row[filterColumn]?.includes(declaration.filter.value))
      )
        throw new Error(
          "Publisher row violates the declared date, family or column scope",
        );
      const key = identity(row);
      if (!key || seen.has(key))
        throw new Error("Publisher row identity is missing or duplicated");
      seen.add(key);
    }
    return {
      pageNumber: integerString(body.pageNo),
      pageSize: integerString(body.numOfRows),
      total: integerString(body.totalCount),
      rows,
      identityKeys: rows.map(identity),
    };
  };
}

const common = {
  dateParameter: "basDt",
  rangeParameters: { begin: "beginBasDt", endExclusive: "endBasDt" },
  pageParameter: "pageNo",
  pageSizeParameter: "numOfRows",
  format: { parameter: "resultType", value: "json" },
};

export const fscStockIndexAdapter = {
  ...common,
  endpoint: FSC_STOCK_INDEX_ENDPOINT,
  selectors: { index: "idxNm", "index-family": "likeIdxNm" },
  decodePage: decoder({
    columns: stockIndexColumns,
    filterColumn: "idxNm",
    identity: (row) => `${row.basDt}\u0000${row.idxNm}\u0000${row.idxCsf}`,
  }),
};

export const fscStockFuturesAdapter = {
  ...common,
  endpoint: FSC_STOCK_FUTURES_ENDPOINT,
  selectors: { "instrument-family": "likeItmsNm" },
  decodePage: decoder({
    columns: stockFuturesColumns,
    filterColumn: "itmsNm",
    identity: (row) => `${row.basDt}\u0000${row.srtnCd}\u0000${row.isinCd}`,
  }),
};

export const fscOptionsAdapter = {
  ...common,
  endpoint: FSC_OPTIONS_ENDPOINT,
  selectors: { "instrument-family": "likeItmsNm" },
  decodePage: decoder({
    columns: optionsColumns,
    filterColumn: "itmsNm",
    identity: (row) => `${row.basDt}\u0000${row.srtnCd}\u0000${row.isinCd}`,
  }),
};

export const fscMarketAdapters = {
  "stock-index": fscStockIndexAdapter,
  "stock-futures": fscStockFuturesAdapter,
  options: fscOptionsAdapter,
};

export const fscMarketAdaptersByEndpoint = Object.fromEntries(
  Object.values(fscMarketAdapters).map((adapter) => [
    adapter.endpoint,
    adapter,
  ]),
);

function credentials() {
  const suppliedKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!suppliedKey) throw new Error("DATA_GO_KR_SERVICE_KEY is not configured");
  let key;
  try {
    key = decodeURIComponent(suppliedKey);
  } catch {
    throw new Error("Service key encoding is invalid");
  }
  return { suppliedKey, key };
}

export function withFscTransport(adapter, fetchResponse = globalThis.fetch) {
  const { suppliedKey, key } = credentials();
  return {
    ...adapter,
    secrets: () => [suppliedKey, key],
    async fetchPage(request, options) {
      const url = new URL(request.endpoint);
      url.search = new URLSearchParams({
        ...request.parameters,
        serviceKey: key,
      }).toString();
      return fetchResponse(url, options);
    },
  };
}
