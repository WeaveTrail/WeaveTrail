# Methodology

This document defines how to interpret WeaveTrail output. It describes the
planned financial reference rule where noted; it does not claim that the rule
has been implemented or evaluated.

## Question and result vocabulary

The first application asks whether a short-window price lift satisfies a
versioned pattern of concentrated, repeated aggressive buying.

The replay result is intentionally closed:

| Result          | Meaning                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------ |
| `SUPPORTED`     | Validated data satisfies every required threshold in the approved rule version.            |
| `NOT_SUPPORTED` | Data is sufficient, but one or more required thresholds are not satisfied.                 |
| `INCONCLUSIVE`  | Missing, conflicting, or unresolvable inputs prevent the rule from being evaluated safely. |

These states concern a technical pattern hypothesis. They are not legal or
causal conclusions.

## Canonical time and ordering

The implemented foundation accepts `eventTime` values with a four-digit ISO
calendar year, uppercase `T`, `Z` or an explicit `±HH:MM` offset, and at most
nine fractional digits. Months are `01` through `12`; days must exist in their
month under the proleptic Gregorian leap-year rule; hours are `00` through `23`;
and minutes and seconds are `00` through `59`. Offset hours are `00` through
`23`, and offset minutes are `00` through `59`. Leap seconds are unsupported.
Before ordering or hashing, the engine converts each accepted value to
fixed-width UTC nanoseconds:

```text
YYYY-MM-DDTHH:mm:ss.sssssssssZ
```

The UTC result must remain in years `0000` through `9999`. Event time is
compared as a signed nanosecond integer, not through millisecond date parsing.
Equal-time events use an unsigned numeric `sequence` comparison and then
lexicographic UTF-16 code-unit `eventId` order. Canonical JSON keys use the same
code-unit order and do not depend on host locale data or object property
enumeration order. Canonical JSON rejects non-finite numbers; protected
decimal values are represented as strings.

The current dataset contract represents one ordered source stream. Every event
must either provide `sequence` or omit it; mixed presence stops replay with
`MIXED_SEQUENCE_PRESENCE`. If all events omit sequence, equal-time events fall
through to `eventId`. WeaveTrail does not infer a missing sequence or
Unicode-normalize identifiers.

## Planned `RAPID_PRICE_LIFT` rule

The first rule version will evaluate a fixed time window using decimal-safe
calculations for:

- price change in basis points;
- aggressive-buy share for the approved actor set;
- actor-set share of traded notional or quantity;
- repeated executions above a reference price; and
- the mechanical difference after excluding the approved actor set.

Thresholds live in a versioned `CaseManifest`; the model cannot add rules or
calculation code. The exact formula and threshold defaults will be documented
in the same change that implements the rule.

## Counterfactual interpretation

The comparison asks, “What metric does the same deterministic replay produce
after removing this declared event set?” It does not prove that those actors
caused the observed market path. The output must be labeled sensitivity
analysis and retain references to both included and excluded events.

## Abstention

WeaveTrail should return `INCONCLUSIVE` or `REVIEW_REQUIRED` when a required
identity, time, side, price, quantity, or mapping cannot be established. It
must not fill a missing safety-critical value from a model guess.

## Synthetic data

All committed scenarios are synthetic. They are designed to test contracts,
failure handling, determinism, and traceability—not to estimate performance in
a real market.
