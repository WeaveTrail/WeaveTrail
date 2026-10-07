# ADR 0061: Retire the planned service components

- Status: Accepted
- Date: 2026-10-06

## Context

[ADR 0050](0050-place-planned-service-components.md) gave package homes, tiers
and import allowlists to the components of an evidence-graded service:
collectors, a document parser, event structuring, conclusion definitions, feed
statistics, claim extraction and checking, and a brief with share links.
[ADR 0056](0056-withdraw-the-committed-real-data-tier.md) withdrew the
committed real-data tier and superseded only the source-dependent parts of
that record.

The project plan has since changed. The work now measures and restricts the
models that propose inputs to the existing deterministic engine: model
evaluation, measured routing and bounded case-scope proposals. The service
issues those placements served were closed as not planned. Keeping the matrix
in the architecture document would present abandoned components as planned
work and reserve tiers and edges nothing will use.

## Decision

Retire every placement ADR 0050 accepted for a component that does not exist.
No package, tier or workspace edge is reserved for collectors, document
parsing, event structuring, conclusion definitions, feed statistics, claim
extraction and checking, or briefs and share links. The implemented
`instrument-resolver` and `service-store` packages remain as they are; the
store stays unwired from the web app and its collection and sharing work is not
planned.

A model holds two roles: field mapping, and a bounded case-scope proposal
chosen from the `DatasetProfile`. The control line is "AI proposes. Human
approves. Code verifies. Evidence traces back." The planned components for
those roles (mapping runs on any compatible endpoint, scoring with a non-model
baseline, model selection, proposal routing and the case-scope proposer) build
on existing packages and contracts. Each records its package home and edges in
the architecture document when it lands, under the existing package admission
rules, rather than in advance.

The entry points (readme, architecture and limitations, in both languages)
describe what exists as it is, mark each planned item as planned, and carry no
model accuracy, comparison or selection until an evaluation with its
definition, command and environment is published.

## Supersession

This supersedes the remaining placement decisions of ADR 0050. Its text is
retained as a historical record; the placement matrix it adopted is pinned at
the last architecture revision that carried it.

It also supersedes the planned work other records still name for the retired
service:

- [ADR 0048](0048-bind-evidence-grades-to-code-verified-declarations.md):
  wiring validated declarations, badges and a tally into every displayed
  sentence is no longer planned. The implemented Evidence Grade contract,
  verifier and presentation primitives remain as they are.
- [ADR 0052](0052-derive-claim-resolution-scope-from-acquisitions.md): the
  full claim checker, numeric definition binding, text extraction, sentence
  evidence and the claim-check screen are no longer planned. Generic claim
  scope checking over a caller-supplied manifest remains.
- [ADR 0055](0055-admit-display-only-published-data-to-the-service-tier.md):
  moving sources to a display-only service tier, its response and share
  surface, and a persistent host for the store and collector are no longer
  planned. Its admission and display-only rules stay in force for any source
  the service store might admit.

## Consequences

- The architecture document lists only existing edges and the planned
  evaluation, routing and case-proposal components.
- Reviving a retired component needs a new placement decision, not a return to
  ADR 0050.
- `entry-point-parity.test.ts` checks that both readme languages state the
  control line and the two roles, that later plan versions read as planned,
  and that no entry point carries a model percentage.

## Verification

Run `pnpm check` and `pnpm build`.
