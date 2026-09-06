# ADR 0023: Separate published data ownership from synthetic scenarios

## Status

Accepted.

## Context

Published daily quotations must retain their source provenance and absent
attributes. Exporting them through the synthetic scenario registry gives that
package responsibility for data it did not author and cannot freely mutate.

## Decision

Keep `packages/scenarios` restricted to synthetic datasets and mutations.
Move published responses, derived artifacts, provenance and declared mappings
to `packages/published-data`, which depends only on contracts. Its code uses
the repository code licence; each external artifact retains its own recorded
source permission and attribution. This is not a licence change.

The web application combines the two registries in `src/lib/replay-sources.ts`
for source preparation and request validation. The fixture mapping provider
explicitly imports proposals from each owner. Shared display provenance types
live in contracts, outside canonical events and approval hashes.

## Consequences

Published artifacts are no longer reachable through scenario package exports.
The source selector keys, original response bytes, derived bytes, mapping
approval hashes and normalization results stay unchanged. Only filesystem
paths in reproduction instructions and provenance metadata change. Existing
real-artifact tests pin bytes and normalization hashes; the synthetic registry
test rejects real provenance, and web tests exercise the composed registry.
