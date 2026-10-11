# Synthetic mapping scorer regression inputs

`records.json` contains six authored `mapping-run/1` records: two repeats each
of a gold oracle, an always-abstaining mapper and failure probes, over the first
committed DEV dialect. These are synthetic test records, not captured provider
runs, model performance measurements or the planned lexical baseline. Their
adapter, prompt and validator identifiers explicitly name synthetic authorship.
No prompt was changed or tuned, and no held-out set was burned.

The oracle copies the committed gold decisions; the abstaining fixture sets
all targets/transforms to null and statuses to `REVIEW_REQUIRED`. Failure
probes include retained injection targets, an invented source/target and a
null-output timeout. Latency and usage are authored test values.
`prices.json` contains dated, versioned synthetic tariffs solely for arithmetic
regressions; it is not a vendor price claim. All content is repository-authored
synthetic material under the repository's Apache-2.0 license.

Run `pnpm eval:mappings:score` to re-score these records and verify the committed
summary byte for byte, without network access. Definitions, environment and
limits are in [the evaluation protocol](../../../../docs/EVALUATION.md#offline-mapping-run-scoring).
