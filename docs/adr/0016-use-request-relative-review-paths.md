# ADR 0016: Use request-relative review paths

- Status: Accepted
- Date: 2026-09-05

## Context

Replay rejection paths mixed source row numbers, submitted array indices,
proposal fields, and manifest-relative locations. Some locations did not exist
in the caller's request. Parsing dotted strings also loses literal object keys.

## Decision

HTTP review paths are arrays of literal string object keys and nonnegative
integer array indices relative to the original submitted JSON body. Missing
children resolve to their nearest existing parent; the empty path denotes the
whole body, including invalid JSON. Existing values retain precise locations.

Approval validation produces request-relative segments. Mapping application
carries the submitted row index independently of source coordinates. The case
profile validator produces manifest-relative segments, which the replay gate
prefixes with `caseManifest`. The HTTP boundary retains the longest existing
prefix using own-property and array-bound checks against the original body.
It never splits dotted strings or coerces numeric-looking keys.

Missing source coordinates and columns remain in messages. Mapping proposals
are server-owned, so structural mapping failures point to `mappingApproval`;
required overrides point to its `overrides` array and name the proposal field
in the message. Approval `overrides[].fieldPath` stays proposal-relative and
continues to participate in the same approval artifact semantics.

## Consequences

Clients can follow paths directly in their submitted requests, even after row
reordering. Multiple missing items may share one parent path. Consumers must
remove legacy source-coordinate and synthetic-root handling as described in
[Architecture](../ARCHITECTURE.md). Internal validator consumers must accept
segment arrays instead of dotted strings and respect each validator's scope.

The response retains its current shape and has no added version field. This
changes diagnostics only: HTTP 422, issue codes, workflow transitions, approval
policy, deterministic verdicts, and canonical hashes remain unchanged. Golden
and request-path invariant tests verify those boundaries.
