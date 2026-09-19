# Published acquisition scopes

Every committed real artifact declares one of two acquisition scopes beside its
provenance. Both require permission to commit, modify and redistribute the data,
verified manually on the acquisition date.

```text
stops acquisition   missing · restricted · inaccessible · contradictory permission
never permitted     inventing a field · changing original source values
                    · selecting rows after seeing them
```

| Scope             | Selection guarantee                                                                | Completion evidence                                                                        |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `bounded-window`  | A small first-page window, fixed before inspecting values                          | The existing provider-specific window checks; this is not the whole series                 |
| `complete-series` | Every row returned for one predeclared identity, family and date scope is retained | Consecutive pages, an unchanged publisher total, and derived row count equal to that total |

- Use the bounded window for a deliberately limited normalization example, and a
  complete series when the declared source exceeds that window and completeness
  is the intended guarantee.
- Raising the bounded-window ceiling, or trimming a complete series to it, is not
  a migration between the scopes.

## Existing artifact

```text
FSC KOSPI artifact   original response · JSONL · generated rows · provenance · request
                     · licence record · pinned hashes, all retained
fsc-stock-quotes-20260903.acquisition.json
  classifies it bounded-window, references the existing provenance filename and
  sourceArtifactHash, and describes the already recorded window policy
  → it invents no historical declaration timestamp
```

Its manual acquisition and offline derivation commands stay in the
[source README](../packages/published-data/src/sources/real/README.md).

## Complete-series declaration

`validateCompleteSeriesDeclaration` in `scripts/complete-series.mjs` accepts a
strict declaration:

```text
scope        "complete-series"
date         one completed Gregorian YYYYMMDD, or exactly
             { kind: "range", begin, endExclusive } for a nonempty half-open range
filter       exactly { kind, value }
               exact          instrument · index · series · date
               publisher-matched  index-family · instrument-family
               a date selector must equal the declared single date
pageSize     a positive integer string fixed before retrieval, not a row ceiling
declaredAt   UTC ISO timestamp, millisecond precision
permission   the operator's UNRESTRICTED determination · exact permission label
             · checkedAt · HTTPS termsUrl · attribution text
```

```text
exact identity values   single ASCII token: letter/digit, then letters, digits,
                        ".", "_", ":" or "-", at most 128 characters
family values           may add Unicode letters and spaces
never accepted          lists · wildcards · expressions · comparison operators
                        · price, volume or outcome as a filter kind
                        · a value predicate inside the date range
                        · publisher parameter names or arbitrary query parameters
```

Permission checking stays manual: validating the record establishes neither legal
permission nor the operator's timestamp.

## Manual retrieval API and adapter boundary

`retrieveCompleteSeries({ declaration, output }, adapter)` in
`scripts/retrieve-complete-series.mjs` is a manual library entry point with no
default endpoint, transport or credentials.

```text
publisher adapter   reviewed repository code — never an operator or model declaration,
                    never loaded from artifact metadata
  request spec      fixed endpoint · publisher parameter names · single date or half-open
                    range · identity or family selector · page number · page size
                    · optional response format
  during retrieval  only the page number changes; settings and the logical declaration
                    are copied and frozen before transport, each request immutable
  endpoint          HTTPS, no embedded query, fragment or credentials
  review must fix   whether each selector means exact equality or literal family match
                    · that a format control is not a selection predicate
                    · that the decoder checks provider success and exposes the complete
                      original item array
  decoder           receives the frozen declaration, so returned scope identities can be
                    checked where the publisher supplies them
                    returns page number, page size and publisher total as canonical
                    integer strings; retains every column and row as strings
                    must not coerce, filter, sort, deduplicate or fabricate a field
                    new publisher columns get no canonical mapping from this mechanism
```

```text
fetchPage(request, { signal, redirect })   the injected transport
  honors the 30-second abort signal and redirect: "error"
  injects credentials from its environment without changing the declared selection
  exposes no credential in the recorded request
guard   secrets() supplies raw and decoded credential forms; the collector also checks
        percent, form and JSON-string escaping, and for valid JSON walks every decoded
        object key and string value, covering equivalent slash and Unicode escape forms
fail closed   credential echo · failed HTTP status · redirect · transport exception
              transport and decode errors are replaced with messages carrying no raw URL
```

- The reviewed Financial Services Commission adapters bind only the official
  `getStockMarketIndex`, `getStockFuturesPriceInfo` and `getOptionsPriceInfo`
  operations. Their exact index selector binds `idxNm`; family selectors bind the
  documented `likeIdxNm` and `likeItmsNm` literal-inclusion parameters. Their
  decoders require provider success, the complete operation-specific column set,
  the declared date and family scope, and nonduplicated publisher identities.
- Imports read no credentials and make no request. The manual transport reads
  `DATA_GO_KR_SERVICE_KEY` inside the process and adds it only to the outgoing
  request.

```text
before the first request   today's UTC permission and declaration dates checked
                           · the requested date must be completed
                           · a new output directory reserved, declaration.json written
pages                      sequential from page 1, never a subset, never a short
                           intermediate page
each response              declared page and page size must match the request
                           every page reports the same total
                           all full pages plus the exact final remainder must be present
total of zero              one empty first page and an empty source file; it implies
                           no replay result
stops acquisition          permission-date rollover · changing total · inconsistent page
                           · missing row → review, never trimming or a fallback scope
```

```text
page-N.response   original entity bytes, no reserialization; the decoder receives a copy,
                  so adapter parsing cannot mutate the retained or hashed HTTP entity
source.jsonl      every decoded item in page and item order, compact JSON.stringify per
                  item, LF separators, final LF for nonempty data; values and column
                  insertion order intact
rows.json         adds only source coordinates: the source SHA-256 and the one-based
                  physical line number; reproducible offline with
                  scripts/derive-published-rows.mjs
hashing           ordinary SHA-256 of UTF-8 bytes; no financial arithmetic
memory            the collector holds rows in memory; a storage or memory failure is an
                  acquisition failure, never permission to admit a partial series
writes            exclusive creation; existing directories and files are refused before
                  transport; a caught failure removes only what the invocation created and
                  tries to remove its directory, and cleanup failure stays an error
```

Successful evidence is never overwritten. This is exception recovery, not
crash-atomic persistence: abrupt termination or storage failure can leave an
incomplete directory that needs inspection.

## Recorded evidence and offline admission

```text
acquisition.json   written only after complete responses, the derived source and a
                   deterministic rows.json
  frozen declaration · retrieval timestamp · page count · row count · publisher total
  · each original page filename and checksum · each exact public endpoint and parameter
    request · per-page count and total · the derived sourceArtifactHash
  authentication values excluded from request records
publisherObservations   closed, evidence-bearing records only, for an exclusive range end
                        or a rounded decimal column; each carries verification time,
                        statement and evidence, and arbitrary shapes are refused
```

```text
one source directory   original pages · declaration.json · acquisition.json
                       · <artifact>.provenance.json (complete)
provenance             records the derived source path and hash at artifacts.runtimeJsonl
bounded window         stays <artifact>.acquisition.json
a complete-series receipt is acquisition evidence, not a substitute for provider, origin,
retrieval time, licence, attribution and reproducible derivation instructions
runtime JSONL path must resolve inside that same source directory
admission              hashes committed bytes before decoding · requires exact UTF-8
                       · compares the decoded JSONL with rows rebuilt from the original pages
                       · normalizes offline adapter registry endpoints as URLs before
                         matching the canonical request endpoint in the receipt
```

```text
verifyPublishedAcquisitions   scans committed provenance records, requires each adjacent
                              scope declaration, and rejects any unclaimed file in the real
                              source tree, so omitting provenance cannot evade checks
bounded-window admission      reuses the original FSC derivation, checks source and
                              generated bytes against recorded hashes
complete-series admission     requires an explicitly registered offline adapter; an unknown
                              adapter is refused
validateCompleteSeriesArtifact
  re-decodes every original page · checks page sequence and totals · reproduces the JSONL
  and generated rows in returned order · compares the complete record
  rejected: fewer rows than the reported total, even when the source checksum and declared
            row count were rewritten to match the truncation
            · missing pages · reordered data · mismatched recorded requests
  also required: the retained declaration.json equals the receipt's declaration, and real
            provider, title, HTTPS origin, retrieval time, permission label, terms, check
            time, requirements, attribution and runtime source metadata are present, with
            receipt retrieval and permission values matching provenance
no verifier fetches data
```

The committed inventory check runs in `pnpm test`. A future complete-series
artifact must add its reviewed decoder to that check's adapter registry; until
then complete-series admission fails closed. Transport tests use only synthetic
responses and a synthetic protocol, never a recording of a publisher. Reproduce:

```bash
pnpm exec vitest run packages/published-data/src/acquisition-scope.test.ts packages/replay-engine/src/daily-quote-derivation.test.ts packages/replay-engine/src/real-market-data.test.ts
```

## Hash and ownership boundary

```text
acquisition declarations   live beside published artifacts and never reach mappings,
                           approvals or canonical event projections
unchanged by them          sourceArtifactHash · rawRowHash · eventId
                           · canonicalDatasetHash · the semantic result hash
ownership                  published data stays in packages/published-data; synthetic
                           scenarios stay synthetic
no call site                in tests using real transport, CI, builds or application runtime
```

Completeness here means equality with the publisher-reported total for the
declared scope. It is not evidence of authenticity, a stable remote snapshot,
coverage outside that scope, or a rule verdict, and the count cannot compensate
for a publisher whose totals or selector semantics cannot be trusted. See
[ADR 0025](adr/0025-distinguish-published-acquisition-scopes.md) and
[ADR 0030](adr/0030-declare-published-market-family-and-range-scopes.md).
