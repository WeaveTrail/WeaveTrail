# ADR 0009: Use exact rapid-price-lift rules and explicit abstention

## Status

Accepted.

## Context

`RAPID_PRICE_LIFT` needs a reproducible observation inside an approved window,
exact threshold comparisons, and a boundary between insufficient valid evidence
and inputs that have not passed review. Using the final eligible price would
allow an unrelated late trade to erase an earlier lift. Comparing a rounded
basis-point string could reverse a gate at a display boundary.

## Decision

Version `1.0` uses the greatest eligible price as `peakPrice`. The reference is
the first eligible event in canonical order. Peak selection is independent of
source-row order after canonicalization.

All price, quantity, notional, share, rate, and threshold arithmetic uses
scaled integers on `bigint`. Ratio gates compare exact integer cross-products.
Basis-point strings are truncated toward zero to four fractional digits only
for reporting; displayed rounding cannot decide a gate.

The rule returns `INCONCLUSIVE` only when one of its six ordered preconditions
fails after validated, approved inputs reach evaluation. Approval, artifact,
mapping, profile, or rule-configuration failures remain `REVIEW_REQUIRED` and
produce no evaluation.

Removing the approved actor group recomputes the reference and peak over all
surviving eligible events. The output is a mechanical sensitivity comparison.

## Rejected alternatives

- Final eligible price: a later print could hide an earlier observed peak.
- Rounded-value gate comparison: formatting choices could change a result.
- Automatic thresholds or fallback zeroes: they would move authority out of
  the approved rule configuration.
- Using `INCONCLUSIVE` for pre-replay ambiguity: it would collapse review state
  into a rule outcome.

## Consequences

The engine version is `0.4.0-rule`. The canonical result hash includes the rule
result, findings, and sensitivity when evaluation occurs. The canonical dataset
hash remains independent of the engine version and rule output.
