# ADR 0001: AI proposes and deterministic code decides

- Status: Accepted
- Date: 2026-08-25

## Context

Heterogeneous event sources benefit from semantic interpretation, but replay
results must be repeatable, reviewable, and traceable. Allowing a model to
generate calculation code or set the final result would make that guarantee
dependent on a probabilistic component.

## Decision

Models are restricted to versioned schema-mapping and case-proposal contracts.
Their output requires runtime validation and explicit approval. Versioned code
alone performs normalization, calculation, rule evaluation, counterfactual
comparison, and canonical hashing.

## Consequences

- Ambiguity becomes `REVIEW_REQUIRED` rather than an inferred value.
- A model provider can be replaced without changing replay semantics.
- New calculations require code, tests, and a rule-version change.
- The system is less autonomous by design; a reviewer remains in the loop.
