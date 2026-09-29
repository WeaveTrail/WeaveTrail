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
