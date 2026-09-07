# ADR 0032: Evaluate declared cross-market session reversals

## Status

Accepted. Verified by contract, synthetic-state, invariant and published-data
golden tests.

## Context

Case Manifest `1.4` can declare an actorless multi-instrument hypothesis, but
Event `1.2` retained only one generic price. The committed FSC index and futures
rows also publish open, high, low, close and absolute net change. Discarding
those fields prevents a versioned rule from evaluating the declared date;
using the publisher's rounded percentage change would make exact comparisons
depend on a display value.

The rule must not scan the range for an interesting date. It receives one date,
one baseline range, a fixed set of legs and fixed thresholds through an approved
configuration. It reports support for that versioned hypothesis only, not
causality, misconduct or investment suitability.

## Decision

Add strict Event `1.3` and Mapping Proposal `1.7` branches alongside the
unchanged earlier branches. Event `1.3` records `tradingDate`, `openPrice`,
`highPrice`, `lowPrice`, `closePrice` and `netChange`. The source mapping uses
`PUBLISHER_DECIMAL_STRING`, which accepts the publisher's otherwise canonical
leading-dot decimals such as `.85` and converts them to `0.85`; raw source
strings remain unchanged and traceable through `rawRowHash`. These six fields
join the canonical event projection only for Event `1.3`. Evidence Bundle `1.3`
remains frozen to Event `1.1`/`1.2` and Proposal `1.4`/`1.5`/`1.6`.

Add `CROSS_MARKET_SESSION_REVERSAL` rule `1.0`. Its parameters declare:

- the analysed date and inclusive baseline range;
- a baseline leg and at least two unique instrument legs;
- each leg's minimum reversal multiple;
- the maximum accepted baseline rank and minimum agreeing-leg count.

For one daily observation, session direction is `close - open`. If it is
negative, session reversal is `high - close`; if positive, it is `close - low`;
a flat session has zero reversal. Net direction and magnitude come from the
publisher's absolute `netChange`, never its percentage field. The relation is
`OPPOSED`, `ALIGNED` or `FLAT`. Reversal multiple is
`sessionReversal / abs(netChange)`.

The baseline population contains comparable baseline-leg observations inside
both the declared range and the approved Case Manifest time window. Events
outside the case window cannot affect the verdict. Rank is one plus the number
with a strictly greater exact multiple, so ties share a position. Rank is a
position within that declared population, not a probability. Each leg produces
its own gate even when it fails; a separate quorum gate counts passing legs.
`SUPPORTED` requires both the rank gate and quorum gate, allowing a configured
quorum to preserve a failed leg visibly in a supported result.

All arithmetic and comparisons use scaled integers and exact ratio
cross-products. Rendered multiples are truncated toward zero to four fractional
digits only after comparison. The rule returns `INCONCLUSIVE` with an explicit
reason for insufficient or ambiguous inputs, including empty or single-day
baselines, an absent analysed date or leg, invalid OHLC bounds, and zero analysed
net change.

## Consequences

The committed KOSPI 200 baseline and front-future source rows can now produce a
pinned engine result without adding participant identity, trade side or an
execution timestamp. Their source bytes and acquisition facts do not change;
their adjacent interpretation metadata now records Event `1.3`, Mapping `1.7`,
and the newly mapped OHLC/net-change columns. Their normalized projections and
hashes intentionally differ from the earlier normalization-only projections.

The engine entry point accepts a canonical event set assembled from the
declared artifacts. The existing single-source Case Replay HTTP/UI path remains
unchanged; the published guided case and denominator sensitivity are separate
follow-up work. No result is attached to the real artifact itself, and no
candidate-date search is introduced. ADR 0034 records the governance boundary
that permits this separate evaluation without treating its output as a source
fact.
