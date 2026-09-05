# ADR 0021: Admit licensed real data under recorded provenance

## Status

Accepted

## Context

Every committed artifact was synthetic by invariant. That kept the repository
free of licensing and privacy exposure, but it also meant no source in the
repository came from outside the project. The heterogeneous-interpretation
problem the workbench addresses was demonstrated only on dialects the project
had itself designed, so a reader could not distinguish a real normalization
problem from a self-made one.

Not every real source is admissible. Exchange data collected directly and
brokerage quotation feeds restrict third-party provision, and committing them
to a public repository is exactly that. Published national open-data
distributions carry no such restriction.

Real market data also cannot answer every question a rule asks. Public
quotations are daily aggregates: they carry no execution-level time, no trade
side, and no participant identifier. `RAPID_PRICE_LIFT` treats a participant
identifier as an eligibility condition, so an artifact without one produces
`INCONCLUSIVE` through `INSUFFICIENT_ELIGIBLE_EVENTS` rather than reaching a
gate.

## Decision

Admit real data whose published licence permits commitment, modification, and
redistribution, on the condition that its provider, origin, retrieval date,
licence, and required attribution are recorded beside it. Synthetic data
remains the default, and the condition applies to every real artifact rather
than to market data alone.

Keep the existing prohibitions and extend them: never commit personal,
customer, order, or production trading data, or any data whose licence does not
permit third-party provision.

A committed real artifact carries no fabricated attribute. Do not attach an
invented participant, trade side, hypothesis, or pattern verdict to a real
instrument. Where a real source cannot supply a field, leave it unmapped and
let the workflow reach its review state rather than defaulting a value.

Alternatives rejected:

- Committing real executions with real issuer and date, then adding invented
  participants. No redistributable source of execution-level domestic data
  exists, and attaching invented conduct to a named issuer on a real date
  produces a fabricated record that reads as verifiable.
- Calibrating synthetic values against retrieved data that is not committed.
  A reader cannot inspect what is absent, so the claim would not be checkable.
- Keeping the all-synthetic invariant. The interpretation claim then rests
  entirely on artifacts the project authored.

## Consequences

A real artifact demonstrates interpretation and its limits; a synthetic
artifact carries the path that reaches a verdict and resolves a finding to its
source rows. The point at which the real source stops is a stated outcome, not
a defect: execution-level participant attribution is not published, which is
part of the investigative gap the workbench addresses.

`CONTRIBUTING.md` carries the same condition, so contributors are not given two
mutually exclusive rules. Public documentation that describes all repository
data as synthetic must be corrected where a real artifact lands.

This decision governs admissibility and provenance recording only. It changes
no contract, hash scope, ordering rule, or result vocabulary.
