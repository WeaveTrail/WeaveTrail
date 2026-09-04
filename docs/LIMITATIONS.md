# Limitations

WeaveTrail is an early reference implementation for reproducible event
verification. It is not a production market-surveillance system.

## Current limitations

- The repository currently uses deterministic fixtures, not a live AI mapping
  provider.
- The public deployment configuration uses fixture mode with synthetic data
  only and contains no model-provider credential.
- The guided lab demonstrates both a fully resolvable mapping and a
  review-required field that needs a justified override before approval, then
  approval-bound replay, canonical ordering, exact deduplication, hashing, and
  one versioned financial pattern rule.
- Replay requests execute mapping, input, and case transitions through the
  approval state machine, and responses expose their final state. State and
  transition history are request-local: persistence, cross-request correlation,
  and audit history are not implemented. Corrected input after
  `INPUT_REVIEW_REQUIRED` starts a new request at `UPLOADED`.
- Mapping-only foundation validation ends at `MAPPING_APPROVED`; only an
  approved case rule replay reaches `REPLAYED`.
- All data is synthetic, so no result establishes real-market accuracy.
- Rule thresholds are illustrative per-case configuration, not calibrated
  market thresholds. The three declared outcomes are synthetic-fixture
  results, not a detection-rate measurement.
- No large-scale performance benchmark has been run.
- Upload persistence, authentication, multi-tenancy, and signed exports are out
  of the current scope.
- Finite-number spelling is specified, but independent Evidence Bundle
  assembly and verification remain planned. The implementation does not claim
  full JSON Canonicalization Scheme compliance.

## Interpretation limits

- `SUPPORTED` means only that data satisfies a declared technical rule.
- `NOT_SUPPORTED` is not proof that no misconduct occurred.
- `INCONCLUSIVE` is a first-class safe outcome, not an error to hide.
- Removing the approved actor group and replaying metrics is a mechanical
  sensitivity comparison, not a causal conclusion.
- Model confidence is not calibrated probability unless a documented
  evaluation establishes that property.

## Prohibited uses

Do not use this prototype to determine guilt, make legal findings, recommend or
execute trades, process undisclosed personal data, or replace qualified human
review.
