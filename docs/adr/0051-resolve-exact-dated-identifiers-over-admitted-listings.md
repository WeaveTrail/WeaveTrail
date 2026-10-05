# ADR 0051: Resolve exact dated identifiers over admitted listings

> Historical decision: source-dependent portions are superseded by
> [ADR 0056](0056-withdraw-the-committed-real-data-tier.md). The original
> account below describes the withdrawn tier. Generic contracts, synthetic
> behavior and provenance safeguards remain applicable.

- Status: Partially superseded by ADR 0056 (committed sources and composition)
- Date: 2026-09-28

## Context

Releases and user input name instruments rather than canonical quotation
identities. A present-day name can select the wrong historical instrument, and
an abbreviation can denote multiple instruments. Similarity ranking or choosing
the candidate with available prices would hide those ambiguities. A new listing
also needs reviewed permission before acquisition; an accessible API is not
evidence of permission to modify and redistribute its content.

## Decision

Implement `packages/instrument-resolver` at tier 2 as placed in
[ADR 0050](0050-place-planned-service-components.md). It imports only the narrow
instrument-resolution contracts and canonical serialization/hashing primitives.
The application passes listings and quote bindings as arguments. Published
data ownership stays in tier 1 `published-data`; the resolver imports no peer
package, storage, provider or web code. A source-closure test follows exports
and type imports, and a manifest test covers runtime/development/optional/peer
workspace dependencies. Web remains at tier 3, importing the tier 2 resolver.

Add version `1.0` contracts for listings, source references, dated identifiers,
requests, quote bindings and results. Use exact equality after NFC, outer-space
trimming and ASCII case folding. Preserve internal whitespace, punctuation,
leading zeroes and share-class suffixes. A caller supplies published or reviewed
names, English names, abbreviations and former names with validity dates and
source coordinates; the resolver creates none. It matches only identifiers
valid on the event date. More than one distinct instrument fails closed as
`REVIEW_REQUIRED` with all candidates and reasons, irrespective of quotation
availability. Unmatched and out-of-date names remain unlinked.

Keep quotation availability separate from identity resolution. A quote binding
declares actual observed dates, not an assumed continuous interval. A unique
identity may lack admitted quotations. Duplicate dataset/instrument bindings
and conflicting metadata for one source ID fail instead of being discarded.

Record the listing's semantic fingerprint in every outcome. Hash sorted source
IDs/immutable references and dated instrument identifiers/evidence, with schema
and listing versions. Exclude acquisition/review timestamps and display
provenance. Committed sources retain artifact hashes and original-response byte
hashes; service sources retain snapshot IDs and original-byte hashes. Composition
re-hashes stored inputs; the resolver cannot fetch a changing URL.

Project the initial published listing from the existing admitted FSC quotations.
Copy only source names/codes and restrict each identifier to its observed date.
Do not invent English translations, abbreviations, issuer name changes or
validity between observations. The current KRX listing distribution's reuse
conditions do not meet repository admission requirements; this implementation
acquires no new real source. Existing acquisition records remain unchanged and
do not authorize a new retrieval under current conditions.

## Consequences

Callers get deterministic candidates, match reasons, provenance and admitted
daily-quote links. Application composition returns original numeric strings and
chart rows through the event date. This adds a library API without adding an
HTTP endpoint, input screen, provider authority, rule verdict or approval.
Existing event schemas, replay versions and golden hashes remain unchanged.

The initial published coverage is deliberately bounded by the committed rows;
English/abbreviation/rename behavior is validated with synthetic listings.
Broader coverage requires a separately admitted listing and historical names.
The output makes missing identity and missing quotations observable instead
of claiming coverage beyond those inputs. A generic current-name or fuzzy
resolver was rejected because it cannot make the same date/provenance guarantee.

The public contract, adoption notes, reproduction command and limitations are
in [instrument resolution](../INSTRUMENT_RESOLUTION.md) and its
[Korean counterpart](../INSTRUMENT_RESOLUTION.ko.md).
