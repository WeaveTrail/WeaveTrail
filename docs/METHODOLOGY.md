# Methodology

This document defines how to interpret WeaveTrail output and the implemented
`RAPID_PRICE_LIFT` version `1.1` rule.

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
named committed CSV or JSON Lines scenario, a closed mutation, up to 64
declared source rows, a mapping approval record, and an optional approved case
manifest. It never accepts caller-authored canonical
events. The API hashes its own executed `1.2` proposal, checks the approval and
any justified field overrides, verifies every row belongs to the approved
source artifact, and compares its values with the server-owned committed row
at the same coordinate before re-deriving events through the approved mapping.
The engine also verifies that every row number declared by the committed
artifact is submitted and that every submitted row contains every source
column declared by the approved mapping. An omitted row returns
`SOURCE_ROW_MISSING`; an absent column key returns
`APPROVED_SOURCE_COLUMN_MISSING`. A present key with an empty string remains
subject to its existing transform and target-field validation. A differing
value is rejected as `SOURCE_ROW_MISMATCH`. Any failure returns structured
`REVIEW_REQUIRED` with HTTP `422`, an actionable path, and no replay hash.

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
At the replay service boundary, unresolved flagged fields return
`MAPPING_OVERRIDE_REQUIRED` at the field path; the response contract no longer
includes a separate scenario-level `MAPPING_REVIEW_REQUIRED` code. The workflow
state with that name remains unchanged.

The `RAPID_PRICE_LIFT` `1.1` registry accepts only the declared parameter names
for price change, aggressive-buy share, actor concentration, executions above
a reference, and removal sensitivity. Their values are decimal or unsigned
integer strings. The registry supplies no values, defaults, or fallbacks. Rule
evaluation requires exactly one matching `RAPID_PRICE_LIFT` `1.1`
configuration; zero or multiple entries return `RULE_CONFIGURATION_REQUIRED`
before evaluation. The current contract rejects version `1.0`; using the new
eligibility semantics requires migrating the manifest to `1.1`, recomputing
its approval artifact hash, and obtaining a new approval. Existing `1.0`
evidence retains its original version label and is not reinterpreted by this
runtime.

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
values, missing approved columns, missing required targets, duplicate
coordinates, and artifact mismatches stop before canonical dataset or result
hashing. The committed scenario row arrays are pinned by tests to the complete
output of the CSV and JSON Lines artifact parsers. Replay checks declared row
coverage before applying a mutation; mutations may reorder or repeat mapped
events but do not remove the requirement to submit every declared source row.

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
Both dialects produce declared fields. Dialect A is fully resolvable. Dialect
B's `source_note` has a null target and transform and is presented for
adjudication as `REVIEW_REQUIRED` at confidence `0`. The lab will not create an
approval for that proposal until the reviewer records a non-empty reason for
the field override. The approval uses the opaque local reference
`reviewer:local-lab`. The server remains the authority: it independently hashes
that proposal, validates the justified override, and derives the only
executable mapping from it. Proposal status alone never constitutes approval.
The override changes approval metadata, not the approved mapping projection,
so the canonical result hash is unchanged.

## `RAPID_PRICE_LIFT` version `1.1`

An event is eligible when its instrument matches the approved hypothesis, its
type is `TRADE`, its signed-nanosecond event time is inside the inclusive
approved window, and `price`, `quantity`, `side`, and `actorId` are all
present, with `price` and `quantity` both strictly positive. A matching trade
without any one of those rule inputs, or with a non-positive `price` or
`quantity`, increments `nonComparableEventCount` and enters no metric. Eligible
events retain canonical `eventTime -> sequence -> eventId` order.

| Metric                                | Definition                                                      |
| ------------------------------------- | --------------------------------------------------------------- |
| `referencePrice`                      | Price of the first eligible event                               |
| `peakPrice`                           | Greatest eligible price                                         |
| `priceChangeBps`                      | `(peakPrice - referencePrice) * 10000 / referencePrice`         |
| `aggressiveBuyNotional`               | Sum of `price * quantity` for eligible `BUY` events             |
| `totalNotional`                       | Sum of `price * quantity` for all eligible events               |
| `aggressiveBuyShareBps`               | `aggressiveBuyNotional * 10000 / totalNotional`                 |
| `approvedActorBuyNotional`            | Eligible buy notional whose actor is in the approved group      |
| `actorConcentrationShareBps`          | `approvedActorBuyNotional * 10000 / aggressiveBuyNotional`      |
| `executionsAboveReference`            | Approved-actor `BUY` count whose price is above the reference   |
| `priceChangeBpsWithoutApprovedActors` | Price change recomputed after removing the approved actor group |
| `removalSensitivityBps`               | `priceChangeBps - priceChangeBpsWithoutApprovedActors`          |

Removal recomputes both reference and peak from the surviving eligible events.
It removes only the actor group named in the approved manifest.

| Gate                   | Exact condition                                                   |
| ---------------------- | ----------------------------------------------------------------- |
| `PRICE_CHANGE`         | `priceChangeBps >= minimumPriceChangeBps`                         |
| `AGGRESSIVE_BUY_SHARE` | `aggressiveBuyShareBps >= minimumAggressiveBuyShareBps`           |
| `ACTOR_CONCENTRATION`  | `actorConcentrationShareBps >= minimumActorConcentrationShareBps` |
| `REPEATED_EXECUTION`   | `executionsAboveReference >= minimumExecutionsAboveReference`     |
| `REMOVAL_SENSITIVITY`  | `removalSensitivityBps >= minimumRemovalSensitivityBps`           |

For a ratio `a / b` and decimal threshold `t`, the engine compares integer
cross-products at a common scale. It never compares a rendered quotient.
Basis-point values are truncated toward zero to four fractional digits only
when reported; counts are unsigned integer strings. Consequently a displayed
value equal to a threshold can still fail when its exact value is lower.

Because every eligible event has a strictly positive price and quantity,
positive reference-price, total-notional, and survivor-reference checks are
guaranteed by eligibility rather than exposed as separate preconditions.
The remaining preconditions run in this order and stop at the first failure:

| Precondition                              | `INCONCLUSIVE` reason                |
| ----------------------------------------- | ------------------------------------ |
| At least two eligible events              | `INSUFFICIENT_ELIGIBLE_EVENTS`       |
| Positive aggressive-buy notional          | `NO_AGGRESSIVE_BUY_NOTIONAL`         |
| At least two events survive actor removal | `REMOVAL_LEAVES_INSUFFICIENT_EVENTS` |

After all preconditions pass, all five gates passing produces `SUPPORTED`; any
failed gate produces `NOT_SUPPORTED`. Each finding includes its observed
string, configured threshold, pass state, and non-empty canonical event
references.

## Sensitivity interpretation

The comparison asks, “What metric does the same deterministic replay produce
after removing this declared actor group?” It is reported as a mechanical
sensitivity comparison and retains canonical event references.

## Abstention

WeaveTrail should return `INCONCLUSIVE` or `REVIEW_REQUIRED` when a required
identity, time, side, price, quantity, or mapping cannot be established. It
must not fill a missing safety-critical value from a model guess.

## Synthetic data

All committed scenarios are synthetic. They are designed to test contracts,
failure handling, determinism, and traceability—not to estimate performance in
a real market.
