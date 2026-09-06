import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendCompleteSeriesPage,
  completeSeriesRequest,
  startCompleteSeries,
  validateCompleteSeriesDeclaration,
  type CompleteSeriesDeclaration,
} from "../../../scripts/complete-series.mjs";
import {
  FSC_OPTIONS_ENDPOINT,
  FSC_STOCK_FUTURES_ENDPOINT,
  FSC_STOCK_INDEX_ENDPOINT,
  fscOptionsAdapter,
  fscStockFuturesAdapter,
  fscStockIndexAdapter,
  withFscTransport,
} from "../../../scripts/fsc-market-adapters.mjs";

const permission = {
  status: "UNRESTRICTED" as const,
  label: "Synthetic permission",
  checkedAt: "2026-09-06T00:00:00.000Z",
  termsUrl: "https://example.invalid/terms",
  attribution: "Synthetic adapter test",
};

const indexDeclaration: CompleteSeriesDeclaration = {
  scope: "complete-series",
  date: { kind: "range", begin: "20260701", endExclusive: "20260904" },
  filter: { kind: "index-family", value: "코스피 200" },
  pageSize: "200",
  declaredAt: "2026-09-06T00:00:01.000Z",
  permission,
};

const indexRow = {
  lsYrEdVsFltRt: "1.25",
  basPntm: "19900103",
  basIdx: "100",
  basDt: "20260903",
  idxCsf: "KOSPI시리즈",
  idxNm: "코스피 200",
  epyItmsCnt: "200",
  clpr: "500.01",
  vs: "1.23",
  fltRt: ".25",
  mkp: "499.00",
  hipr: "501.00",
  lopr: "498.00",
  trqu: "123",
  trPrc: "456",
  lstgMrktTotAmt: "789",
  lsYrEdVsFltRg: "10.1",
  yrWRcrdHgst: "510.00",
  yrWRcrdHgstDt: "20260801",
  yrWRcrdLwst: "400.00",
  yrWRcrdLwstDt: "20260102",
};

const derivativeBase = {
  basDt: "20260903",
  prdCtg: "파생 상품",
  srtnCd: "SYNTH001",
  isinCd: "KR4SYNTH0001",
  itmsNm: "코스피200 위클리 synthetic",
  clpr: "1.00",
  vs: "0.10",
  mkp: ".90",
  hipr: "1.10",
  lopr: ".80",
  trqu: "12",
  trPrc: "34",
  opnint: "56",
};

const envelope = (
  rows: Record<string, string>[],
  pageNo = 1,
  numOfRows = 200,
  totalCount = rows.length,
) =>
  new TextEncoder().encode(
    JSON.stringify({
      response: {
        header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
        body: {
          numOfRows,
          pageNo,
          totalCount,
          items: { item: rows },
        },
      },
    }),
  );

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("reviewed FSC market adapters", () => {
  it("binds the documented range and family parameters without value predicates", () => {
    const declaration = validateCompleteSeriesDeclaration(indexDeclaration);
    expect(
      completeSeriesRequest(declaration, fscStockIndexAdapter, "1"),
    ).toEqual({
      endpoint: FSC_STOCK_INDEX_ENDPOINT,
      parameters: {
        beginBasDt: "20260701",
        endBasDt: "20260904",
        pageNo: "1",
        numOfRows: "200",
        likeIdxNm: "코스피 200",
        resultType: "json",
      },
    });
    expect(() =>
      validateCompleteSeriesDeclaration({
        ...indexDeclaration,
        date: {
          kind: "range",
          begin: "20260701",
          endExclusive: "20260904",
          value: "100",
        },
      }),
    ).toThrow();
    expect(
      completeSeriesRequest(
        validateCompleteSeriesDeclaration({
          ...indexDeclaration,
          filter: { kind: "index", value: "코스피 200" },
        }),
        fscStockIndexAdapter,
        "1",
      ).parameters,
    ).toMatchObject({ idxNm: "코스피 200" });
  });

  it("exposes every documented index, futures and option column unchanged", () => {
    const index = fscStockIndexAdapter.decodePage(
      envelope([indexRow]),
      indexDeclaration,
    );
    expect(index.rows).toEqual([indexRow]);

    const futuresDeclaration: CompleteSeriesDeclaration = {
      ...indexDeclaration,
      date: "20260903",
      filter: { kind: "instrument-family", value: "코스피200" },
    };
    const futuresRow = {
      ...derivativeBase,
      itmsNm: "코스피200 F synthetic",
      sptPrc: "500.01",
      stmPrc: "500.10",
    };
    expect(
      fscStockFuturesAdapter.decodePage(
        envelope([futuresRow]),
        futuresDeclaration,
      ).rows,
    ).toEqual([futuresRow]);

    const optionDeclaration: CompleteSeriesDeclaration = {
      ...futuresDeclaration,
      filter: { kind: "instrument-family", value: "위클리" },
    };
    const optionRow = {
      ...derivativeBase,
      nxtDdBsPrc: "1.05",
      iptVlty: "12.34",
    };
    expect(
      fscOptionsAdapter.decodePage(envelope([optionRow]), optionDeclaration)
        .rows,
    ).toEqual([optionRow]);
  });

  it("requires equality for an exact index selector", () => {
    expect(() =>
      fscStockIndexAdapter.decodePage(
        envelope([{ ...indexRow, idxNm: "코스피 200 정보기술" }]),
        {
          ...indexDeclaration,
          filter: { kind: "index", value: "코스피 200" },
        },
      ),
    ).toThrow("declared date, family or column scope");
  });

  it("rejects a publisher identity repeated across page boundaries", () => {
    const declaration = validateCompleteSeriesDeclaration({
      ...indexDeclaration,
      date: "20260903",
      filter: { kind: "index-family", value: "코스피" },
      pageSize: "1",
    });
    const state = startCompleteSeries(declaration, fscStockIndexAdapter);
    expect(
      appendCompleteSeriesPage(
        state,
        envelope([indexRow], 1, 1, 2),
        fscStockIndexAdapter,
      ),
    ).toBe(false);
    expect(() =>
      appendCompleteSeriesPage(
        state,
        envelope([{ ...indexRow, clpr: "501.00" }], 2, 1, 2),
        fscStockIndexAdapter,
      ),
    ).toThrow("identity is missing or duplicated");
  });

  it.each([
    [{ ...indexRow, extra: "not-declared" }],
    [{ ...indexRow, basDt: "20260904" }],
    [{ ...indexRow, idxNm: "코스닥 150" }],
    [indexRow, indexRow],
  ])("refuses rows outside the declared index scope", (...rows) => {
    expect(() =>
      fscStockIndexAdapter.decodePage(envelope(rows), indexDeclaration),
    ).toThrow();
  });

  it("keeps credentials inside transport and out of recorded requests", async () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "synthetic%2Bkey");
    const fetchResponse = vi.fn(async (url: URL) => {
      expect(url.searchParams.get("serviceKey")).toBe("synthetic+key");
      return new Response("{}");
    });
    const transport = withFscTransport(fscOptionsAdapter, fetchResponse);
    const request = {
      endpoint: FSC_OPTIONS_ENDPOINT,
      parameters: { basDt: "20260903" },
    };
    expect(JSON.stringify(request)).not.toContain("synthetic");
    await transport.fetchPage(request, {
      signal: AbortSignal.timeout(1_000),
      redirect: "error",
    });
    expect(transport.secrets()).toEqual(["synthetic%2Bkey", "synthetic+key"]);
    expect(FSC_STOCK_FUTURES_ENDPOINT).not.toBe(FSC_OPTIONS_ENDPOINT);
  });
});
