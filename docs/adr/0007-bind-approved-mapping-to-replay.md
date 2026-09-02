# ADR 0007: Bind the approved mapping representation to replay

## Status

Accepted

## Decision

`SchemaMappingProposal 1.2` is the single approved mapping representation. It
includes the dataset and venue constants used to derive event identity, a
closed target-field set, and an explicit target/transform null pairing. The
engine derives `ApprovedSourceMapping` from that proposal with a pure function;
callers do not independently author executable mappings.

`ReplayRequest 2.0` accepts declared source rows and a mapping approval record,
not canonical events. The server hashes its own scenario proposal, verifies the
approval and required overrides, checks each row's source artifact, applies the
derived mapping, and only then invokes deterministic replay. For committed
scenarios, the server also compares each submitted row with the server-owned
row at the same artifact coordinate. A missing coordinate or any key-for-key,
string-for-string value difference fails closed rather than being silently
replaced.

## Consequences

Mapping Proposal `1.1` and requests containing `events` do not validate under
the new contracts, and their hashes do not reproduce as `1.2` artifacts. All
committed approvals must therefore be recomputed. Mapping-application ambiguity
fails closed as `REVIEW_REQUIRED`; no partial replay or result hash is emitted.

Case approval remains an engine-level requirement when a case manifest is
provided. Binding case approval into the HTTP route is owned by the later case
workflow work.
