# Published stock quotation acquisition and derivation

The committed artifact is the first accepted KOSPI page for `basDt=20260903`:
40 quotations out of 943, acquired at `2026-09-05T19:31:27.527Z` (2026-09-06 KST).
All 15 returned columns and all items remain intact. See
[fsc-stock-quotes-20260903.provenance.json](fsc-stock-quotes-20260903.provenance.json)
for the complete request, permission, venue basis, interpretation and checksums.

| Artifact          | SHA-256                                                            |
| ----------------- | ------------------------------------------------------------------ |
| Original response | `4ad9c1e1677a19b4fd28b766ae32883d82ec824b66a2687f1533198f18cc5b43` |
| Runtime JSONL     | `17d3e9462f2322b0227554d76a4c7c4022261b4976727b3884f452d68f075eea` |
| Generated rows    | `b22afd23826096720fa1251bb3ee8908047bc3d4544075d21ae9fbc6d3809b8c` |

The original HTTP entity has no final LF. Its bytes and the generated rows are
narrowly excluded from formatters; reproduce them with the command below.

Recorded columns, in publisher order: `basDt`, `srtnCd`, `isinCd`, `itmsNm`,
`mrktCtg`, `clpr`, `vs`, `fltRt`, `mkp`, `hipr`, `lopr`, `trqu`, `trPrc`,
`lstgStCnt`, `mrktTotAmt`. The source preview retains spellings such as `.78`;
only the approved canonical projection normalizes mapped dates and decimals.

## Source and permission prerequisite

Use only the Financial Services Commission (금융위원회) distribution
[금융위원회_주식시세정보](https://www.data.go.kr/data/15094808/openapi.do).
Its linked [official operation guide](https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003526398&fileDetailSn=1)
documents `getStockPriceInfo`, `basDt`, `resultType`, `pageNo`, `numOfRows`,
`mrktCls`, and provider success code `00`. The returned `mrktCtg` describes
`KOSPI`, `KOSDAQ` or `KONEX`.

Reopen the distribution and [portal policy](https://www.data.go.kr/ugs/selectPortalPolicyView.do)
on the acquisition date. Record the exact unrestricted permission label,
verification time, applicable attribution conditions and project credit. If
permission is missing, restricted, inaccessible or contradicted, stop without
acquiring or publishing bytes. An unrestricted label is not an assertion of
CC0, Apache-2.0 or a particular KOGL type. The code licence does not license
external data. The manual CLI's verification-date argument records the
operator's prerequisite check; it does not automate legal verification.

The acquisition-date permission label was **이용허락범위 제한 없음**, checked
at `2026-09-05T19:31:14Z`. No specific attribution condition was stated for this
distribution by its label or linked policy. Credit retained under repository
rules: Financial Services Commission (금융위원회), 금융위원회_주식시세정보,
via data.go.kr; trading date 2026-09-03, retrieved 2026-09-05 UTC.

## Manual retrieval

Make `DATA_GO_KR_SERVICE_KEY` available in the local process environment. Never
pass it as a command argument or print a credential-bearing URL. Raw and portal
percent-encoded key forms are supported with a single encoding step.

From the repository root:

```bash
node scripts/retrieve-fsc-stock-quotes.mjs YYYYMMDD KOSPI /tmp/NEW.response.json YYYY-MM-DD
```

The final argument is today's UTC permission-verification date. Use one known
published completed `basDt`; the portal describes next-business-day publication
after 13:00, rather than a live feed. The script requests `pageNo=1`,
`numOfRows=40`, `resultType=json`, and the documented `mrktCls` filter. It accepts
2–40 complete rows with that date and market, unique nonempty `srtnCd` and
`isinCd`, and honest pagination. It never filters, sorts, deduplicates or repairs
returned items. Freeze the first acceptable response regardless of prices.

The request has a 30-second timeout, rejects redirects, checks HTTP and provider
status independently, and checks for echoed credentials. Output uses exclusive
creation; neither retrieval nor re-fetching can overwrite accepted bytes.
The response is written from `arrayBuffer()` without reserialization, trimming
or formatting. A neighboring `.receipt.json` contains redacted request metadata
and checksums, not a complete licence/provenance record.

Captured acquisition command (the key was read inside the process):

```bash
node --env-file=.env.local scripts/retrieve-fsc-stock-quotes.mjs 20260903 KOSPI /tmp/weavetrail-fsc-20260903-first.response.json 2026-09-05
```

The first local invocations used the Korean calendar date for the UTC
verification argument and stopped before any network request. The first
network response met every constraint and was frozen. No price-based
selection or fallback date was used.

## Offline derivation

```bash
node scripts/derive-fsc-stock-quotes.mjs packages/scenarios/src/sources/real/fsc-stock-quotes-20260903.response.json 20260903 KOSPI /tmp/fsc-stock-quotes-20260903.jsonl /tmp/fsc-stock-quotes-20260903-rows.json
cmp packages/scenarios/src/sources/real/fsc-stock-quotes-20260903.jsonl /tmp/fsc-stock-quotes-20260903.jsonl
cmp packages/scenarios/src/generated/fsc-stock-quotes-20260903-rows.json /tmp/fsc-stock-quotes-20260903-rows.json
```

This command makes no network requests. It validates `response.header` and
`response.body.items.item`, retains every item and every returned column, and
rejects nonstring item values instead of coercing them. Financial strings,
Unicode, commas, empty strings and object key order are preserved.

JSONL is compact `JSON.stringify(item)` per item, UTF-8 without BOM, LF joins,
and exactly one final LF. Generated rows are
`{coordinate: {sourceArtifactHash, rowNumber}, values}` using the JSONL SHA-256
and one-based physical line number, serialized with two-space indentation and
one final LF. Reproduction compares both outputs byte for byte. These generated
rows must equal `parseJsonLinesSourceArtifact` output in engine tests.

The original response SHA-256 differs from runtime `sourceArtifactHash`.
`rawRowHash` covers the runtime coordinate and complete original item values,
not the envelope. Record all three layers accurately. Adjacent provenance must
record provider/title/origin, redacted request, retrieval and permission times,
attribution, date/venue basis, ordered columns, interpretation, derivation policy
and all raw/runtime/generated checksums before any real fixture is registered.

Re-fetch once to a new path when possible. Compare original response bytes and
item values separately; future publisher corrections need not be byte-identical.
Never overwrite a frozen artifact. Retrieval is absent from tests, CI, builds
and application runtime. Mocked transport tests use wholly synthetic responses.

Captured re-fetch: `2026-09-05T19:36:42.695Z`, same redacted request, saved to
`/tmp/weavetrail-fsc-20260903-refetch.response.json`. Original entity bytes and
parsed item values both matched. Raw SHA-256 remained
`4ad9c1e1677a19b4fd28b766ae32883d82ec824b66a2687f1533198f18cc5b43`.
This one comparison is not a guarantee of future remote byte identity.

Validation environment: Node 22.18.0, pnpm 10.33.2, Linux WSL2 x86_64. The
committed artifact checks and foundation golden run with:

```bash
pnpm exec vitest run packages/replay-engine/src/real-market-data.test.ts apps/web/src/app/api/replay/real-market-data-route.test.ts
```

This dataset has no case manifest or expected rule outcome. The tests verify
normalization and refusal of an explicitly untrusted actor claim, without
evaluating a real-instrument case.
