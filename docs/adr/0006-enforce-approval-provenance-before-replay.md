# ADR 0006: Enforce approval provenance before replay

- Status: Accepted
- Date: 2026-08-30

## Context

A bare approval status could be written by the same producer that proposed a
mapping or case. Workflow states had no code-owned transition rule, case scope
was not checked against canonical events, and mapping confidence did not affect
whether replay was allowed.

## Decision

The contracts package owns the complete workflow vocabulary and legal
transition table. Pre-replay identity conflicts enter `INPUT_REVIEW_REQUIRED`;
after resolution they re-enter at `UPLOADED` because changed input invalidates
an earlier mapping proposal.

Canonical events produce one deterministic `DatasetProfile` containing the
canonical dataset hash, sorted distinct instrument and actor identifiers, and
the normalized event-time bounds. It is the only event-derived input to case
scope validation. A case outside any of those bounds fails closed before
replay.

Mapping and case approvals are records, not status values. Each record binds an
artifact hash to an `APPROVED` or `REJECTED` decision and retains an opaque
non-secret reviewer reference, approval time, and justified field overrides.
Case Manifest `1.2` therefore replaces its bare `status` with a required
approval record and rejects empty actor sets. Mapping proposals keep their
`1.1` shape, but replay requires a separate matching mapping approval record.
Approved artifacts are produced by parsing against their proposal schemas, so
every schema-owned proposal field is covered by `approvedArtifactHash`; the
case approval record itself remains outside that artifact to avoid a hash
cycle.

The fixture confidence review threshold is declared as `1.0`. A mapping field
below that threshold or marked `REVIEW_REQUIRED` needs an override naming its
field path and giving a non-empty reason. This conservative fixture policy
makes every non-exact match explicit; confidence calibration remains future
provider work.

Rule configuration is selected from a closed rule-ID/version registry. The
registry defines parameter names and string shapes only. It defines no
threshold values, defaults, formulas, metrics, or verdict logic.

## Consequences

Illegal state jumps and replay without both matching approvals return a
pre-replay `REVIEW_REQUIRED` outcome and produce no result hash. Reviewer
identity and approval time remain available for later evidence assembly but do
not enter `canonicalResultHash`; protecting complete approval records in a
bundle remains separate work.

## Contract migration

- Consumers of workflow state strings call `applyTransition` and handle its
  explicit rejection instead of assigning a next state directly.
- Case Manifest `1.1` payloads do not validate as `1.2`. Producers must provide
  a non-empty actor set, a registered rule configuration, and an approval record
  whose `approvedArtifactHash` covers the proposal fields without the approval
  record itself.
- Mapping approval consumers hash the schema-validated Mapping Proposal `1.1`
  artifact and supply a separate matching approval record. Flagged or
  non-exact fields require justified override paths.
