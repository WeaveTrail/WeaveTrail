# ADR 0037: Record every replay source with adjacent provenance

## Status

Accepted

## Context

Licensed published artifacts already carry machine-readable
`*.provenance.json` records, while synthetic artifacts shared one generic
display label and the published-schema synthetic pair used a prose README.
That split made the claim that a synthetic dialect derives from a published
schema difficult to audit and allowed a newly committed fixture to have no
source record at all.

The provenance explains input origin only. It must not enter mapping approval,
canonical event or result hashes, and a schema or market-rule citation must not
be mistaken for retrieved market data.

## Decision

Every committed replay source has one machine-readable provenance record. Real
sources keep their existing recorded-provenance files; synthetic sources use an
adjacent `*.provenance.json` sidecar whose `artifacts.runtimeSource` path and
SHA-256 identify the exact fixture bytes. Repository-authored fixtures state
that no published-schema derivation is claimed. Published-schema projections
add separate `schemaSources` and `ruleSources`, a column-by-column
correspondence, the properties taken from specifications, invented properties,
and any field the investigation needs but the source cannot supply.

All external references have a resolvable HTTPS URL and retrieval date. Market
rule references say explicitly that they are rules rather than observations.
Every synthetic record says that all values are invented, no real entity is
represented, and no market data was retrieved, committed or redistributed.

The display-only `SourceProvenance` object carries a `recordUrl`. The source-row
panel links to it directly for both synthetic and real sources. It remains
outside every approval and canonical hash preimage.

A filesystem test enumerates committed CSV and JSON Lines replay sources under
both source-owning packages, resolves each record's declared runtime artifact,
checks its SHA-256, and requires exact one-to-one coverage. It separately pins
the FIX 4.4 and H0STCNT0 published field lists to their committed columns and
checks that every correspondence names a recorded schema source.

## Consequences

- Adding or renaming a committed replay source requires adding or updating its
  provenance record; an orphan or duplicate claim fails the test.
- Synthetic and licensed published sources use one discoverable sidecar
  mechanism without pretending that synthetic values have a data licence or
  retrieval event.
- The source-row page reaches the complete record in one link while keeping
  verbose provenance out of mapping approvals and deterministic results.
- Link availability is checked when the citation is recorded; offline CI
  validates URL shape and retrieval dates but does not make network calls.
