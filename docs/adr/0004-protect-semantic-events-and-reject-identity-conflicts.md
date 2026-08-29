# ADR 0004: Protect semantic events and reject identity conflicts

- Status: Accepted
- Date: 2026-08-30

## Context

Source identity and record equality served different purposes but were
previously combined with `rawRowHash` in one duplicate key. That allowed two
different records carrying one source identity to survive, while the entire
validated event—including volatile collection metadata—was included in the
result hash. Input order could therefore select content, and collection timing
could change a technical result.

## Decision

Source identity is the tuple `datasetId`, `venueId`, and `sourceEventId`.
Canonicalization validates and normalizes all input, groups by that identity,
decides duplicate or conflict status, and only then sorts events.

Record equality and result hashing use one explicit canonical event projection.
It allowlists `schemaVersion`, `eventId`, `sourceEventId`, `datasetId`,
`venueId`, `eventTime`, `sequence`, `instrumentId`, `eventType`, `side`,
`actorId`, `counterpartyId`, `orderId`, `price`, and `quantity`. It excludes the
collection metadata `receivedAt` and `rawRowHash`. A test compares the allowlist
and exclusion list with the runtime schema keys, so adding a schema field
requires an explicit scope decision.

Canonically equal records in one identity group collapse and increment
`duplicateCount`. When their collection metadata differs, the representative
with the lowest UTF-16 `rawRowHash`, then `receivedAt`, is retained so output is
independent of input order while keeping source traceability. Different
canonical projections under one identity raise
`CONFLICTING_SOURCE_IDENTITY`, naming all identity components. This is a
pre-replay `REVIEW_REQUIRED` ambiguity: no replay result or result hash exists.

## Consequences

Input order cannot decide which conflicting record survives. Collection
metadata remains available to trace a retained event to `rawRowHash`, but it
does not affect semantic equality or the canonical result hash. Changes to any
protected field affect the projection hash. The concentrated-buy fixture pins
a literal result hash after these ordering, identity, and scope rules.
