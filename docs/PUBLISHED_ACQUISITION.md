# Published acquisition scopes

Every committed real artifact declares one of two acquisition scopes beside its
provenance. Both require permission to commit, modify and redistribute the data,
verified manually on the acquisition date. Missing, restricted, inaccessible or
contradictory permission stops acquisition. Neither scope permits inventing a
field, changing original source values or selecting rows after seeing them.

| Scope             | Selection guarantee                                                          | Completion evidence                                                                        |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `bounded-window`  | A small first-page window, fixed before inspecting values                    | The existing provider-specific window checks; this is not the whole series                 |
| `complete-series` | Every row returned for one exact predeclared identity/date scope is retained | Consecutive pages, an unchanged publisher total, and derived row count equal to that total |

Use the bounded window for a deliberately limited normalization example. Use a
complete series when the declared source exceeds that window and completeness
is the intended guarantee. Increasing the bounded-window ceiling or trimming a
complete series to that ceiling is not a migration between these scopes.

## Existing artifact

The FSC KOSPI artifact retains its original response, JSONL, generated rows,
provenance, request, licence record and pinned hashes. The new adjacent
`fsc-stock-quotes-20260903.acquisition.json` classifies it as `bounded-window`
and references the existing provenance filename and `sourceArtifactHash`.
This classification describes the already recorded window policy; it does not
invent a historical declaration timestamp. Its existing manual acquisition and
offline derivation commands remain in the
[source README](../packages/published-data/src/sources/real/README.md).

## Complete-series declaration

`validateCompleteSeriesDeclaration` in `scripts/complete-series.mjs` accepts a
strict declaration with:

- `scope: "complete-series"`;
- `date`: one completed Gregorian date as `YYYYMMDD`;
- `filter`: exactly `{ kind, value }`, naming one `instrument`, `series` or
  `date`; a date selector must equal the declared date;
- `pageSize`: a positive integer string fixed before retrieval, not a total-row
  ceiling;
- `declaredAt`: a UTC ISO timestamp with millisecond precision;
- `permission`: the operator's `UNRESTRICTED` determination, exact permission
  label, `checkedAt`, HTTPS `termsUrl` and attribution text.

Identity values are single ASCII tokens (letters/digits followed by
letters/digits, `.`, `_`, `:` or `-`, at most 128 characters). Lists, wildcards,
expressions, comparison operators and additional fields are rejected. Price,
volume and outcome are not filter kinds. The filter declaration cannot supply
publisher parameter names or arbitrary query parameters. Permission checking
remains manual: validating this record does not independently establish legal
permission or authenticate the operator's timestamp.

## Manual retrieval API and adapter boundary

`retrieveCompleteSeries({ declaration, output }, adapter)` in
`scripts/retrieve-complete-series.mjs` is a manual library entry point. It has
no default endpoint, transport, credentials or production complete-series
adapter. No real complete series is acquired or committed by this change.

A publisher adapter is reviewed repository code, not an operator/model
declaration or a file loaded from artifact metadata. Its request specification
binds the fixed endpoint and publisher parameter names for date, exact identity,
page number, page size and, optionally, response format. The only parameter
changed during retrieval is the page number. Request settings and the logical
declaration are copied and frozen before transport; each request is immutable.
The endpoint must be HTTPS with no embedded query, fragment or credentials.

Adapter review must establish that selectors mean exact equality, that a
format control is not a selection predicate, and that the response decoder
checks provider success and exposes the complete original item array. The
decoder receives the frozen declaration so it can check returned scope
identities against it where the publisher supplies them. It returns page
number, page size and publisher total as canonical integer strings and retains
every column and row as string values. It must not coerce, filter, sort,
deduplicate or fabricate a field. New publisher columns receive no canonical
mapping from this mechanism.

`fetchPage(request, { signal, redirect })` is the injected transport. It must
honor the 30-second abort signal and `redirect: "error"`, and inject credentials
from its environment without changing the declared selection. It exposes no
credentials in the recorded request. `secrets()` supplies raw/decoded credential
forms for the guard; the collector also checks percent, form and JSON-string
escaping. When a response is valid JSON, it additionally walks every decoded
object key and string value, covering equivalent slash and Unicode escape forms.
Credential echoes, failed HTTP status, redirects and transport exceptions fail
closed; transport/decode errors are replaced with messages without raw URLs.
No real adapter semantics or publisher observations are asserted here. The
next source acquisition needs its reviewed adapter and provenance evidence.

Before the first request, the collector checks today's UTC permission and
declaration dates, checks that the requested date is completed, reserves a new
output directory and writes `declaration.json`. It fetches pages sequentially,
starting at page 1, never requesting a subset or accepting a short intermediate
page. Each response's declared page and page size must match the request. Every
page must report the same total. All full pages and the exact final remainder
must be present. A total of zero admits one empty first page and an empty source
file; it does not imply a replay result. A permission-date rollover, changing
total, inconsistent page or missing row stops acquisition and requires review,
not trimming or a fallback scope.

Original entity bytes are saved to `page-N.response` without reserialization.
The decoder receives a copy so adapter parsing cannot mutate the retained or
hashed HTTP entity.
`source.jsonl` concatenates every decoded item in page/item order, compact
`JSON.stringify` per item with LF separators and a final LF for nonempty data.
Values and column insertion order remain intact. Source hashing is ordinary
SHA-256 of those UTF-8 bytes. No financial arithmetic takes place. The current
collector holds rows in memory; storage or memory failure is an acquisition
failure, never permission to admit a partial series.

All writes use exclusive creation. Existing output directories/files are
refused before transport. Caught failures remove only files created by the
invocation and attempt to remove its directory; cleanup failure remains an
error. Successful evidence is never overwritten. This is exception recovery,
not crash-atomic persistence: abrupt termination or storage failure can leave
an incomplete directory requiring inspection.

## Recorded evidence and offline admission

The collector writes `acquisition.json` only after complete responses and the
derived source. It records the frozen declaration, retrieval timestamp, page
count, row count, publisher total, each original page filename and checksum,
each exact public endpoint/parameter request, per-page count/total, and the
derived `sourceArtifactHash`. Authentication values are excluded from request
records. `publisherObservations` is an empty reserved slot; this change records
no provider-specific behaviour. Supporting nonempty observations requires the
next acquisition's evidence and a corresponding validator update.

Before committing a source, retain the original pages, `declaration.json` and
`acquisition.json` in one source directory beside its complete
`<artifact>.provenance.json`; record the derived source path/hash at
`artifacts.runtimeJsonl` in provenance. A bounded-window classification remains
`<artifact>.acquisition.json`. A complete-series receipt is acquisition evidence,
not a substitute for provider, origin, retrieval time, licence, attribution and
reproducible derivation instructions.

`verifyPublishedAcquisitions` scans committed provenance records and requires
each adjacent scope declaration. It also rejects any unclaimed file in the real
source tree, so an artifact cannot evade checks by omitting provenance entirely.
Bounded-window admission reuses the original FSC derivation and checks
source/generated bytes against recorded hashes.
Complete-series admission requires an explicitly registered offline adapter;
an unknown adapter is refused. `validateCompleteSeriesArtifact` re-decodes
every original page, checks page sequence and totals, reproduces the JSONL in
returned order and compares the complete record. A source with fewer rows than
the reported total is rejected even if its source checksum and declared row
count have been rewritten to match the truncation. Missing pages, reordered
data and mismatched recorded requests also fail. No verifier fetches data.
Admission also requires the retained `declaration.json` to equal the receipt's
declaration and requires real provider, title, HTTPS origin, retrieval time,
permission label/terms/check time/requirements/attribution and runtime source
metadata. Receipt retrieval and permission values must match provenance.

The committed inventory check runs in `pnpm test`. A future complete-series
artifact must add its reviewed decoder to that check's adapter registry; until
then complete-series admission fails closed. Transport tests use only synthetic
responses and a synthetic protocol, not recordings of a publisher. Reproduce:

```bash
pnpm exec vitest run packages/published-data/src/acquisition-scope.test.ts packages/replay-engine/src/daily-quote-derivation.test.ts packages/replay-engine/src/real-market-data.test.ts
```

## Hash and ownership boundary

Acquisition declarations live beside published artifacts and are never passed
to mappings, approvals or canonical event projections. They do not alter
`sourceArtifactHash`, `rawRowHash`, `eventId`, `canonicalDatasetHash` or the
semantic result hash. Published data stays in `packages/published-data`;
synthetic scenarios remain synthetic. Acquisition has no call site in tests
using real transport, CI, builds or application runtime.

Completeness here means equality with the publisher-reported total for the
declared scope. It is not evidence of authenticity, a stable remote snapshot,
coverage outside that scope, or a rule verdict. The count cannot compensate
for a publisher whose totals or selector semantics cannot be trusted. See
[ADR 0025](adr/0025-distinguish-published-acquisition-scopes.md).
