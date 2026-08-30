# ADR 0005: Derive source provenance before replay

- Status: Accepted
- Date: 2026-08-30

## Context

Canonical events previously contained hand-authored event IDs and placeholder
row hashes. The replay result was deterministic once events existed, but a
reviewer could not reproduce the link from a committed source row to an event.
One ambiguous `datasetHash` name also served both source-file identity and
canonical dataset meaning.

## Decision

Source ingestion keeps four hash or identifier roles distinct:

1. `sourceArtifactHash` is SHA-256 over the exact committed bytes. Synthetic
   CSV and JSON Lines fixtures use LF line endings so checkout conversion cannot
   silently change this identity.
2. `rawRowHash` is SHA-256 over canonical JSON containing the verbatim raw
   column/value strings and the declared artifact-hash/row-number coordinate.
   The canonical raw-row serializer sorts keys by UTF-16 code-unit order and
   performs no value coercion.
3. `eventId` is the readable, percent-encoded composite
   `event:<datasetId>:<venueId>:<sourceEventId>`. It depends on source identity,
   never row position, content, or ingestion order.
4. `canonicalDatasetHash` is SHA-256 over the ordered canonical event
   projections. Equivalent approved source dialects therefore converge even
   when their artifact and row hashes differ.

Approved mappings alone select transforms from the closed transform allowlist.
A source column absent from that mapping, a duplicate source or target mapping,
an unknown transform, a rejected value, a missing required target, a duplicate
coordinate, or an artifact hash mismatch stops with a structured review
outcome or ingest error before a dataset or replay hash exists.

`eventId` remains in the protected semantic projection because it is the stable
identity used for ordering and evidence references. `rawRowHash` remains on the
event for source traceability but is outside the semantic projection: two
source dialects can encode the same event with different raw text.

## Contract migration

- `SchemaMappingProposalSchema` advances from `1.0` to `1.1` and replaces
  `datasetHash` with `sourceArtifactHash`.
- `CaseManifestSchema` advances from `1.0` to `1.1` and replaces `datasetHash`
  with `canonicalDatasetHash`.
- `EvidenceBundleSchema` advances from `1.0` to `1.1`, replaces `datasetHash`
  with `canonicalDatasetHash`, and requires a `sourceArtifactHash` entry for
  each declared source artifact.
- The fixture mapping provider input now uses `sourceArtifactHash`.
- Derived event IDs alter protected canonical events, so the replay engine
  advances from `0.2.0-foundation` to `0.3.0-foundation` and the literal result
  hash is repinned.

Older payloads must retain their original schema and engine version. Consumers
must migrate field names explicitly rather than interpreting legacy
`datasetHash` by context.

## Consequences

Every generated fixture event can be traced to and re-derived from one exact
committed row. Source-file identity, raw-row identity, canonical meaning, and
event identity can now be verified independently. The small CSV reader supports
the committed synthetic dialect only; general upload parsing and preview remain
outside this decision.
