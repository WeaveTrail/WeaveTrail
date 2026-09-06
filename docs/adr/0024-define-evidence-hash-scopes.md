# ADR 0024: Define evidence hash scopes without expanding semantic results

## Status

Accepted.

## Context

Independent Evidence Bundle assembly and verification remain planned. They need
a published preimage definition before implementation. Current result hashing
already serializes only the engine version, canonical event projection and
optional complete evaluation. Approval mappings and case scope are not inputs.
The FSC daily quotation artifact demonstrates successful normalization without
a rule result. Event 1.1/1.2 and Proposal 1.4/1.5 coexist under the engine version
and literal goldens preserved by ADR 0022.

Bundle 1.2 cannot express this artifact. It also omits finding gates, requires
non-null sensitivity for all results, and contains no full approvals or bundle
hash. ADR 0018 left the result-specific bundle policy open.

## Decision

Publish the exact preimages, canonical serialization rules and exhaustive field
table in [Evidence hash scopes](../EVIDENCE_HASH_SCOPES.md). Keep the existing
`canonicalReplayResultHash` unchanged. This makes the implementation's scope
authoritative over the broader wording in ADR 0002: the hash alone does not
bind case scope. The separation is intentional, not a reason to expand it.

Add the opt-in `EvidenceBundleV13Schema` alongside the unchanged 1.2 schema.
Choose this now, rather than defer to #13, so that the table describes real
declared fields and the assembly/verifier task has one concrete target. An
optional `replay` group distinguishes absence of normalization from successful
normalization with an optional full engine evaluation. Reuse the engine result
schema so finding gates and INCONCLUSIVE's null sensitivity are not lost.
Store complete mapping and case proposals and supplied approval records;
approval absence is explicit through omission, never an invented approval.

Define `bundleHash` over every 1.3 field except itself using the existing
canonical serializer. Provide only the pure hash primitive over an already
supplied declaration. Source declarations, approved mappings, manifests and
their complete audit records belong to this scope. It deliberately changes
when audit metadata changes; the semantic result hash does not. ADR 0002's
volatile-metadata exclusion remains the rule for semantic hashes, not this
enclosing declaration hash. No provenance identity from ADR 0005 is renamed or
widened.

Tests compare all schema paths to the published table and both production
serializations to independently table-projected preimages, including absent
evaluation, version coexistence and full approval mutations. Existing engine
version, result goldens, API shape and tests remain unchanged.

## Consequences

1.2 remains explicitly available for existing strict consumers; migration to
1.3 needs original source/proposal/approval data and complete engine output,
not a fabricated conversion of its lossy summary. Shape validation and hashing
do not establish relationships among those fields. Bundle assembly, export,
independent verification, source resolution and approval binding remain planned
in #13. No UI, export/verify route, signature or authenticity claim is added.
