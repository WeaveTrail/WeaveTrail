# Methodology

This document defines how to interpret WeaveTrail output. It describes the
planned financial reference rule where noted; it does not claim that the rule
has been implemented or evaluated.

## Question and result vocabulary

The first application asks whether a short-window price lift satisfies a
versioned pattern of concentrated, repeated aggressive buying.

The replay result is intentionally closed:

| Result          | Meaning                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| `SUPPORTED`     | Validated data satisfies every required threshold in the approved rule version.               |
| `NOT_SUPPORTED` | Data is sufficient, but one or more required thresholds are not satisfied.                    |
| `INCONCLUSIVE`  | Approved inputs reached a versioned rule, but valid evidence was insufficient for comparison. |

These states concern a technical pattern hypothesis. They are not legal or
causal conclusions.

Input identity, mapping, case scope, parameter, or approval ambiguity detected
before replay is `REVIEW_REQUIRED`, never `INCONCLUSIVE`. The code-owned state
table rejects illegal transitions, and the approval gate produces no replay
hash unless mapping and case approval records match their artifact hashes.

The fixture replay HTTP boundary applies the same distinction. It validates a
named committed CSV or JSON Lines scenario, a closed mutation, and any supplied
events before replay. Caller event arrays are limited to the four-event fixture
size. The API also executes the scenario's fixture mapping proposal and returns
`MAPPING_REVIEW_REQUIRED` before replay if any field needs review, including
when caller events were supplied. Invalid JSON, invalid event fields, mixed
sequence presence, unsupported normalized time, conflicting source identity,
or a canonical event identifier shared by distinct source identities likewise
returns a structured `REVIEW_REQUIRED` response with HTTP `422`. Each issue
includes a code and actionable request path; no replay hash is returned.

Successful responses are contract-validated projections of the replay result.
They expose the engine version, counts, canonical ordering identifiers, and
result hash, but not the engine's returned canonical event objects or raw-row
hashes.

## Dataset profile and approval scope

Canonical events deterministically produce the canonical dataset hash, sorted
distinct instrument and actor identifiers, and normalized earliest/latest
times. Case validation accepts only that `DatasetProfile`: a different dataset
hash, an absent instrument or actor, an empty actor set, or an interval outside
the profile stops before replay.

Case Manifest `1.2` carries an approval record instead of a writable approval
status. Mapping approval uses a separate record. Both records retain an opaque
reviewer reference, decision, approval time, and justified override paths while
binding to the immutable proposed artifact. Mapping confidence below the
declared fixture threshold `1.0`, or a `REVIEW_REQUIRED` field, needs a matching
override and non-empty reason.

The `RAPID_PRICE_LIFT` `1.0` registry accepts only the declared parameter names
for price change, aggressive-buy share, actor concentration, executions above
a reference, and removal sensitivity. Their values are decimal or unsigned
integer strings. The registry supplies no values or defaults; formula and
threshold selection remain planned with the rule implementation.

## Canonical time and ordering

The implemented foundation accepts `eventTime` values with a four-digit ISO
calendar year, uppercase `T`, `Z` or an explicit `±HH:MM` offset, and at most
nine fractional digits. Months are `01` through `12`; days must exist in their
month under the proleptic Gregorian leap-year rule; hours are `00` through `23`;
and minutes and seconds are `00` through `59`. Offset hours are `00` through
`23`, and offset minutes are `00` through `59`. Leap seconds are unsupported.
Before ordering or hashing, the engine converts each accepted value to
fixed-width UTC nanoseconds:

```text
YYYY-MM-DDTHH:mm:ss.sssssssssZ
```

The UTC result must remain in years `0000` through `9999`. Event time is
compared as a signed nanosecond integer, not through millisecond date parsing.
Equal-time events use an unsigned numeric `sequence` comparison and then
lexicographic UTF-16 code-unit `eventId` order. Canonical JSON keys use the same
code-unit order and do not depend on host locale data or object property
enumeration order. Canonical JSON rejects non-finite numbers; protected
decimal values are represented as strings. It omits `undefined` object
properties but rejects `undefined` array elements rather than silently
converting them to `null`.

The current dataset contract represents one ordered source stream. Every event
must either provide `sequence` or omit it; mixed presence stops replay with
`MIXED_SEQUENCE_PRESENCE`. If all events omit sequence, equal-time events fall
through to `eventId`. After exact duplicate collapse, canonical `eventId` must
be unique across source identities so that it defines a total-order
tie-breaker. WeaveTrail does not infer a missing sequence, derive a replacement
identifier during canonicalization, or Unicode-normalize identifiers.

## Source identity, duplicates, and hash scope

The implemented source identity is the tuple `datasetId`, `venueId`, and
`sourceEventId`. After validation and time normalization, the engine groups
events by that identity before sorting. Repeated records collapse only when
their canonical projections are equal; `duplicateCount` records how many were
removed. If one identity has different canonical projections, canonicalization
fails with `CONFLICTING_SOURCE_IDENTITY` before replay and no result hash is
produced. If distinct source identities carry the same canonical `eventId`, it
fails with `CONFLICTING_EVENT_IDENTIFIER` after duplicate collapse and before
ordering or hashing. Both failures select the first conflict by canonical key
order, independent of input order, and require review rather than producing an
`INCONCLUSIVE` rule result.

The canonical event projection is an explicit allowlist of semantic fields:
`schemaVersion`, `eventId`, `sourceEventId`, `datasetId`, `venueId`,
`eventTime`, `sequence`, `instrumentId`, `eventType`, `side`, `actorId`,
`counterpartyId`, `orderId`, `price`, and `quantity`. Collection metadata
`receivedAt` and `rawRowHash` remains on returned events for investigation but
is outside record equality and the canonical result hash. A schema-coverage
test requires every `TradeEvent` field to be classified explicitly, preventing
a schema addition from silently expanding or bypassing the protected scope.

## Source provenance and approved mapping

The implemented synthetic ingest path hashes exact artifact bytes as
`sourceArtifactHash`. Each raw row is serialized as canonical JSON containing
its artifact-hash/row-number coordinate and verbatim string values, then hashed
as `rawRowHash`. Approved mappings apply only closed transforms; unapproved
columns, duplicate source or target mappings, unknown transforms, rejected
values, missing required targets, duplicate coordinates, and artifact
mismatches stop before canonical dataset or result hashing.

Canonical `eventId` is derived as the percent-encoded composite
`event:<datasetId>:<venueId>:<sourceEventId>`. The engine orders normalized
canonical projections and hashes them as `canonicalDatasetHash`. Thus two
source dialects may retain different `sourceArtifactHash` and `rawRowHash`
values while converging to one semantic dataset and replay result.

The committed four-row CSV and JSON Lines fixtures report `APPROVED` for both
mappings and 4 of 4 agreements for each of the 15 protected event fields. This
is a field-level fixture check, not an accuracy estimate. Reproduce it with
`pnpm test -- packages/replay-engine/src/source-ingest.test.ts` at the commit
that contains this document. The recorded environment is Node 22.18.0, pnpm
10.33.2, Vitest 4.1.11, and Linux WSL2 x86_64. The sample is two authored,
fully synthetic dialects encoding the same four events; it does not measure
performance on independent or production data.

Separately, the guided lab executes a deterministic fixture mapping provider on
the server. Its proposal is keyed by the exact source artifact hash and exposes
source column, target field, transform, confidence, evidence, and proposal
status. The fixture provider performs no network call and uses no credentials.
Dialect A produces declared `PROPOSED` fields; dialect B also produces an
unmapped `source_note` with `REVIEW_REQUIRED`, which the API enforces before
replay. The client disables its replay control for the same state, but it is not
the authority for the gate. Neither status is an approval. Binding an approved
mapping to execution remains a separate approval step.

## Planned `RAPID_PRICE_LIFT` rule

The first rule version will evaluate a fixed time window using decimal-safe
calculations for:

- price change in basis points;
- aggressive-buy share for the approved actor set;
- actor-set share of traded notional or quantity;
- repeated executions above a reference price; and
- the mechanical difference after excluding the approved actor set.

Thresholds live in a versioned `CaseManifest`; the model cannot add rules or
calculation code. The exact formula and threshold defaults will be documented
in the same change that implements the rule.

## Counterfactual interpretation

The comparison asks, “What metric does the same deterministic replay produce
after removing this declared event set?” It does not prove that those actors
caused the observed market path. The output must be labeled sensitivity
analysis and retain references to both included and excluded events.

## Abstention

WeaveTrail should return `INCONCLUSIVE` or `REVIEW_REQUIRED` when a required
identity, time, side, price, quantity, or mapping cannot be established. It
must not fill a missing safety-critical value from a model guess.

## Synthetic data

All committed scenarios are synthetic. They are designed to test contracts,
failure handling, determinism, and traceability—not to estimate performance in
a real market.
