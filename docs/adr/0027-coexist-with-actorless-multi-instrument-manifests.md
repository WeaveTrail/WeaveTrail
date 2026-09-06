# ADR 0027: Coexist with actorless multi-instrument manifests

## Status

Accepted. Verified with a committed synthetic two-instrument daily-quotation
source and contract and profile-validation tests.

## Context

Case Manifest `1.3` names one `instrumentId`, fixes the pattern to
`RAPID_PRICE_LIFT`, and requires at least one `actorId`. That shape correctly
protects existing execution cases, but it cannot state a pattern over several
published quotation series when the source supplies no participant identity.
Treating the absent field as proof that nobody acted would invent a fact, while
inventing an actor would violate the source boundary.

Changing `1.3` in place would reinterpret approved artifacts and the six
committed scenarios whose hashes are pinned. Extending the existing rapid-price
rule to several instruments would also change rule semantics before a separate
versioned rule exists.

## Decision

Keep the existing `CaseManifestProposalSchema` and `CaseManifestSchema` as
direct, strict `1.3` entry points. Add parallel strict `1.4` proposal and
approved-manifest schemas, plus explicit versioned unions for consumers that
handle both versions. No `1.3` payload is migrated or reachable only through a
new schema.

Version `1.4` replaces singular `instrumentId` with a non-empty, duplicate-free
`instrumentIds` declaration. It does not retain a second singular field:
requiring both would create two sources of scope truth, while making either one
optional would weaken strict structural discrimination. Profile validation
iterates the declaration in submitted order and reports every absent instrument
at `hypothesis.instrumentIds[index]`.

The closed pattern vocabulary is `RAPID_PRICE_LIFT` and
`CROSS_MARKET_SESSION_REVERSAL`. The exported participant-requirement table is
contract policy: rapid price lift requires at least one participant identifier,
while cross-market session reversal permits an empty list. Both proposal and
approved-manifest schemas apply that policy. An empty list means the source
supplies no participant identities; it does not mean that nobody acted.
Profile validation requires the canonical dataset's actor set to be empty for
that declaration, preventing an actorless source claim over actor-bearing data.

The committed synthetic actorless source contains two daily-quotation
instruments and is registered with the deterministic fixture mapping provider.
It has no committed pattern verdict. The later cross-market rule, its
parameters, gates, baseline declaration, result and abstention reasons are
defined in [ADR 0032](0032-evaluate-declared-cross-market-session-reversals.md).

## Consequences

Existing `1.3` manifests, scenario bytes, approvals, rule evaluation and golden
hashes remain unchanged. Consumers can opt into `1.4` explicitly or use the
versioned union, then validate every declared instrument against one canonical
dataset profile. Actorless declarations additionally validate that the profile
itself supplies no actor identifiers.

The current replay request and rapid-price evaluator continue to consume the
direct `1.3` schema. A `1.4` manifest can be proposed, approved, checked against
a profile and passed to the cross-market engine entry point. The existing
single-source replay request remains unchanged; combined-artifact orchestration
and its guided surface are separate work.
