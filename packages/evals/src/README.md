# Evaluation package

`pnpm eval` runs the versioned fixture evaluation and writes the stable summary
and actual environment receipt to `dist/evaluation/`. It fails on disagreement
with committed mapping, mutation, scenario or trace expectations and never
updates the expected publication.

- [Case definitions](cases.ts) own authored mapping and mutation oracles.
- [Runner](runner.ts) checks original bytes, fixture proposals, approval outcomes,
  canonical mutations, shared scenario expectations and finding source traces.
- [Captured summary](../results/financial-replay-v2.json) records counts and
  individual results; [run receipt](../results/financial-replay-v2.run.json)
  records the capture environment and input fingerprint.
- [Public protocol](../../../docs/EVALUATION.md) explains reproduction, sample
  definitions, provenance admission and limitations.

Only workspace dependencies were added, to exercise the existing implementation.
There is no configured-provider path or third-party evaluation runtime.

Evaluation v2 adds the published FIX broad-participation source. The v1 summary
and receipt remain unchanged historical captures; the current command checks v2.

`pnpm eval:coverage` runs a separate coverage preflight evaluation from
[authored scopes](claim-coverage-cases.ts), using the empty definition registry
currently bound by the public coverage endpoint. Its
[runner](claim-coverage-runner.ts) verifies every admitted acquisition offline,
compares before/after manifests and inventories retained file bytes and hashes.
The [captured summary](../results/published-claim-coverage-v1.json) and
[receipt](../results/published-claim-coverage-v1.run.json) record this measurement.
It assigns no numeric sentence grade. See the
[admission review](../../../docs/PUBLISHED_DATA_ADMISSION.md) for exclusions and limits.
