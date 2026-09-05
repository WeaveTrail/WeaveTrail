# ADR 0017: Resolve finding source traces on the server

- Status: Accepted
- Date: 2026-09-05

## Context

Gate findings identify canonical events, but event identifiers alone do not let
a reviewer compare the result with its source record. The engine already retains
raw-row provenance; the public response previously omitted it. Reconstructing
that relationship in the browser would create a second source of evidence.

## Decision

After validated replay, one engine helper resolves finding references against
the returned canonical events and trusted committed source rows supplied by the
server boundary. It indexes rows using the existing raw-row hash over both
coordinate and values. It rejects duplicate coordinates, ambiguous event IDs or
row hashes, and missing links. It neither maps source rows again nor evaluates
rules again. Invariant failures propagate as internal server errors.

The strict REPLAYED response requires `sourceTrace` version `1.0`, containing
one entry per distinct finding event in canonical replay order. An entry has an
explicitly allowlisted event view including `rawRowHash`, and the exact source
coordinate and string-valued columns. `receivedAt` is not an event-view field.
The existing scenario name supplies artifact identity at the current
single-artifact boundary. Foundation and review response shapes do not change;
INCONCLUSIVE has an empty trace.

The projection is outside the semantic result hash and approval artifacts. It
explains source provenance, not a new rule result. Event/rule versions and
canonical hash scopes stay unchanged. The browser renders server-resolved data
as escaped text in native disclosures, including evidence for failed gates.
Changing inputs or approvals invalidates the result and pending responses.

## Consequences

Strict evaluated-response consumers must adopt the required trace member;
[Architecture](../ARCHITECTURE.md#trace-response-migration) documents migration.
Shared finding references do not multiply response entries. Only finding events
are exposed, and copied trace data cannot mutate canonical inputs or fixtures.
Tests recompute hashes from committed CSV and JSON Lines bytes, cover refusal
and empty states, and preserve existing literal result hashes.

This response increases the payload by the referenced source rows. It remains
bounded by the fixture request limit. It is not a portable Evidence Bundle or an
independent verifier; those capabilities remain planned. A future multi-artifact
boundary must define public artifact names explicitly rather than infer them
from UI labels.
