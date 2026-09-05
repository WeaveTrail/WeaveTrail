# ADR 0020: Prepare source order at the caller

## Status

Accepted

## Context

Case Replay sent committed-order rows for every mutation and implemented
`shuffle` as a fixed rotation of mapped events. That did not exercise varying
source-row submission order through approved mapping. Repeating an actual source
coordinate is rejected, while exact derived-event duplication is supported.

## Decision

Prepare source-row permutations in the browser before submitting `rows`.
Fisher–Yates uses browser randomness only for array indices; a bounded swap
ensures that a new shuffle differs from the previous submission when at least
two rows exist. Preserve each original coordinate and verbatim value. Display
the row-number order from the request snapshot. Reset order history on source
changes and guided re-entry. Same-input repeats reuse the prior submission.

The server validates and maps the submitted order without any extra shuffle.
Keep the `baseline | shuffle | duplicate` identifiers and strict JSON shapes.
Callers must now provide the desired shuffle in `rows`; a legacy `shuffle`
request in committed order receives no hidden mapped-event rotation.

Keep duplicate testing at the derived-event representation and label it
explicitly. It submits committed rows and repeats the first mapped event.
Do not weaken duplicate-source-coordinate refusal or silently deduplicate rows.
Both controls retain the approval, completeness and row-value checks.

## Consequences

This supersedes only the after-mapping shuffle behavior described in
[ADR 0019](0019-share-guided-and-working-case-replay-state.md). Its guided
baseline, independent approvals, same-input hash comparison, working-mode
handoff and stale-response guards remain. Input changes clear displayed order
and evidence together; late responses cannot restore obsolete state.

Tests start from fixed committed artifact parser outputs and submit row
permutations through approved replay. They pin existing literal hashes, order,
rule evaluations, source traces, duplicate counts and refusal paths. They do not
prove arbitrary source-file rewriting or new-provenance equivalence. No server
randomness, dependency, protocol field or persisted session is introduced.
