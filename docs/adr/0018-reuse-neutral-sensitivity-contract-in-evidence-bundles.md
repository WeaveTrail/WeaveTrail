# ADR 0018: Reuse the neutral sensitivity contract in Evidence Bundles

- Status: Accepted
- Date: 2026-09-05

## Context

The declared Evidence Bundle contract used comparison names that could be read
as claims of attribution or causation. The implemented Rapid Price Lift result
already exposes a strict sensitivity shape for a mechanical metric comparison
after removing the approved actor set.

## Decision

Evidence Bundle version `1.2` directly reuses
`RapidPriceLiftSensitivitySchema`. It requires the
`MECHANICAL_METRIC_COMPARISON` marker and the existing signed decimal-string
metric validation. The contract strictly rejects version `1.1`, removed names,
mixed shapes, and unknown keys. Consumers must migrate versions and field names
explicitly; no aliases, coercion, or automatic conversion are provided.

This decision changes contract vocabulary and validation only. It does not
recompute metrics, authenticate a bundle, or establish attribution, guilt, or
causation.

## Consequences

Strict consumers must adopt the `1.2` shape. Reusing the shared schema prevents
the declared bundle contract from drifting from the implemented rule result.

Bundle assembly, export, and independent verification remain planned. The
current required sensitivity-object policy is retained; result-specific bundle
behavior, including the `INCONCLUSIVE` case, remains a future decision.
