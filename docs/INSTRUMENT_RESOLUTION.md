# Instrument and index resolution

English is the source of record. [한국어](INSTRUMENT_RESOLUTION.ko.md)

`@weavetrail/instrument-resolver` resolves a supplied name or code on an explicit
event date. It accepts a validated, admitted listing and daily-quote bindings as
arguments. It opens no store, fetches no URL and calls no model. Application
composition supplies and verifies immutable inputs.

## Contract and matching

The new contracts are version `1.0`, exported from
`@weavetrail/contracts/instrument-resolution` and the contracts root. This is an
additive API; existing event, mapping, approval and evidence contracts require
no migration. Callers adopting it supply:

- A request with `query` (1–256 characters) and `eventDate` (`YYYY-MM-DD`). The
  caller determines the event's calendar date; the resolver invents no timezone.
- An `InstrumentListing`: a listing identity, source records and unique
  instrument identities. Each identifier has its kind, literal value, inclusive
  `validFrom`/`validThrough`, and source ID, one-based row number and column.
- Daily-quote bindings with dataset ID, instrument ID, source record and the
  actual observed dates. A date range with gaps does not establish availability.

Identifier kinds are `SHORT_CODE`, `ISIN`, `KOREAN_NAME`, `ENGLISH_NAME`,
`ABBREVIATION` and `FORMER_NAME`. English names and abbreviations must be
explicitly supplied with provenance; neither translation nor abbreviation
generation runs. A former name matches only within its recorded validity.
Codes keep leading zeroes, punctuation and share-class distinctions. Matching
normalizes Unicode to NFC, trims outer whitespace and folds ASCII letter case.
It preserves internal spaces and uses no substring, edit-distance or similarity
match. An instrument's multiple matching identifiers become reasons for one
candidate, rather than competing candidates. No identifier kind takes priority
over a different instrument's equal identifier.

| Resolution                                    | Observable behavior                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `RESOLVED`                                    | Exactly one instrument matches on the event date; reasons retain the literal identifiers, validity and source coordinates. |
| `REVIEW_REQUIRED` / `AMBIGUOUS_NAME`          | Multiple instruments match; every candidate and reason is returned, without quotation links.                               |
| `UNRESOLVED` / `NO_EXACT_MATCH`               | The supplied listing contains no equal identifier; the name remains unlinked.                                              |
| `UNRESOLVED` / `NAME_NOT_VALID_ON_EVENT_DATE` | An equal identifier exists, but no recorded validity includes the event date.                                              |

A resolved identity has a separate quotation status: `LINKED` when an admitted
binding contains the event date, otherwise `UNAVAILABLE` with
`NO_ADMITTED_QUOTES_ON_EVENT_DATE`. Availability never breaks an identity tie.
Invalid shapes, unreviewed reuse flags, permission review after retrieval,
unknown evidence sources, duplicate instrument/source identities, duplicate
dataset/instrument bindings and conflicting metadata for one source ID throw
before resolution. Duplicate date lists are rejected; callers combine dates
explicitly. These failures produce no linked instrument or rule result.

## Snapshot binding

Every result, including ambiguous and unresolved results, records the listing
ID, its canonical SHA-256 fingerprint and its source records. Each record
retains publisher, origin, retrieval time, reviewed reuse terms, attribution,
collector/projection version and provenance-record URL. The permission flags
are operator admission evidence, not a legal assessment performed by Zod.

Committed references contain the source artifact identity and SHA-256 plus
paths and hashes for original response bytes. Service references retain the
immutable snapshot ID and original-byte SHA-256. For service inputs, composition
must resolve and re-hash the stored snapshot before calling the resolver; the
resolver never refetches its origin.

The listing fingerprint preimage contains schema version, listing ID, source
IDs/references and instruments with dated identifiers/evidence. Source records
sort by source ID, instruments by instrument ID, and identifiers by canonical
JSON using code-unit ordering. Retrieval and permission-review timestamps and
display provenance are excluded. Actual validity dates and immutable references
are included. The fingerprint identifies this lookup input; it is neither a
replay result hash nor proof of publisher authenticity or human approval.
Resolver version `exact-dated-identifiers-v1` is recorded separately.

## Synthetic input coverage

The quotation-derived listing and web composition have been withdrawn. The algorithm is verified over supplied synthetic listings.

## Reproduction and limits

```bash
pnpm exec vitest run packages/instrument-resolver/src/resolver.test.ts packages/instrument-resolver/src/dependency-boundary.test.ts
```

Tests cover Korean/English names, abbreviations, short codes, ISINs, both sides
of a synthetic issuer rename, code reuse, collisions, unmatched names, missing
quotes, snapshot references, source-byte hashes and input-order invariance.
The boundary test follows runtime exports and type imports through the resolver,
contracts and kernel, and pins all declared workspace dependency classes. The
resolver does not load storage, provider or rule code.

An unresolved result describes the supplied listing's coverage, not the
existence or absence of an instrument in the wider market. Resolution is input
preparation; it establishes no pattern support, legal conclusion, causal
relationship or investment recommendation. See
[ADR 0051](adr/0051-resolve-exact-dated-identifiers-over-admitted-listings.md).
