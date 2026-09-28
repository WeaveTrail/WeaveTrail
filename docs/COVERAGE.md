# Published check coverage

[한국어](COVERAGE.ko.md)

`GET /api/coverage` returns `CoverageManifestSchema` version `1.0`, derived at
module load by `packages/published-data/src/coverage.ts` with derivation version
`published-coverage-v1`. It has no editable generated manifest and performs no
network requests. The committed acquisition receipts, adjacent provenance and
admitted source rows determine its contents. Adding coverage means admitting a
source under [the acquisition rules](PUBLISHED_ACQUISITION.md), not editing a
coverage line.

Each dataset records its identity, acquisition record and scope, declared
instrument family, publisher fields, inclusive date window, resolution, source
artifact and original-byte hashes, publisher, origin URL, licence, attribution
and retrieval time. Its observations list the actual canonical instrument IDs,
dates and source row numbers. A family selector or date range does not assert
that every instrument or calendar date is available. The stock window retains
only its 40 collected rows; complete-series datasets retain their declared
family scope. All currently admitted check datasets are daily quotations.
Presentation-only charts and synthetic scenarios are outside this manifest.

`asOf` is the newest recorded dataset retrieval, not the current time, latest
trading date or a freshness guarantee. Older datasets retain their individual
retrieval times. One translated coverage line appears on the event page
(`/case-2026-09-03`) before its interactive case, and above the result panel in
Case Replay. Its details link opens the same API manifest.

## Claim resolution boundary

`resolveClaimCoverage(request, manifest, definitions)` in `replay-engine` is a
deterministic preflight. It uses only the supplied manifest, never a catalog,
provider, URL or store fallback. The caller supplies an already resolved
canonical instrument ID, inclusive date window, publisher field and resolution
(`DAILY` or `INTRADAY`), and optionally an exact definition ID/version.
Name/code resolution remains the separate
[exact dated instrument resolver](INSTRUMENT_RESOLUTION.md).

The result carries the validated request and the supplied manifest's SHA-256
digest and versions. This digest identifies the coverage declaration, including
its recorded provenance; it is not a canonical replay result hash. In order,
preflight distinguishes:

| Status          | Reason code             | Meaning                                                                |
| --------------- | ----------------------- | ---------------------------------------------------------------------- |
| `UNCONFIRMABLE` | `OUTSIDE_COVERAGE`      | Instrument, field or requested endpoint date is not observed in scope  |
| `UNCONFIRMABLE` | `RESOLUTION_TOO_COARSE` | Covered daily data cannot satisfy an intraday request                  |
| `UNCONFIRMABLE` | `DEFINITION_NOT_BOUND`  | No unique trusted definition matches ID, version, field and resolution |
| `READY`         | —                       | Pinned source rows are available to a separately bound computation     |

A window must fit one dataset and have observations at both endpoints.
Intervening observations are listed explicitly; preflight neither invents
missing days nor promises a complete trading calendar. Combining partial
datasets and validating calculation-specific lookbacks or calendars are not
implemented. Definitions are metadata supplied by trusted versioned code;
preflight executes no calculation, assigns no `COMPUTED`/`DIFFERS` sentence
grade and approves no pattern hypothesis. `READY` alone is not evidence.

`POST /api/check/coverage` exposes this boundary for structured scopes. For
example, this request asks whether intraday checking is possible:

```json
{
  "instrumentId": "코스피 200",
  "dateWindow": { "start": "2026-09-03", "endInclusive": "2026-09-03" },
  "field": "clpr",
  "resolution": "INTRADAY"
}
```

The route returns a closed reason code with Korean and English explanations
and what evidence would resolve the limit. It rejects malformed requests and
caller-supplied manifests or definition registries as `REVIEW_REQUIRED` with
HTTP 422. The server currently binds no numeric definitions, so daily scopes
that pass coverage return `DEFINITION_NOT_BOUND`. Pasted-text extraction,
numeric recomputation and the full claim-check screen remain planned in
[#154](https://github.com/WeaveTrail/WeaveTrail/issues/154),
[#157](https://github.com/WeaveTrail/WeaveTrail/issues/157) and
[#230](https://github.com/WeaveTrail/WeaveTrail/issues/230). Requests are not stored.

## Verification

```bash
pnpm exec vitest run packages/published-data/src/coverage.test.ts packages/replay-engine/src/claim-coverage.test.ts apps/web/src/app/api/coverage/route.test.ts apps/web/src/app/api/check/coverage/route.test.ts apps/web/src/app/coverage-line.test.ts
```

An independently discovered file inventory fails if any committed published
JSONL artifact, provenance pin or acquisition record is absent from coverage.
Invariant tests remove observations from the supplied manifest to prove there
is no wider fallback, and distinguish all three reason codes. API tests verify
both translated reasons and prevent caller-controlled scope widening. Surface
tests place coverage before the event case and replay results. These are
offline unit and server-render tests, not browser end-to-end validation.
See [ADR 0052](adr/0052-derive-claim-resolution-scope-from-acquisitions.md).
