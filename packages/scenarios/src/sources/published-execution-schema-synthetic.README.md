# Published-schema synthetic executions

These two source artifacts are wholly synthetic projections of the same six
executions. No market response was requested, retrieved, committed or used to
choose their values. They demonstrate normalization against published field
definitions and market rules, not resemblance to observed prices, quantities,
accounts or trading patterns.

## Source shapes

- `published-execution-fix44.csv` uses the names and tags carried by the FIX
  4.4 `ExecutionReport`: `ExecID(17)`, `TransactTime(60)`, `Symbol(55)`,
  `Side(54)`, `LastPx(31)`, `LastQty(32)` and `Account(1)`. FIX Trading
  Community documents those fields in the
  [FIX 4.4 ExecutionReport](https://fiximate.fixtrading.org/legacy/en/FIX.4.4/body_5756.html)
  and the
  [FIX UTC timestamp datatype](https://fiximate.fixtrading.org/legacy/en/FIX.4.4/fix_datatypes.html).
- `published-execution-h0stcnt0.jsonl` is a selected-field projection of the
  domestic-stock real-time execution response for TR `H0STCNT0`. Korea
  Investment & Securities lists `MKSC_SHRN_ISCD`, `STCK_CNTG_HOUR`,
  `STCK_PRPR`, `CNTG_VOL`, `CCLD_DVSN` and `BSOP_DATE` in its
  [official response-column example](https://github.com/koreainvestment/open-trading-api/blob/b4e6249714418aa57833d1cbbbced39cbcc5b125/examples_llm/domestic_stock/ccnl_krx/ccnl_krx.py).
  Its
  [official field-name map](https://github.com/koreainvestment/open-trading-api/blob/b4e6249714418aa57833d1cbbbced39cbcc5b125/examples_llm/domestic_stock/ccnl_krx/chk_ccnl_krx.py)
  describes these as instrument, execution time, current price, execution
  quantity, execution classification and business date. The repository's
  [official WebSocket sample](https://github.com/koreainvestment/open-trading-api/blob/b4e6249714418aa57833d1cbbbced39cbcc5b125/legacy/Sample01/kis_domstk_ws.py)
  defines `CCLD_DVSN` value `1` as buy and `5` as sell.

The H0STCNT0 response-column list contains no participant or account column.
Its mapping therefore records `actorId` as absent and `REVIEW_REQUIRED`; it
does not copy, infer or synthesize the FIX account. Because the FIX projection
does carry a synthetic account, the two projections agree on every canonical
field their published schemas share but intentionally produce different
canonical dataset hashes.

## Synthetic identity and market-rule conformance

`ZZ79X1` is deliberately not a six-digit domestic listing code, so it cannot
name an assigned listing. Every account starts with `SYNTH-ACCOUNT-`; none
identifies a person, customer or production account. These values are synthetic
wherever the artifacts are shown. No real listed issuer, account or order is
represented.

The executions run from 10:00:00 through 10:00:05 Korea Standard Time, inside
the Korea Exchange regular session of 09:00–15:30. Prices are between KRW
10,000 and KRW 50,000 and every price is a multiple of the published KRW 50
tick for that KOSPI price band. The rules are recorded in the Korea Exchange
[Guide to Trading in the Korean Stock Market](https://global.krx.co.kr/contents/GLB/01/0109/0109000000/guide_to_trading_in_the_korean_stock_market.pdf)
and its current [trading-hours page](https://global.krx.co.kr/contents/GLB/06/0602/0602020204/GLB0602020204T1.jsp).

All linked specifications and rule documents were checked on 2026-09-08. The
Korea Investment & Securities links are pinned to commit
`b4e6249714418aa57833d1cbbbced39cbcc5b125`; the artifacts copy no response
bytes from that repository.

## Reproduction and limits

The committed FIX projection produces these engine-captured literals:

- source artifact hash:
  `f623c3327251b5323b07d066cb940bee0ac0ed895c39fb81707469ae1e1f958b`
- canonical dataset hash:
  `8ff6d5cd9b8c5362e9bcfd9337a8c52c5cbfb226eba29c10d353134e39c0d3c5`
- canonical `SUPPORTED` result hash:
  `46879311285315bde660914487063074b8ea45ce186beef230e57f1691662d6a`

Reproduce the parser rows, cross-dialect agreement, approval refusal, golden
result and finding-to-row trace with:

```bash
pnpm exec vitest run packages/replay-engine/src/published-execution-schema.test.ts
```

The captured environment is Node 22.18.0, pnpm 10.33.2, Vitest 4.1.11 and Linux
WSL2 x86_64. This single deterministic synthetic case measures neither mapping
quality nor detection performance. `SUPPORTED` means only that its approved FIX
projection satisfies the declared `RAPID_PRICE_LIFT` 1.1 thresholds. It is not
market evidence or a legal, causal or investment conclusion.
