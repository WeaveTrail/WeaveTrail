# Limitations

WeaveTrail is an early reference implementation for reproducible event
verification. It is not a production market-surveillance system.

## Current limitations

- The repository currently uses deterministic fixtures, not a live AI mapping
  provider.
- The guided lab demonstrates both a fully resolvable mapping and a
  review-required field that needs a justified override before approval, then
  approval-bound replay, canonical ordering, exact deduplication, and hashing;
  the financial pattern rule and counterfactual metrics are planned.
- The approval state machine is documented but not yet persisted end to end.
- All data is synthetic, so no result establishes real-market accuracy.
- No large-scale performance benchmark has been run.
- Upload persistence, authentication, multi-tenancy, and signed exports are out
  of the current scope.

## Interpretation limits

- `SUPPORTED` means only that data satisfies a declared technical rule.
- `NOT_SUPPORTED` is not proof that no misconduct occurred.
- `INCONCLUSIVE` is a first-class safe outcome, not an error to hide.
- Removing events and replaying metrics is sensitivity analysis, not causal
  inference.
- Model confidence is not calibrated probability unless a documented
  evaluation establishes that property.

## Prohibited uses

Do not use this prototype to determine guilt, make legal findings, recommend or
execute trades, process undisclosed personal data, or replace qualified human
review.
