# Evidence hash scopes

This is the published target for Evidence Bundle assembly and independent
verification, which remain planned in [#13](https://github.com/WeaveTrail/WeaveTrail/issues/13).
The contracts and hash primitives exist; an exported, independently verified
bundle does not. See [ADR 0024](adr/0024-define-evidence-hash-scopes.md).

## Canonical serialization

Both definitions use `sha256Canonical`: SHA-256 of the UTF-8 bytes returned by
`canonicalJson`, without a BOM, whitespace padding or trailing newline, encoded
as 64 lowercase hexadecimal characters. Object keys sort lexicographically by
UTF-16 code units at every depth, including integer-looking keys. Object
properties whose value is `undefined` are omitted. Arrays retain their supplied
order; array holes, undefined elements and a top-level undefined value are
rejected. Null is a value, distinct from an absent property. Non-finite numbers
are rejected. Finite JSON numbers use ECMAScript `JSON.stringify` spelling,
including negative zero as `0`, as specified by RFC 8785 section 3.2.2.3.
Strings use JSON escaping; no Unicode normalization is applied. This is not a
claim of full JCS compliance (in particular, no additional lone-surrogate
validation is implemented).

Prices, quantities, money, rates and thresholds remain decimal strings. This
serializer does not turn them into numbers or normalize their spelling.
Canonical event validation and normalization happen before result hashing,
including decimal-string normalization, UTC nanosecond time normalization,
ordering and duplicate handling. Bundle hashing does not perform those steps,
reorder any array, or parse/transform the declaration: it hashes the supplied
contract value. A future assembler must supply validated canonical events;
checking those claims independently belongs to #13.

## Semantic result

`canonicalResultHash` is exactly the existing `canonicalReplayResultHash`:

```text
SHA256(canonicalJson({
  engineVersion: "0.7.0-canonical-decimal",
  events: canonicalEvents.map(projectCanonicalEvent),
  ...the evaluation property only when evaluation exists
}))
```

The preimage's keys are `engineVersion`, `events` and, optionally, `evaluation`.
The latter is the complete engine result, including rule identity/version,
non-comparable event count, all findings (including `gate`), sensitivity, and
the reason when INCONCLUSIVE. No result is synthesized for normalization alone.
The hash function itself does not sort or validate its arguments; callers
already supply the ordered, deduplicated canonical events. The event projection
is precisely the 15 `CANONICAL_EVENT_FIELDS`; absent optional fields stay absent.

This hash alone does **not bind case scope**. It does not serialize the approved
mapping, manifest, their hashes, or their approvals. Different scopes that
produce identical events and evaluation can therefore have the same result
hash. Mapping/manifest protection belongs to `bundleHash`. Reviewer identity,
approval/export timestamps, run IDs, `receivedAt` and `workflowState` cannot
change the semantic result hash. Counts and source traces in the HTTP response
are not additional preimage members. This definition narrows the broad wording
in ADR 0002 to the existing implementation; it changes no engine bytes or goldens.

## Bundle declaration

`EvidenceBundleV13Schema` declares a separate, opt-in `bundleVersion: "1.3"`.
Its `bundleHash` is `SHA256(canonicalJson(bundle with only bundleHash omitted))`,
implemented by `evidenceBundleHash`. Every other declared field is covered,
including source-artifact hash declarations, complete mapping and case
proposals, complete supplied approval records, workflow state, event collection
metadata and the claimed result/dataset hashes. Changing an approval time can
change this hash while leaving `canonicalResultHash` unchanged. `bundleHash`
excludes itself to avoid self-reference; no other field is excluded from it.

An omitted approval records its absence; it does not mean APPROVED. A present
record includes `approvedArtifactHash`, `reviewerRef`, `decision`, every override
path and reason, and `approvedAt`, with no audit-field projection. Records may
describe rejection. There is no invented reviewer or case for an unapproved
artifact. Arrays preserve their declared order, including mappings, source
declarations and overrides. No automatic array sorting or approval-history
reconstruction is implied. The current workflow does not persist an audit log.

These are hash-scope and shape checks, not evidence verification: they do not
check source bytes against their declarations, match approvals to proposals,
bind proposals to events, enforce workflow consistency, or recompute evaluation
or either nested hash. That work remains #13. Hash equality does not establish
authenticity, reviewer authentication or signatures.

The four provenance identities retain ADR 0005's one-to-one boundaries:
`sourceArtifactHash` identifies exact source bytes; `rawRowHash` identifies a
coordinate and verbatim row strings; `eventId` identifies the composite source
identity; `canonicalDatasetHash` hashes ordered semantic event projections.
Neither result nor bundle hashing adds a fifth provenance identity or broadens
one of those four. A bundle covers source declarations, not embedded raw bytes;
raw rows and display provenance are not fields in this declared export shape.

## Exhaustive 1.3 field table

`P` means included in that hash's preimage; `N` means excluded. Paths use `[]`
for each array element. Object/array containers carry their listed descendants,
including empty arrays; absent optional members contribute nothing. The
`sensitivity` row applies to the null branch, its descendant rows to the object
branch. Result paths below `replay` appear without that wrapper in the result
preimage. Its engine version is the fixed engine constant, not a caller override.
There are no export timestamp or run-ID fields in 1.3; strict validation rejects
unknown fields instead of silently giving them a scope.

<!-- hash-scope-table:start -->

| Field                                                                | canonicalResultHash | bundleHash |
| -------------------------------------------------------------------- | ------------------- | ---------- |
| `bundleVersion`                                                      | N                   | P          |
| `sourceArtifacts[].sourceArtifactHash`                               | N                   | P          |
| `mappings[].proposal.mappingVersion`                                 | N                   | P          |
| `mappings[].proposal.sourceArtifactHash`                             | N                   | P          |
| `mappings[].proposal.constants.schemaVersion`                        | N                   | P          |
| `mappings[].proposal.constants.datasetId`                            | N                   | P          |
| `mappings[].proposal.constants.venueId`                              | N                   | P          |
| `mappings[].proposal.constants.eventType`                            | N                   | P          |
| `mappings[].proposal.fields[].sourceColumn`                          | N                   | P          |
| `mappings[].proposal.fields[].targetField`                           | N                   | P          |
| `mappings[].proposal.fields[].transform`                             | N                   | P          |
| `mappings[].proposal.fields[].confidence`                            | N                   | P          |
| `mappings[].proposal.fields[].evidence`                              | N                   | P          |
| `mappings[].proposal.fields[].status`                                | N                   | P          |
| `mappings[].approval.approvedArtifactHash`                           | N                   | P          |
| `mappings[].approval.reviewerRef`                                    | N                   | P          |
| `mappings[].approval.decision`                                       | N                   | P          |
| `mappings[].approval.overrides[].fieldPath`                          | N                   | P          |
| `mappings[].approval.overrides[].reason`                             | N                   | P          |
| `mappings[].approval.approvedAt`                                     | N                   | P          |
| `case.proposal.manifestVersion`                                      | N                   | P          |
| `case.proposal.caseId`                                               | N                   | P          |
| `case.proposal.canonicalDatasetHash`                                 | N                   | P          |
| `case.proposal.hypothesis.pattern`                                   | N                   | P          |
| `case.proposal.hypothesis.instrumentId`                              | N                   | P          |
| `case.proposal.hypothesis.actorIds[]`                                | N                   | P          |
| `case.proposal.hypothesis.startTime`                                 | N                   | P          |
| `case.proposal.hypothesis.endTime`                                   | N                   | P          |
| `case.proposal.rules[].ruleId`                                       | N                   | P          |
| `case.proposal.rules[].ruleVersion`                                  | N                   | P          |
| `case.proposal.rules[].parameters.minimumPriceChangeBps`             | N                   | P          |
| `case.proposal.rules[].parameters.minimumAggressiveBuyShareBps`      | N                   | P          |
| `case.proposal.rules[].parameters.minimumActorConcentrationShareBps` | N                   | P          |
| `case.proposal.rules[].parameters.minimumExecutionsAboveReference`   | N                   | P          |
| `case.proposal.rules[].parameters.minimumRemovalSensitivityBps`      | N                   | P          |
| `case.proposal.aiTrace.provider`                                     | N                   | P          |
| `case.proposal.aiTrace.model`                                        | N                   | P          |
| `case.proposal.aiTrace.promptVersion`                                | N                   | P          |
| `case.proposal.aiTrace.confidence`                                   | N                   | P          |
| `case.proposal.aiTrace.referencedEventIds[]`                         | N                   | P          |
| `case.approval.approvedArtifactHash`                                 | N                   | P          |
| `case.approval.reviewerRef`                                          | N                   | P          |
| `case.approval.decision`                                             | N                   | P          |
| `case.approval.overrides[].fieldPath`                                | N                   | P          |
| `case.approval.overrides[].reason`                                   | N                   | P          |
| `case.approval.approvedAt`                                           | N                   | P          |
| `workflowState`                                                      | N                   | P          |
| `replay.engineVersion`                                               | P                   | P          |
| `replay.canonicalDatasetHash`                                        | N                   | P          |
| `replay.events[].schemaVersion`                                      | P                   | P          |
| `replay.events[].eventId`                                            | P                   | P          |
| `replay.events[].sourceEventId`                                      | P                   | P          |
| `replay.events[].datasetId`                                          | P                   | P          |
| `replay.events[].venueId`                                            | P                   | P          |
| `replay.events[].eventTime`                                          | P                   | P          |
| `replay.events[].receivedAt`                                         | N                   | P          |
| `replay.events[].sequence`                                           | P                   | P          |
| `replay.events[].instrumentId`                                       | P                   | P          |
| `replay.events[].eventType`                                          | P                   | P          |
| `replay.events[].side`                                               | P                   | P          |
| `replay.events[].actorId`                                            | P                   | P          |
| `replay.events[].counterpartyId`                                     | P                   | P          |
| `replay.events[].orderId`                                            | P                   | P          |
| `replay.events[].price`                                              | P                   | P          |
| `replay.events[].quantity`                                           | P                   | P          |
| `replay.events[].rawRowHash`                                         | N                   | P          |
| `replay.evaluation.ruleId`                                           | P                   | P          |
| `replay.evaluation.ruleVersion`                                      | P                   | P          |
| `replay.evaluation.nonComparableEventCount`                          | P                   | P          |
| `replay.evaluation.result`                                           | P                   | P          |
| `replay.evaluation.reason`                                           | P                   | P          |
| `replay.evaluation.findings[].gate`                                  | P                   | P          |
| `replay.evaluation.findings[].ruleId`                                | P                   | P          |
| `replay.evaluation.findings[].observedValue`                         | P                   | P          |
| `replay.evaluation.findings[].threshold`                             | P                   | P          |
| `replay.evaluation.findings[].passed`                                | P                   | P          |
| `replay.evaluation.findings[].referencedEventIds[]`                  | P                   | P          |
| `replay.evaluation.sensitivity`                                      | P                   | P          |
| `replay.evaluation.sensitivity.comparison`                           | P                   | P          |
| `replay.evaluation.sensitivity.priceChangeBps`                       | P                   | P          |
| `replay.evaluation.sensitivity.priceChangeBpsWithoutApprovedActors`  | P                   | P          |
| `replay.evaluation.sensitivity.removalSensitivityBps`                | P                   | P          |
| `replay.canonicalResultHash`                                         | N                   | P          |
| `bundleHash`                                                         | N                   | N          |

<!-- hash-scope-table:end -->

The schema/table exhaustiveness test traverses every version/union branch,
including optional fields. Serialization tests independently project values
using this table and compare both production hash functions with those
preimages. Field mutation probes exercise inclusion and exclusion; editing a
scope or adding an undocumented field fails CI.

## Stopped artifacts and version coexistence

With no successful normalization, omit `replay`: there are no events, dataset
hash, result hash or rule evaluation to claim. The bundle hash still covers the
source declarations and whatever proposals/approval records are present. A
failed HTTP request continues to return its existing 422 review shape without
a result hash; this PR does not export such a request as a bundle.

Successful foundation normalization supplies `replay`, including its events,
dataset hash and result hash, but omits `replay.evaluation`. This is the FSC
`real/fsc-stock-quotes-20260903.jsonl` artifact after explicit mapping approval:
workflow state `MAPPING_APPROVED`, Event 1.2, Proposal 1.5, no case, no actor or
rule verdict. Its result hash protects the engine version and canonical event
projection. The bundle hash additionally protects its declaration and approval.
INCONCLUSIVE is different: it is a completed rule evaluation with a reason,
empty findings and null sensitivity; all of that evaluation is result-hashed.

Event 1.1 and 1.2 use the same 15-field projection, including `schemaVersion`
and `eventType`; optional absent fields are never filled in. No event-version
conversion happens during hashing. Proposal 1.4 and 1.5 are covered in full by
the bundle hash and never directly by the result hash; the daily proposal's
constant `eventType` exists only in 1.5. Manifest 1.3 is stored as its complete
proposal plus the separate, optional approval record. Its case identity,
hypothesis, rule parameters and AI trace are all bundle-only inputs. Thus one
definition covers every committed source and case without version upgrades,
invented real-data attributes or changed literal result hashes.

## Bundle 1.2 compatibility

`EvidenceBundleSchema` and its `EvidenceBundle` type remain strictly version 1.2;
existing migration rejection tests remain intact. Callers must explicitly opt
into `EvidenceBundleV13Schema` / `EvidenceBundleV13`; neither schema accepts the
other version. There is no automatic conversion, assembler or verifier.

1.2 declares a lossy result summary, requires non-null sensitivity even for
INCONCLUSIVE, and requires a result. It cannot represent the stopped FSC
artifact, full engine findings or complete approvals, and has no `bundleHash`.
No complete bundle-hash scope is assigned to 1.2. Its `canonicalResultHash`
continues to name the existing engine hash, but the 1.2 summary alone cannot
reconstruct that preimage. The preceding table describes only actual 1.3 fields.

Migration requires the original artifacts and engine output: place the full
engine evaluation under `replay.evaluation` (including `gate` and null
sensitivity when INCONCLUSIVE), canonical events and hashes under `replay`,
mapping proposals/approvals under `mappings`, and the Manifest 1.3 proposal and
approval under `case`. The old top-level `caseId` lives in `case.proposal.caseId`;
1.3 records the approved proposal hash at `case.approval.approvedArtifactHash`
when that approval exists. The old standalone `manifestHash` is not a substitute
for the original proposal and approval record, or an additional result-hash
input. Do not recover missing events, approvals, gates
or abstention reasons by inventing them from a 1.2 summary. Actual assembly and
validation of these relationships remain planned in #13.
