# ADR 0035: Bind denominator substitution to the approved rule

## Status

Accepted. Verified by contract, invariant and canonical-result-hash tests.

## Context

`CROSS_MARKET_SESSION_REVERSAL` 1.0 fixes its reversal-multiple denominator to
the absolute published `netChange`. A reported multiple can therefore look like
an unqualified observation even though it depends on that denominator choice.
Reviewers need to see the same numerator recomputed against declared
alternatives without turning the comparison into a causal claim or allowing a
display layer to perform financial arithmetic.

Some alternatives are values on the canonical event. Others, such as an
instrument's minimum price increment, are approved instrument parameters rather
than levels established by a trade. Treating those as interchangeable would
misstate what the input represents.

## Decision

Add opt-in rule version `1.1` beside unchanged `1.0`. Each leg declares at least
two uniquely identified denominators and names one as approved. A denominator
is either:

- an allowlisted decimal field on the canonical daily event; or
- a strictly positive declared decimal value with non-empty provenance.

Each denominator also carries an explicit meaning. The literal
`INSTRUMENT_MINIMUM_PRICE_INCREMENT_NOT_TRADE_ESTABLISHED_LEVEL` prevents a
minimum increment from being presented as a traded price. The approved
denominator determines the leg gate, baseline rank and headline reversal
multiple. Because the declaration is inside the Case Manifest rule
configuration, selecting a different approved denominator requires a different
approval artifact hash.

A conclusive `1.1` result reports the approved and every alternative metric in
`sensitivity`, reusing the shared `MECHANICAL_METRIC_COMPARISON` marker. It also
reports the alternative-to-approved metric ratio and the literal interpretation
`MECHANICAL_RECOMPUTATION_NOT_CAUSAL_CONCLUSION`. Arithmetic uses scaled
integers and exact ratios. If both reported metrics are zero, the ratio is null
with `BOTH_METRICS_ZERO` rather than an invented quotient. The engine makes that
choice after rendering both metrics to the contract's declared precision, and
every non-null ratio is nonnegative. Alternative denominator identifiers are
unique and distinct from the approved identifier.
The contract uses the same four-fractional-digit constant as the engine to
validate each ratio against its reported approved and alternative denominator
values with scaled-integer arithmetic. Approved and alternative metric values
are nonnegative.
The same arithmetic validates each reported metric against the analysis session
reversal and its denominator. Event-field denominator values must match the
bound analysis observation; `netChange` uses its magnitude. A `1.1` analysis
leg retains the optional event `price` when a declared denominator reads it, so
that source claim remains independently verifiable without changing `1.0`.
The result contract binds every sensitivity leg one-to-one to the corresponding
analysis leg, including its instrument, event and approved denominator identity
and value. The approved sensitivity metric must equal the analysis reversal
multiple, so independently parsed output cannot relabel, omit or contradict a
recomputation.

Every declared denominator must resolve for the analysed observation, and the
approved denominator must resolve for every baseline observation used by the
rank. A missing event field returns `INCONCLUSIVE` with
`DECLARED_DENOMINATOR_FIELD_ABSENT`; a resolved zero or negative value returns
`NON_POSITIVE_DECLARED_DENOMINATOR`. An inconclusive `1.1` result has null
sensitivity, empty findings and null analysis.

## Consequences

The engine, rather than a figure or document, owns all reported comparison
values. Switching only the approved denominator leaves canonical events intact
but changes the approval artifact hash and canonical result hash. The `1.0`
engine version and hashes remain stable; `1.1` replay uses
`0.9.0-denominator-substitution-sensitivity`.

Strict consumers opt into rule `1.1`, add `approvedDenominatorId` and
`denominators` to every leg, and accept the conclusive `sensitivity` object or
the inconclusive null branch. There is no automatic conversion or default
denominator. The published KOSPI case remains on `1.0`; this change does not
invent a minimum increment or attach one to its source rows.
