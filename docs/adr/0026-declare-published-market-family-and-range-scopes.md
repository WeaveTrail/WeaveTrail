# ADR 0026: Declare published market family and range scopes

## Status

Accepted

## Context

The Financial Services Commission index and derivative operations expose
literal name-inclusion selectors, not equality selectors. The index operation
also defines `beginBasDt` as inclusive and `endBasDt` as exclusive. Describing
those requests as exact identities or a single date would overstate the
selection guarantee. Admitting arbitrary publisher parameters would instead
allow value predicates into acquisition metadata.

Complete-series evidence also needs to retain observed publisher behaviours
without accepting unstructured claims, and generated source coordinates must be
reproducible from committed response pages without network access.

## Decision

Extend the declaration with two closed logical filters, `index-family` and
`instrument-family`, and with a strict half-open date range
`[begin, endExclusive)`. Reviewed adapters alone bind those logical fields to
publisher parameter names. The FSC adapters bind them to `likeIdxNm`,
`likeItmsNm`, `beginBasDt` and `endBasDt`, validate every returned row against
the declared literal/date scope, and require the complete documented column set.
No value filter or arbitrary query field is admitted.

Allow only two structured publisher observations: an exclusive range end and a
rounded decimal column. Each carries a verification time, statement and
evidence. The collector derives `rows.json` from `source.jsonl`; offline
admission reproduces both from the original page bytes and checks their hashes.

Keep every acquired market source under `packages/published-data`. Acquisition
declarations, observations and provenance do not enter mappings, approvals,
canonical events or their hashes.

## Consequences

Completeness means every publisher row for the literal family and half-open date
scope, not exact-name equality and not coverage outside that scope. A change in
publisher match semantics, pagination total, column set or row identity fails
closed. The range cannot express a price, rate, volume or outcome predicate.

The adapters and tests make no automatic network request. Permission remains a
manual acquisition-date check, and a future publisher correction is recorded
instead of overwriting frozen evidence.
