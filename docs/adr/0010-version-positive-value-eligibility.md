# ADR 0010: Version positive-value eligibility

## Status

Accepted.

## Context

`RAPID_PRICE_LIFT` version `1.0` treated an in-window trade as eligible when
the required fields were present. Excluding a present but non-positive price
or quantity changes metrics, findings, evaluations, and canonical result
hashes. Publishing that behavior under the existing rule and engine labels
would make distinct definitions indistinguishable to evidence consumers.

## Decision

Publish the strictly-positive eligibility behavior as `RAPID_PRICE_LIFT`
version `1.1` under engine version `0.5.0-rule`. A matching trade is eligible
only when `price` and `quantity` are both strictly positive in addition to the
existing field, instrument, event-type, and window requirements. A matching
non-positive trade increments `nonComparableEventCount` and enters no metric
or finding reference.

The current runtime accepts `1.1` and explicitly rejects `1.0`; it does not
reinterpret a `1.0` manifest using `1.1` semantics. Migration requires changing
the manifest rule version, recomputing its approval artifact hash, and obtaining
a new approval. Historical `1.0` evidence retains its original rule and engine
labels.

Strict positivity makes separate reference-price, total-notional, and survivor
reference-price positivity preconditions unreachable. Version `1.1` therefore
removes those result reasons and retains the reachable insufficient-event,
aggressive-buy-notional, and actor-removal preconditions.

## Consequences

The engine changes from `0.4.0-rule` to `0.5.0-rule`. Because engine version and
evaluation are protected by `canonicalResultHash`, affected replay hashes are
repinned from executed results. Canonical result hashes from different engine
versions represent different definitions and must not be compared as though
they were produced by the same definition. The canonical dataset hash remains
independent of engine and rule versions.

ADR 0009 remains the historical record of the `1.0` and `0.4.0-rule` decision.
