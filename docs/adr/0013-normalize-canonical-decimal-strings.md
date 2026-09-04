# ADR 0013: Normalize decimal strings before canonical comparison

## Status

Accepted.

## Context

Prices and quantities entered the protected event scope as validated decimal
strings, but validation retained their source spelling. Values such as `100`,
`100.0`, and `100.00` therefore produced different canonical projections and
hashes and could be reported as conflicting records for one source identity.
Converting through JavaScript floating point would violate the exact-decimal
boundary and could lose information.

## Decision

One shared contract function validates and normalizes price and quantity
strings. The accepted grammar remains `^-?(?:0|[1-9]\d*)(?:\.\d+)?$`:
exponents, a `+` prefix, leading zeroes, locale formats, and non-finite values
remain invalid. Normalization removes trailing fractional zeroes and then the
decimal point when no fractional digits remain. Any signed spelling of zero,
including `-0` and `-0.0`, becomes `0`. The implementation operates only on
strings and does not use JavaScript numeric conversion or arithmetic.

`TradeEventSchema` applies this transform to `price` and `quantity`, and the
approved `DECIMAL_STRING` mapping calls the same function. Consequently the
values are canonical before source-identity grouping, duplicate/conflict
classification, canonical projection, dataset hashing, and result hashing.
Source rows remain verbatim, and `rawRowHash` continues to cover those original
values and their source coordinate.

## Consequences

Trade Event advances from `1.0` to `1.1`, Schema Mapping Proposal advances from
`1.3` to `1.4`, and the engine advances from
`0.6.0-canonical-number` to `0.7.0-canonical-decimal`. Producers must emit the
new versions. Mapping approvals and manifests whose protected artifacts changed
must be recomputed and reapproved; canonical dataset and result golden hashes
are repinned.

Case Manifest remains `1.3`, and `RAPID_PRICE_LIFT` remains `1.1` because their
shape, formula, thresholds, findings, and classifications do not change.
`sourceArtifactHash` and `rawRowHash` remain unchanged because source bytes and
raw row values are not rewritten.
