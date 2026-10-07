# ADR 0052: Derive claim resolution scope from acquisitions

> Historical decision: source-dependent portions are superseded by
> [ADR 0056](0056-withdraw-the-committed-real-data-tier.md). The original
> account below describes the withdrawn tier. Generic contracts, synthetic
> behavior and provenance safeguards remain applicable. The claim checker,
> sentence evidence and claim-check screen it calls planned are no longer
> planned; see [ADR 0061](0061-retire-the-planned-service-components.md).

## Status

Partially superseded by ADR 0056 for the committed real-data tier, and by
ADR 0061 for the planned claim-check work.
The following status is historical:

Accepted.

## Context

An unconfirmable claim must describe a known coverage limit. A separately
edited UI caption or a resolver that falls back to a wider catalog could
misstate that limit. Acquisition selectors also describe requested families
and windows, while a bounded response admits only its collected observations.
The full claim checker and its numeric definition bindings are still planned.

## Decision

Derive a versioned runtime coverage manifest in `published-data` from existing
committed acquisition receipts, provenance and admitted rows. Preserve receipt
shapes and source bytes. Include original-byte references and individually
recorded retrieval times. The aggregate `asOf` is the newest retrieval; it is
never a wall clock or freshness claim. An independent filesystem inventory
test requires coverage of every published artifact and acquisition record.

Put strict manifest, request, trusted definition metadata and preflight result
contracts in `contracts`. Put pure `resolveClaimCoverage` in `replay-engine`.
Pass the manifest and trusted definition metadata from web composition, with no
runtime dependency from the engine to published data or the instrument resolver.
The function accepts canonical identities already resolved by the dated
resolver, and nominates only pinned source rows present in the supplied manifest.

Check actual instrument/date observations and fields before resolution, then
require an exact code-owned definition binding. Return distinct
`OUTSIDE_COVERAGE`, `RESOLUTION_TOO_COARSE` and `DEFINITION_NOT_BOUND` reasons.
Require one dataset to contain the window and observations at both endpoints;
list intervening observed dates explicitly. `READY` makes no claim of calendar
completeness and is neither a computed sentence grade nor an approved case.
Digest the manifest including recorded provenance as a coverage declaration
reference, separate from replay result hashes.

Serve the manifest at `GET /api/coverage`. Web composition derives a translated
summary for the event page and replay result panel, passing only copy to client
components. `POST /api/check/coverage` offers the structured preflight with both
languages' reason text. The server binds no numeric definitions yet. Full text
extraction, recomputation, sentence evidence and the claim-check screen remain
planned; no pasted text or source snapshot is stored by these routes.

## Consequences

Coverage changes through admitted source records rather than a manually
maintained manifest. Declared families do not widen a partial response. The
same request, manifest and trusted definitions produce the same preflight
result without fetching current URLs or changing canonical engine goldens.
Existing evidence-sentence contracts and code-verified absence checks remain
unchanged; the scope preflight is a separate contract.

Future numeric definition binding must validate its required rows, lookbacks,
calendars and exact rounding before grading a claim. Current preflight neither
joins partial datasets nor implements those computation-specific obligations.
See [published coverage](../COVERAGE.md) for the API and reproducible checks.
