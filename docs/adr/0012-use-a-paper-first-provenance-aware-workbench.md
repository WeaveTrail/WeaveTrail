# ADR 0012: Use a paper-first provenance-aware workbench

## Status

Superseded by the design-reference separation recorded in issue #58.

## Context

The design system introduced in PR #57 was initially owned by this product
repository.

## Decision

Move the canonical design system, brand originals, tokens, component specimens,
and detailed visual decisions to
[`WeaveTrail/design-reference`](https://github.com/WeaveTrail/design-reference).
Keep only neutral, accessible presentation in the product and do not add a
build-time or runtime dependency on the design repository.

## Consequences

The accepted historical decision remains visible without duplicating its design
specification. Product-owned replay behavior, result meaning, interpretation
boundaries, canonical values, and accessibility requirements remain local.
