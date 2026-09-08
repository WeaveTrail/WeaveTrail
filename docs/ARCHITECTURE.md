# WeaveTrail Architecture

_[한국어](ARCHITECTURE.ko.md)_

WeaveTrail separates probabilistic interpretation from authoritative
calculation. A model can narrow ambiguity, but only validated inputs and
versioned code can produce a replay result.

## Entry and Case Replay

`packages/scenarios` owns only synthetic datasets and controlled mutations.
`packages/published-data` owns licensed published artifacts, their provenance,
offline generated rows and declared mappings. It depends only on contracts.
The web application's `src/lib/replay-sources.ts` combines the two registries
for its replay route, while its server page loader selects only sources offered
for human review. The scenario package does not import or re-export published
data. The fixture provider explicitly imports mappings from both owners. See
[ADR 0023](adr/0023-separate-published-data-ownership.md).

Each committed source has catalog metadata that states whether it is grounded
in a published schema or licensed published source and therefore
`REVIEWER_FACING`, or exists as an `ENGINE_REGRESSION` fixture. The complete
registry remains available to the engine, provider, API, and contract suites.
Case Replay lists the grounded set plus only those regression fallbacks needed
to keep all three declared result meanings reachable. The complete FIX 4.4
case produces `SUPPORTED`, and the FIX-shaped missing-side case produces
`INCONCLUSIVE`, so both older placeholders are absent from the picker. The
`NOT_SUPPORTED` placeholder remains until a grounded case reproduces that
meaning. A separate FIX-shaped identity-conflict source reaches
`INPUT_REVIEW_REQUIRED` before replay. The expectations page states the exact
condition each case demonstrates, both purposes, Case Replay availability, and
whether a result hash is produced.

Catalog metadata also declares the input mutations offered per source.
Published-schema synthetic sources and result fallbacks offer `baseline`,
`shuffle`, and `duplicate`. Licensed published artifacts offer only `baseline`
and `shuffle`; neither rewrites a committed value, and no control adds a
participant or pattern verdict. See
[ADR 0038](adr/0038-separate-reviewer-facing-sources-from-engine-regressions.md)
and
[ADR 0039](adr/0039-separate-missing-evidence-abstention-from-conflict-review.md).

The overview links to `/replay?mode=guided` and `/why`. `/why` states where the
gate sits relative to an existing surveillance pipeline, cites the published
sources its background rests on, and links on to `/architecture`. The overview
states where WeaveTrail sits before it explains how it works: an existing
surveillance layer raises a candidate, WeaveTrail confirms the scope,
re-verifies and opens the evidence, and a person decides. It detects nothing.

The surface is Korean and English on one set of routes; see
[ADR 0030](adr/0030-hold-language-selection-outside-react.md) for the
mechanism. Headlines, section headings and calls to action are written in each
language rather than translated from the other; step purposes, gate
descriptions, blockers, limitations and disclosures say the same things in
both, with the same scope and the same hedging. Neither language may name a
capability the other omits or present a planned component as working, and
`apps/web/src/app/i18n/bilingual-parity.test.ts` checks that by shape rather
than by string. Contract vocabulary carries one spelling in both. The
fixture-mode and synthetic-source disclosures sit in the site footer, where
every page shows them. Korean is set in a committed face
([ADR 0031](adr/0031-commit-a-korean-face-for-the-korean-surface.md)) and the
layer diagram is drawn from localized copy
([ADR 0032](adr/0032-draw-the-layer-diagram-from-localized-copy.md)). Case Replay
at `/replay` replaces the former `/lab` route with no alias. Guided and working
modes share one server scenario loader and one mounted client surface, including
approval serialization, request generation and server-derived result rendering.

Case Replay is one navigation entry, labelled `Walk through a case`. Above the surface, `Guided walkthrough` and
`Working mode` name the two ways to use it, state what each does and mark the
running one. `/replay` opens the guided walkthrough, `mode=working` selects
working mode, and the guide hands off to `mode=working`. Guided mode places a
step rail beside the case content. The rail leads with the step position, the
step title, the imperative instruction, the unmet condition and the one control
that advances the step; why the step exists, the authority that acted in it and
the step list follow in a region that scrolls on its own. Where a step commits
something the rail renders that control itself, sharing one handler and one
disabled state with the control in the case column; where the step's work
happens inside the case content the rail's control scrolls there and takes
focus. Below the rail breakpoint the action block becomes a bar fixed to the
bottom of the viewport. The step list is navigable for reading; a step counts as
completed only while the visitor's own work still satisfies it. See
[ADR 0026](adr/0026-open-guided-steps-with-intent-and-read-ahead.md) and
[ADR 0033](adr/0033-lead-each-guided-step-with-its-action.md).

`/case-2026-09-03` is one authored case over committed licensed artifacts: the
KOSPI 200 index and its front-month future on 2026-09-03, against the index's
own 2026-07-01 baseline. The page opens on the published prices for that day,
drawn from the artifact and labelled as published values; nothing the rule
produces is shown until the rule has run. A visitor approves the case scope in
the browser, the approval travels to `/api/case-2026-09-03`, and the server
rebuilds the scope from the committed artifacts and refuses any approval whose
hash does not cover it. `CROSS_MARKET_SESSION_REVERSAL` 1.0 then returns the
rank within the approved baseline, each leg's session reversal and multiple, and
a canonical result hash pinned by both `apps/web/src/lib/published-case.test.ts`
and the engine suite. The two published field mappings were reviewed once and
their approval records, approved artifact hash included, are committed in
`apps/web/src/lib/published-case-approvals.ts`; the application verifies the
current proposal against those pins and fails closed with a mapping review stop
when they differ, so a changed mapping reaches review instead of authorizing
itself. The page says the mappings were reviewed rather than presenting them as
the visitor's own approval. Nothing the rule returns — the rank, either
multiple, the result or its hash — is written into page copy: the closing
statement of what the result says is read from the returned analysis, so it
cannot appear before the run or drift from it. Chart geometry parses every
published price to a scaled integer and divides once, on the unitless fraction
a coordinate needs, so no price reaches binary floating point. Candidate
selection is
`STATED_DATE_ONLY_NO_CANDIDATE_SCAN`: the date is stated by a person and the
rule evaluates that date alone.

The guided source is the published-schema projection
`published-execution-fix44.csv` with baseline mutation. Its mapping chapter
embeds the actorless published-schema projection
`published-execution-h0stcnt0.jsonl` as a separate mapping review example.
Each instance owns its proposal-specific approval and
async generation guard. Only an example-completion flag crosses into guide
progress; the example's approval, source and result never enter the case request.
The server loader strips committed case approval records before sending props.

The walkthrough requires explicit mapping and case approvals, a `REPLAYED`
response with evaluation and source trace, opening a finding's source disclosure,
and repeating the same approved case. Completion requires string equality between
the baseline returned hash and a later returned hash; mismatches keep the original
baseline, block completion and remain retryable. A successful handoff exposes
working controls without remounting the case surface, so in-memory approvals and
the result remain valid. The current query is the presentation-mode source of
truth. Re-entering guided mode restores its supported-case baseline and clears
state from working inputs; refresh also starts unapproved. The query supplies no
trusted approval or result state. Guide progress is distinct from the
request-local server workflow.

Advanced controls permute submitted source rows before mapping or duplicate one
derived event after mapping; original coordinates and values remain unchanged.
See [ADR 0019](adr/0019-share-guided-and-working-case-replay-state.md) for shared
journey state and [ADR 0020](adr/0020-prepare-source-order-at-the-caller.md) for
the input-order change.

## Component chain

![Ten components in two rows: committed source rows are untrusted input; a constrained schema mapper proposes a field mapping; a reviewer approves that proposal bound to its artifact hash; versioned code re-derives the canonical event set and computes a deterministic dataset profile; a planned bounded case proposer would select an actor group and interval from profile facts alone; a reviewer approves the case scope; the deterministic replay engine evaluates the rule; the source trace resolves every finding back to its committed rows; Evidence Bundle assembly remains planned. Any gate can refuse, and a refused request carries no result hash](assets/component-chain.svg)

A `PLANNED` component is specified in contracts and tracked as open work rather
than implemented today.

## Trust boundaries

### Published acquisition scopes

Published artifacts declare `bounded-window` or `complete-series` beside their
provenance. The existing FSC first-page window remains unchanged. A complete
series fixes a single date or half-open range and a closed identity, family or
date selector before retrieval, retains every returned page in order and
requires row count equality with an unchanged publisher total. Value predicates
and incomplete pagination are refused.

The manual collector uses reviewed publisher adapters; automated transport tests
remain synthetic. Offline admission compares committed rows, generated source
coordinates and requests with the original page bytes. Neither acquisition
scope enters canonical events or approval hashes. Tests, CI, builds and runtime
use no acquisition network transport. See
[Published acquisition scopes](PUBLISHED_ACQUISITION.md) and
[ADR 0025](adr/0025-distinguish-published-acquisition-scopes.md) and
[ADR 0030](adr/0030-declare-published-market-family-and-range-scopes.md).

### Layer boundaries

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

The Case Replay walkthrough executes the server-only fixture provider against a table keyed
by the committed `sourceArtifactHash`. Existing sources return a structured `1.4` proposal
containing approved dataset and venue constants plus each source column, closed
target field, transform, confidence, evidence, and proposal status. This
proposal is not an approval. The Case Replay surface exposes an explicit local-reviewer action;
the browser and API use the same runtime-neutral canonical serializer, the API
recomputes the proposal hash, and it enforces any required overrides. The
browser uses Web Crypto only after canonical serialization and fails closed
with a visible error if either step cannot complete.

### Replay HTTP boundary

Configured mapping uses an explicit `POST /api/mapping` with only `{ scenario }`.
The application selects the provider from server configuration and the closed
artifact eligibility registry. Only the two synthetic source dialects are
eligible; all other artifacts keep registered fixture mappings. A configured
response must pass strict mapping validation before it is shown for approval.
The response contains `mode`, `proposal`, and an opaque `mappingReceipt` for
configured mode. Model identifier and prompt version are recorded server-side
beside that proposal, encrypted in the receipt. Provider failures use the
existing mapping-review response shape and status 422. Page preparation and
replay do not call the configured provider. See
[ADR 0029](adr/0029-bind-configured-mapping-proposals-to-review.md).

Migration: fixture clients are unchanged. Configured clients first request a
proposal, explicitly approve its exact hash, then include `mappingReceipt` in
the replay request. Receipts expire after 30 minutes and are revalidated before
the approval gate. Neither a receipt nor model output is an approval.

`POST /api/replay` accepts a strict object with a committed source-artifact
scenario, one of `baseline`, `shuffle`, or `duplicate`, one to 64 declared
source rows, an optional mapping approval record, an optional configured
`mappingReceipt`, and an optional approved
`CaseManifest`. Caller-authored canonical
events are rejected. The server obtains the scenario proposal, verifies the
approval against that exact proposal, derives the executable mapping as a pure
projection, and checks every submitted row against the server-owned committed
row at the same artifact coordinate. A missing coordinate or differing column
fails closed; the server does not silently substitute fixture values. Only
then does it derive events, preserving submitted order through mapping.

The caller prepares `shuffle` by permuting the parsed source-row records in
`rows` before submission. Working mode uses a browser-local Fisher–Yates shuffle
and swaps the first two positions if the draw matches the previous submitted
order. For two or more rows each new shuffle run differs from the previous
submission; history starts at committed order and resets on source changes or
guided re-entry. The displayed **Submitted source row order** is taken from the
same request snapshot. The source preview stays in committed order. Explicit
same-input repeats resend the previous rows without drawing another permutation.
Input changes invalidate displayed evidence and order, and superseded responses
cannot restore them. Pure reordering retains existing explicit approvals.

`baseline` submits committed order, and `duplicate` submits committed order then
repeats the first derived event after mapping. Repeated source coordinates are
still rejected. The strict request/response shapes and the three mutation
identifiers are unchanged. Migration: `shuffle` no longer requests a hidden
server-side event rotation. Older callers sending committed-order `rows` with
`shuffle` receive the deterministic result for that submitted order. The server
adds no randomness and never substitutes stored rows for submitted ones.
See [ADR 0020](adr/0020-prepare-source-order-at-the-caller.md).

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
| Case `1.3` instrument outside profile   | `["caseManifest", "hypothesis", "instrumentId"]`       |
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

A successful response is contract-validated and includes the actual mapping
provider mode (`fixture` or `ai`), scenario,
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

The Case Replay surface provides a native disclosure for each gate, including failed gates,
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
The direct profile validator reports `1.4` instruments relative to the manifest
at `["hypothesis", "instrumentIds", i]`. An actorless `1.4` hypothesis against
a profile containing actors reports
`["hypothesis", "actorIds"]`; this keeps the empty declaration's meaning tied
to a source that supplies no participant identities. These engine-relative
paths are not HTTP request paths until a request contract opts into the
versioned manifest union.

### Decision boundary

The replay engine owns ordering, deduplication, decimal arithmetic, window
aggregation, rule evaluation, mechanical sensitivity comparison, and canonical
hashes.
It never executes code written by a model.

### Evidence boundary

Semantic canonical hashes exclude volatile metadata. The separately defined
bundle hash covers the complete supplied approval records, including audit
metadata. Findings refer to canonical
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
verification remain planned. The 1.2 contract continues to require a
sensitivity object, while the running rule result uses `null` for
`INCONCLUSIVE`. The opt-in 1.3 contract below resolves this shape mismatch;
1.2 consumers retain their explicit migration boundary.
The contract regressions in
[`evidence-bundle.test.ts`](../packages/contracts/src/evidence-bundle.test.ts)
exercise these strict migration boundaries with illustrative synthetic inputs.

### Evidence Bundle 1.3 hash scopes

`EvidenceBundleV13Schema` is a separate, strict declaration for planned assembly
and verification. `EvidenceBundleSchema` still validates only 1.2; there is no
implicit conversion. Version 1.3 stores source-artifact declarations, complete
mapping/case proposals and supplied approval records, workflow state, and an
optional `replay` group. A present group contains canonical events, engine
version, dataset/result hashes and an optional complete engine evaluation.
Reusing that evaluation preserves finding `gate` and INCONCLUSIVE's reason,
empty findings and null sensitivity. Missing normalization omits `replay`;
normalization without a rule result omits only `replay.evaluation`.

The original FSC daily quotation artifact ends at `MAPPING_APPROVED` with a
result hash but no evaluation or case manifest. Evidence Bundle `1.3` remains
frozen to Event 1.1/1.2, Proposal 1.4/1.5/1.6 and Manifest 1.3. Hashing converts none
of them and invents no missing fields.

`canonicalResultHash` protects exactly the engine version, 15-field canonical
event projection and evaluation when present. It alone does not bind case
scope, approved mappings or manifests. `bundleHash` covers every 1.3 field
except itself, including the complete proposals, approvals, source-artifact
declarations and event collection metadata. Audit metadata can change this
enclosing hash without changing the semantic result hash.

The normative preimages, exhaustive protected/excluded field table, canonical
serialization and migration notes are published in
[Evidence hash scopes](EVIDENCE_HASH_SCOPES.md), with the decision in
[ADR 0024](adr/0024-define-evidence-hash-scopes.md). Schema and serialization
coverage tests enforce their agreement. Only contracts and the pure bundle
hash primitive are implemented here: assembly, export and independent
verification remain planned in
[#13](https://github.com/WeaveTrail/WeaveTrail/issues/13). Hashing a declaration
does not validate its claimed relationships or authenticate its evidence.

## Package boundaries

| Package          | Owns                                                            | Must not own                             |
| ---------------- | --------------------------------------------------------------- | ---------------------------------------- |
| `contracts`      | Versioned schemas and closed vocabularies                       | Provider calls or verdict logic          |
| `ai-harness`     | Provider adapters, structured proposals, deterministic fixtures | Final calculations or automatic approval |
| `replay-engine`  | Canonicalization, rules, hashes, evidence assembly              | Free-form inference or legal conclusions |
| `scenarios`      | Synthetic datasets and controlled mutations                     | Published, production, or personal data  |
| `published-data` | Licensed published artifacts, provenance, and declared mappings | Synthetic mutations or restricted data   |
| `evals`          | Versioned cases and measurement aggregation                     | Undocumented benchmark claims            |
| `web`            | Human review flow and export surface                            | A second implementation of replay logic  |

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
- canonical dataset and result hashes cover an explicit semantic event
  projection and exclude collection metadata (`receivedAt` and `rawRowHash`);
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
- that preimage contains the complete evaluation, including finding gates,
  non-comparable event count and any INCONCLUSIVE reason; it contains no
  mapping, manifest or approval hash, so the result hash alone does not bind
  case scope;
- response `workflowState` is outside `canonicalResultHash` input;
- reruns produce the same `canonicalResultHash`.

Both result hashing and the separately defined bundle hashing use recursive
UTF-16 code-unit key sorting, omit undefined object properties, reject
non-finite numbers and use RFC 8785 section 3.2.2.3 finite-number spelling.
They preserve array order and hash the UTF-8 canonical JSON without a trailing
newline. No full JCS compliance is claimed. The complete definition and scope
table are in [Evidence hash scopes](EVIDENCE_HASH_SCOPES.md); the engine version
remains `0.7.0-canonical-decimal` and existing literal goldens remain unchanged.

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
proposals `1.4`/`1.5` use `sourceArtifactHash`; case manifest `1.3` and Evidence
Bundle `1.2` use `canonicalDatasetHash`, as does the optional `replay` group in
Bundle `1.3`; bundles additionally list the
`sourceArtifactHash` of every declared artifact. Legacy `datasetHash` fields are
not accepted by the new strict contracts. See
[ADR 0005](adr/0005-derive-source-provenance.md) for derivation and migration
rules.

## Approval contract migration

Case Manifest `1.3` retains the immutable approval record introduced by `1.2`,
requires at least one actor, and accepts only registered rule parameters for
the declared rule version. Parallel Case Manifest `1.4` declares a non-empty
instrument set and applies a closed pattern-to-participant policy; an empty
actor list records identity absent from the source, not absence of actors.
Profile validation therefore requires an empty actor profile for an empty
`1.4` actor declaration. Existing `1.3` artifacts remain valid without
migration. Mapping Proposal `1.4` retains the closed identity
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
Manifest coexistence and per-instrument validation are recorded in
[ADR 0027](adr/0027-coexist-with-actorless-multi-instrument-manifests.md).

## Deployment boundary

The MVP uses one Next.js application and local workspace packages. Fixture mode
works without an external model or database. Provider adapters run server-side;
browser bundles must never receive provider credentials. A separate replay
service or database is deferred until measured scale or persistence needs
justify it.

## Presentation boundary

The seven public routes use a product-local snapshot of the paper-first design
tokens and original brand mark pinned to `WeaveTrail/design-reference` revision
`3f078da1970e8accd83fbdde73308a2a24d0d1f8`. The design repository is not a
build or runtime dependency. Product copy and every visible evidence value stay
owned by this repository's runtime responses and committed synthetic scenarios.
See [ADR 0015](adr/0015-apply-the-canonical-design-reference.md).

## Daily quote and cross-market rule version coexistence

The engine also accepts daily-only Event `1.2` and Mapping Proposals `1.5`/`1.6` with
an approved `DAILY_QUOTE` constant and a trading-date anchor transform. Registry
metadata carries versions/constants by artifact hash. Existing input branches,
engine version, canonical processing and result shapes remain unchanged.
The published FSC KOSPI daily artifact is registered without a case manifest; see
[daily quote normalization](DAILY_QUOTES.md) and
[ADR 0022](adr/0022-normalize-daily-quotes-with-version-coexistence.md).
Proposal `1.6` adds an injective ordered composite for `sourceEventId` only;
the components remain original source columns and the ordinary mapping retains
its duplicate-source and duplicate-target checks. See
[ADR 0031](adr/0031-compose-publisher-source-identities-in-mapping-1.6.md).

Event `1.3` and Proposal `1.7` form a separate opt-in path that retains trading
date, OHLC and the publisher's absolute net change. The
`0.8.0-cross-market-session-reversal` engine evaluates one declared date over
an approved Case Manifest `1.4`, using exact scaled-integer arithmetic, a
declared baseline and per-leg gates. This entry point accepts combined canonical
events from the declared published artifacts; the existing single-source HTTP
Case Replay remains unchanged. See
[ADR 0032](adr/0032-evaluate-declared-cross-market-session-reversals.md).

`CROSS_MARKET_SESSION_REVERSAL` `1.1` is a further opt-in rule contract. Each
leg's approved configuration names one denominator and at least one declared
alternative. Conclusive engine output reports the approved and recomputed
metrics, their ratio, denominator values and meanings under the shared
`MECHANICAL_METRIC_COMPARISON` marker. A minimum price increment is labelled
`INSTRUMENT_MINIMUM_PRICE_INCREMENT_NOT_TRADE_ESTABLISHED_LEVEL`; an inline
approved value also retains its provenance. Missing declared event fields and
non-positive denominators fail closed as `INCONCLUSIVE`, whose sensitivity is
null.

Version `1.0` remains accepted with its existing engine version and hashes.
Strict consumers opt into `1.1`, add the denominator declarations to every leg,
and accept the versioned sensitivity branch; no default or conversion is
provided. Selecting another approved denominator changes the Case Manifest
approval preimage and the canonical engine result, while canonical source
events remain unchanged. See
[ADR 0035](adr/0035-bind-denominator-substitution-to-the-approved-rule.md).

## Published execution-schema mapping support

Mapping Proposal `1.8` is a separate opt-in path for synthetic intraday
executions shaped as published FIX 4.4 `ExecutionReport` and H0STCNT0 response
fields. It fixes `eventType: TRADE`, converts the two published side code sets,
converts FIX UTC timestamps, and combines the H0STCNT0 business-date and
execution-time columns into an explicit KST timestamp. An `unmappedFields`
entry records that H0STCNT0 has no participant/account column; it requires a
justified approval override but never enters the executable mapping or creates
an actor. Existing Mapping Proposals `1.4`–`1.7` do not gain these transforms
and require no migration. See
[ADR 0036](adr/0036-normalize-published-execution-schema-projections.md) and
the adjacent
[FIX](../packages/scenarios/src/sources/published-execution-fix44.provenance.json)
and
[H0STCNT0](../packages/scenarios/src/sources/published-execution-h0stcnt0.provenance.json)
source records.

Every committed replay source now has one machine-readable provenance record.
Synthetic records identify the exact fixture bytes and distinguish
repository-authored fields from published-schema projections; licensed real
records retain their acquisition, permission and derivation details. The
display-only `SourceProvenance.recordUrl` reaches that record from the source-row
panel and remains outside approval and canonical hash inputs. The coverage and
hash check spans both source-owning packages. See
[ADR 0037](adr/0037-record-every-replay-source-with-adjacent-provenance.md).
