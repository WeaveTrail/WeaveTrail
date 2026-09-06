# ADR 0031: Compose publisher source identities in mapping 1.6

## Status

Accepted

## Context

The FSC index operation identifies an observation by the natural key
`(basDt, idxNm)`. Neither column alone can serve as both the event time and a
stable publisher identity, and copying either source column into two ordinary
mapping targets would weaken the existing duplicate-source-column validation.
Materializing a synthetic identifier in the published response or derived rows
would also violate the source-preservation boundary.

## Decision

Mapping version `1.6` adds `compositeSourceEventId`, an ordered declaration of
at least two unique source columns with the sole transform `NUL_JOIN`. The
replay engine reads the original values, rejects missing values and values that
contain NUL, and joins them in declared order. Because admitted components
cannot contain the separator, the representation is injective. It feeds only
`sourceEventId`; `eventId` remains derived from dataset, venue and source event
identity exactly as before.

Columns participating in the composite may also have one ordinary mapping.
This is intentional: `basDt` remains the event-time input and `idxNm` remains
the instrument identity. Duplicate entries in the ordinary field list still
fail as `DUPLICATE_SOURCE_COLUMN`, and ordinary fields cannot target
`sourceEventId` in version `1.6`.

Versions `1.4` and `1.5` and their approval artifacts are unchanged. The
derivative sources retain `1.5` because their publisher `srtnCd` and `isinCd`
already provide single-column identities. Acquisition declarations remain
evidence metadata and do not enter the composite, approval hash indirectly, or
canonical event data.

Composite identity declarations are admitted only with `confidence: 1` and
`status: PROPOSED`. An uncertain composite is rejected at the contract boundary
rather than introducing a second override path that existing review clients do
not render.

The published expectation snapshot is regenerated because it inventories
registered replay sources. That generated file is the only change under
`apps/web`; no replay UI behavior or presentation changes here.

## Consequences

- Index rows normalize without modifying publisher or derived artifact bytes.
- Reviewers see the component order, transform, confidence and evidence in the
  versioned proposal and approval artifact.
- NUL-containing component values fail closed instead of producing an
  ambiguous identity.
- Adding another composite target or transform requires a later contract
  version and review.
