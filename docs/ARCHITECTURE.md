# WeaveTrail Architecture

WeaveTrail separates probabilistic interpretation from authoritative
calculation. A model can narrow ambiguity, but only validated inputs and
versioned code can produce a replay result.

## Component chain

![Ten components in two rows: committed source rows are untrusted input; a constrained schema mapper proposes a field mapping; a reviewer approves that proposal bound to its artifact hash; versioned code re-derives the canonical event set and computes a deterministic dataset profile; a planned bounded case proposer would select an actor group and interval from profile facts alone; a reviewer approves the case scope; the deterministic replay engine evaluates the rule; the source trace resolves every finding back to its committed rows; Evidence Bundle assembly remains planned. Any gate can refuse, and a refused request carries no result hash](assets/component-chain.svg)

A `PLANNED` component is specified in contracts and tracked as open work rather
than implemented today.

## Trust boundaries

These boundaries implement one control model: authority is separated by layer
rather than by location, so each layer holds what it may do, what it may never
do, and the record it leaves behind. The README states the model; this document
is where each layer's enforcement lives.

| Layer        | Enforced by             | May never                                                       | Leaves behind                                                     |
| ------------ | ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| L1 Interpret | Interpretation boundary | mutate a row, compute a metric, or own a result                 | proposal, per-field evidence, confidence, proposal status         |
| L2 Approve   | Approval boundary       | edit a computed result, or widen the `DatasetProfile` facts     | approval records bound to proposal hashes, justified overrides    |
| L3 Decide    | Decision boundary       | execute model-authored code, or read outside the approved scope | engine and rule version, `canonicalResultHash`                    |
| L4 Evidence  | Evidence boundary       | present a finding whose lineage cannot be resolved              | `eventId`, `rawRowHash`, and the committed source row behind them |

Two invariants cross all four.

1. **No layer holds two authorities.** The proposing layer cannot approve, the
   approving layer cannot compute, and the deciding layer cannot widen its own
   scope.
2. **A result is true under stated conditions rather than in general.** The
   engine version, the rule version, and the threshold each gate compared
   against travel with the result.

The replay HTTP boundary is not one of these layers. It is the transport gate
that carries a request across them and validates every input before any layer
acts on it.

### Interpretation boundary

Provider output is untrusted data. The mapper may select only source columns
that exist and transforms from a fixed allowlist. Invalid shape, low confidence,
unknown columns, or unsupported transforms return `REVIEW_REQUIRED`.

The guided lab executes the server-only fixture provider against a table keyed
by the committed `sourceArtifactHash`. It returns a structured `1.4` proposal
containing approved dataset and venue constants plus each source column, closed
target field, transform, confidence, evidence, and proposal status. This
proposal is not an approval. The lab exposes an explicit local-reviewer action;
the browser and API use the same runtime-neutral canonical serializer, the API
recomputes the proposal hash, and it enforces any required overrides. The
browser uses Web Crypto only after canonical serialization and fails closed
with a visible error if either step cannot complete.

### Replay HTTP boundary

`POST /api/replay` accepts a strict object with a committed source-artifact
scenario, one of `baseline`, `shuffle`, or `duplicate`, one to 64 declared
source rows, an optional mapping approval record, and an optional approved
`CaseManifest`. Caller-authored canonical
events are rejected. The server obtains the scenario proposal, verifies the
approval against that exact proposal, derives the executable mapping as a pure
projection, and checks every submitted row against the server-owned committed
row at the same artifact coordinate. A missing coordinate or differing column
fails closed; the server does not silently substitute fixture values. Only
then does it derive events. Mutations operate after that derivation.

Invalid JSON, contract violations, and canonicalization ambiguity return HTTP
`422` with one body shape: `status: REVIEW_REQUIRED` and a non-empty `issues`
array whose entries carry `code`, `path`, and `message`. The response also
exposes the request's final `workflowState`: input and canonicalization failures
use `INPUT_REVIEW_REQUIRED`, mapping-gate failures use
`MAPPING_REVIEW_REQUIRED`, and case approval, profile, or rule-configuration
failures use `CASE_REVIEW_REQUIRED`. The failing execution stage selects this
state directly; shared issue codes such as `APPROVAL_RECORD_REQUIRED` are not
reclassified from their strings. The runtime response contract rejects issue
codes that are incompatible with the selected workflow stage. Review responses
never contain a replay result or canonical result hash. HTTP `500` remains
reserved for defects outside these declared input failures.

Review issue paths are structural arrays relative to the **submitted JSON
request body**. String segments are literal object keys (including dots or
numeric-looking names); number segments are nonnegative integer, zero-based
array indices. In particular, `["rows", i]` addresses submitted position `i`,
never the source coordinate's `rowNumber`. Existing values are addressed
precisely; missing values point to the nearest existing parent container.
`[]` means the entire body, including when `INVALID_JSON` prevents parsing it.

Illustrative paths:

| Failure                                 | Request path                                           |
| --------------------------------------- | ------------------------------------------------------ |
| Changed price in submitted row `i`      | `["rows", i, "values", "px"]`                          |
| Missing actor column in row `i`         | `["rows", i, "values"]`                                |
| Omitted declared row                    | `["rows"]`                                             |
| Foreign artifact in row `i`             | `["rows", i, "coordinate", "sourceArtifactHash"]`      |
| Required mapping override               | `["mappingApproval", "overrides"]`                     |
| Missing mapping approval                | `[]`                                                   |
| Case approval hash mismatch             | `["caseManifest", "approval", "approvedArtifactHash"]` |
| Case instrument outside profile         | `["caseManifest", "hypothesis", "instrumentId"]`       |
| Missing or duplicate rule configuration | `["caseManifest", "rules"]`                            |

Source artifact hashes, source row numbers, missing column names, and required
proposal field paths remain diagnostic message context. They are not request
path segments. Messages are for human review, not a machine-readable protocol.
Duplicate/conflicting row sets point to `["rows"]`; structural failures in the
server-owned mapping point to `["mappingApproval"]`.

**Consumer migration:** use path segments directly against the submitted body.
Remove source-row-number lookups, dotted-string splitting, numeric-string
coercion, and special handling for the former `fields`/`caseApproval` roots.
Multiple missing items can share a parent path; retain each issue and message.
Approval records' `overrides[].fieldPath` still use proposal-relative `fields.n`
addresses and must not be rewritten. The response has no version field; this
correction does not change approval artifacts, engine version, workflow states,
HTTP status, rule verdicts, or canonical result hashes. See
[ADR 0016](adr/0016-use-request-relative-review-paths.md).

A successful response is contract-validated and includes fixture mode, scenario,
mutation, boundary text, final `workflowState`, engine version, event counts,
ordered event identifiers, and the canonical result hash. A foundation request
without a case manifest stops at `MAPPING_APPROVED` and has no `sourceTrace`.
An approved case replay completes at `REPLAYED` and also carries the closed rule
result, five gate findings for a conclusive evaluation, a mechanical sensitivity
comparison, and a required `sourceTrace` projection.

`sourceTrace.traceVersion` is `"1.0"`. Its `entries` contain exactly one entry
per distinct finding event, in canonical replay order. Each entry contains:

- `event`: the allowlisted canonical fields `schemaVersion`, `eventId`,
  `sourceEventId`, `datasetId`, `venueId`, `eventTime`, `instrumentId`,
  `eventType`, and `rawRowHash`, plus `sequence`, `side`, `actorId`,
  `counterpartyId`, `orderId`, `price`, and `quantity` when present.
- `sourceRow`: the exact `coordinate` (`sourceArtifactHash`, positive decimal
  string `rowNumber`) and unchanged string-valued `values` from the committed
  source. The existing `scenario` field names the artifact at this single-artifact
  boundary. CSV row numbers start at 2 after the header; JSON Lines starts at 1.

After approval, source validation, and replay succeed, `buildFindingSourceTrace`
resolves the returned canonical events against trusted committed rows using
`deriveRawRowHash`, which hashes both coordinate and values. It does not repeat
mapping or rule evaluation. Missing or ambiguous links are internal server
errors, never partial successful traces or financial `INCONCLUSIVE` results.
INCONCLUSIVE has no findings and an empty trace. Review responses remain closed
HTTP 422 responses with no trace or result. Internal event arrays are still
excluded from `replay.events`; `receivedAt` is excluded from the event view,
though its unchanged original source text may appear in raw column values.

The lab provides a native disclosure for each gate, including failed gates,
with its canonical events, hashes, coordinates, and source text. The browser
selects server-resolved entries for display without deriving evidence. Changing
inputs or approvals and starting a run clear previous evidence; superseded
requests cannot replace the current result.

#### Trace response migration

Strict consumers of successful `REPLAYED` responses must update to accept the
required versioned `sourceTrace` member and validate its exact finding-reference
set. It is not optional on newly produced case responses. Foundation and review
response shapes are unchanged. The projection and its version remain outside
`canonicalResultHash` and approval artifacts; engine/rule versions, three rule
outcomes, and semantic hashes are unchanged. Trace inspection is implemented;
Evidence Bundle assembly, export, and independent verification remain planned.
See [ADR 0017](adr/0017-resolve-finding-source-traces-on-the-server.md).

Profile failures use `CANONICAL_DATASET_HASH_MISMATCH`,
`INSTRUMENT_OUTSIDE_DATASET_PROFILE`, `ACTOR_OUTSIDE_DATASET_PROFILE`, or
`TIME_WINDOW_OUTSIDE_DATASET_PROFILE`; missing rule configuration uses
`RULE_CONFIGURATION_REQUIRED`.

### Approval boundary

The running HTTP route creates a request-local workflow at `UPLOADED` and sends
every state change through the contracts package's `applyTransition`. Rejected
transitions leave the current state unchanged. The executed state machine
prevents unapproved mapping output from reaching replay:

```text
UPLOADED -> MAPPING_PROPOSED -> MAPPING_REVIEW_REQUIRED
                           \-> MAPPING_APPROVED -> CASE_PROPOSED
CASE_PROPOSED -> CASE_REVIEW_REQUIRED
             \-> CASE_APPROVED -> REPLAYED -> EXPORTED
```

Any pre-replay state can enter `INPUT_REVIEW_REQUIRED`; resolving the input
conflict starts a new request and therefore a new workflow at `UPLOADED`.
Request workflows and transition histories are not persisted or correlated
across requests. Contracts own this legal transition table and reject every
other transition. Replay requires separate mapping and case
approval records bound to the hashes of their proposed artifacts. A flagged or
non-exact mapping field additionally requires a justified reviewed override.
See
[ADR 0014](adr/0014-keep-replay-workflows-request-local.md) for the
request-local lifetime, successful terminal states, and hash boundary.

Canonical events produce a deterministic `DatasetProfile` containing only the
canonical dataset hash, sorted instrument and actor sets, and normalized time
bounds. Case validation cannot widen those facts. Reviewer identity and
approval time remain audit metadata and do not alter the semantic replay hash.

### Decision boundary

The replay engine owns ordering, deduplication, decimal arithmetic, window
aggregation, rule evaluation, mechanical sensitivity comparison, and canonical
hashes.
It never executes code written by a model.

### Evidence boundary

Canonical hashes exclude volatile metadata. Findings refer to canonical
`eventId` values, and those events retain `sourceEventId` and `rawRowHash` so a
reviewer can reach the source row. The committed synthetic fixtures derive
those identifiers from exact source-artifact bytes and raw rows rather than
hand-authored placeholders.

### Evidence Bundle 1.2 migration

`EvidenceBundleSchema` version `1.2` reuses the strict `sensitivity` object
from the Rapid Price Lift rule result. Consumers of the declared bundle
contract must migrate explicitly: version `1.1` inputs, removed fields, mixed
shapes, and unknown keys are rejected. There are no aliases, coercion, or
automatic converter.

| Old 1.1 path                               | New 1.2 path                                      |
| ------------------------------------------ | ------------------------------------------------- |
| `counterfactual`                           | `sensitivity`                                     |
| `counterfactual.originalPriceChangeBps`    | `sensitivity.priceChangeBps`                      |
| `counterfactual.withoutSuspectedActorsBps` | `sensitivity.priceChangeBpsWithoutApprovedActors` |
| `counterfactual.attributableDifferenceBps` | `sensitivity.removalSensitivityBps`               |

The new shape requires `bundleVersion: "1.2"` and
`sensitivity.comparison: "MECHANICAL_METRIC_COMPARISON"`. Its metrics retain
the shared signed decimal-string validation; this change does not add decimal
normalization or arithmetic checks. The comparison mechanically removes the
approved actor set and reports the resulting metric difference. It does not
establish attribution, guilt, or causation. Schema validation establishes the
bundle's shape, not that metrics were recomputed or that evidence is authentic.

Runtime replay behavior is unchanged. Bundle assembly, export, and independent
verification remain planned. The declared bundle continues to require a
sensitivity object, while the running rule result uses `null` for
`INCONCLUSIVE`; result-specific bundle policy remains planned in
[the public bundle-verification issue](https://github.com/WeaveTrail/WeaveTrail/issues/13).
The contract regressions in
[`evidence-bundle.test.ts`](../packages/contracts/src/evidence-bundle.test.ts)
exercise these strict migration boundaries with illustrative synthetic inputs.

## Package boundaries

| Package         | Owns                                                            | Must not own                             |
| --------------- | --------------------------------------------------------------- | ---------------------------------------- |
| `contracts`     | Versioned schemas and closed vocabularies                       | Provider calls or verdict logic          |
| `ai-harness`    | Provider adapters, structured proposals, deterministic fixtures | Final calculations or automatic approval |
| `replay-engine` | Canonicalization, rules, hashes, evidence assembly              | Free-form inference or legal conclusions |
| `scenarios`     | Synthetic datasets and mutations                                | Production or personal data              |
| `evals`         | Versioned cases and measurement aggregation                     | Undocumented benchmark claims            |
| `web`           | Human review flow and export surface                            | A second implementation of replay logic  |

## Determinism contract

For one validated dataset and approved manifest:

- source times normalize to fixed-width UTC nanoseconds before comparison and
  hashing;
- canonical event order is normalized `eventTime -> sequence -> eventId` using
  locale-independent UTF-16 code-unit ordering for string tie-breakers;
- equivalent `Z` and explicit-offset representations normalize to the same
  event time;
- a dataset that mixes present and absent sequence values fails closed before
  replay;
- exact duplicates do not alter the result;
- conflicting duplicates fail closed rather than being silently selected, and
  multiple conflicts are reported in canonical source-identity order;
- after exact duplicate collapse, canonical `eventId` values are unique across
  source identities or replay fails with `CONFLICTING_EVENT_IDENTIFIER` before
  ordering and hashing;
- canonical hashes cover an explicit semantic event projection and exclude
  collection metadata (`receivedAt` and `rawRowHash`);
- equivalent approved CSV and JSON Lines dialects converge to the same
  `canonicalDatasetHash` and replay result while retaining distinct artifact
  and row hashes;
- validated price and quantity strings remove insignificant fractional zeroes
  and normalize signed zero before duplicate comparison or hashing;
- decimal values are never normalized or calculated with JavaScript floating
  point;
- finite JSON numbers use RFC 8785 section 3.2.2.3 binary64 spelling through a
  runtime-neutral serializer shared by browser approval and server validation;
- ratio gates compare exact scaled-integer cross-products;
- `canonicalResultHash` includes engine version and canonical events, plus the
  rule result, findings, and sensitivity when evaluation occurs;
- response `workflowState` is outside `canonicalResultHash` input;
- reruns produce the same `canonicalResultHash`.

Fixed-precision time normalization, locale-independent ordering, mixed-sequence
rejection, every permutation of the committed four-event fixture,
conflict-safe duplicate handling, canonical identifier uniqueness and conflict
selection, canonical decimal spelling, the canonical event projection, and a
committed literal golden hash have tests today.
Source-artifact, raw-row, event-ID, canonical-dataset and dataset-profile
derivation, profile-bounded cases, workflow transitions, and approval-gated
replay also have committed tests today. Exact financial arithmetic and three
declared scenario results now have committed tests.
See
[ADR 0003](adr/0003-use-nanosecond-utc-and-code-unit-ordering.md) for the exact
time representation and input limits, and
[ADR 0004](adr/0004-protect-semantic-events-and-reject-identity-conflicts.md) for
identity and projection scope.
See
[ADR 0009](adr/0009-use-exact-rapid-price-lift-rules-and-explicit-abstention.md)
for the rule formula and abstention boundary.

## Provenance contract migration

Hash names identify one boundary rather than relying on context. Mapping
proposal `1.4` uses `sourceArtifactHash`; case manifest `1.3` and Evidence
Bundle `1.2` use `canonicalDatasetHash`; bundles additionally list the
`sourceArtifactHash` of every declared artifact. Legacy `datasetHash` fields are
not accepted by the new strict contracts. See
[ADR 0005](adr/0005-derive-source-provenance.md) for derivation and migration
rules.

## Approval contract migration

Case Manifest `1.3` retains the immutable approval record introduced by `1.2`,
requires at least one actor, and accepts only registered rule parameters for
the declared rule version. Mapping Proposal `1.4` retains the closed identity
constants and transform pairs and makes `DECIMAL_STRING` produce canonical
decimal spelling. Both artifact types use the shared RFC 8785 finite-number
serialization rule for JSON numbers. Superseded artifacts are rejected and
require migration and reapproval. Replay Request `2.0`
accepts source rows and a mapping approval instead of canonical events. Older
artifacts retain their original version and migrate explicitly. See
[ADR 0006](adr/0006-enforce-approval-provenance-before-replay.md) and
[ADR 0007](adr/0007-bind-approved-mapping-to-replay.md) and
[ADR 0011](adr/0011-use-rfc-8785-number-serialization.md).
Decimal-string normalization and its version migration are recorded in
[ADR 0013](adr/0013-normalize-canonical-decimal-strings.md).

## Deployment boundary

The MVP uses one Next.js application and local workspace packages. Fixture mode
works without an external model or database. Provider adapters run server-side;
browser bundles must never receive provider credentials. A separate replay
service or database is deferred until measured scale or persistence needs
justify it.

## Presentation boundary

The five public routes use a product-local snapshot of the paper-first design
tokens and original brand mark pinned to `WeaveTrail/design-reference` revision
`3f078da1970e8accd83fbdde73308a2a24d0d1f8`. The design repository is not a
build or runtime dependency. Product copy and every visible evidence value stay
owned by this repository's runtime responses and committed synthetic scenarios.
See [ADR 0015](adr/0015-apply-the-canonical-design-reference.md).
