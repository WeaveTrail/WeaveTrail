# ADR 0011: Use RFC 8785 finite-number serialization

## Status

Accepted.

## Context

Protected artifacts contain finite JavaScript numbers such as proposal
confidence and replay counts. Calling their representation merely a JSON
number does not specify signed zero, binary precision, fixed/exponent cutovers,
or exponent spelling for an independent implementation. The guided lab also
used a private serializer instead of the replay boundary's serializer and did
not expose browser hashing failures to the reviewer.

## Decision

Finite JSON numbers follow RFC 8785 section 3.2.2.3 over the IEEE 754 binary64
value already held by the runtime. Serialization uses the shortest
round-trippable ECMAScript representation, including `-0` as `0`, lowercase
`e`, the required exponent sign, and the specified fixed/exponent cutovers.
Non-finite numbers remain rejected.

This decision adopts only the RFC 8785 finite-number rule. WeaveTrail does not
claim full JSON Canonicalization Scheme compliance and retains its existing
UTF-16 object-key ordering and `undefined` handling.

Exact prices, quantities, money, financial rates, and thresholds remain
decimal strings. A number has already entered the binary64 precision domain
before serialization; canonicalization cannot recover precision lost earlier.

The canonical serializer is runtime-neutral and exposed through a browser-safe
package subpath. Node-only SHA-256 remains in the server hashing module. The
guided lab uses the shared serializer for mapping and case approvals, then Web
Crypto for SHA-256. Canonicalization or digest failure displays a stable error,
leaves the corresponding approval unset, and keeps replay blocked.

## Consequences

Schema Mapping Proposal and Case Manifest advance from `1.2` to `1.3` without
field-shape changes. The runtime rejects `1.2`; producers must migrate the
version, recompute the approval artifact hash, and obtain reapproval.

The engine advances from `0.5.0-rule` to `0.6.0-canonical-number`, so canonical
result hashes are repinned. Rule version `1.1`, its formulas, findings,
sensitivity, abstention reasons, and declared outcomes do not change.
`sourceArtifactHash`, `rawRowHash`, and `canonicalDatasetHash` remain unchanged
because their current protected inputs contain no JSON numbers. Independent
Evidence Bundle assembly and verification remain planned.
