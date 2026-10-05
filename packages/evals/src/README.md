# Evaluation package

`pnpm eval` runs the versioned fixture evaluation and writes the stable summary
and actual environment receipt to `dist/evaluation/`. It fails on disagreement
with committed mapping, mutation, scenario or trace expectations and never
updates the expected publication.

- [Case definitions](cases.ts) own authored mapping and mutation oracles.
- [Runner](runner.ts) checks original bytes, fixture proposals, approval outcomes,
  canonical mutations, shared scenario expectations and finding source traces.
- [Captured summary](../results/financial-replay-v3.json) records counts and
  individual results; [run receipt](../results/financial-replay-v3.run.json)
  records the capture environment and input fingerprint.
- [Public protocol](../../../docs/EVALUATION.md) explains reproduction, sample
  definitions, provenance admission and limitations.

Only workspace dependencies were added, to exercise the existing implementation.
There is no configured-provider path or third-party evaluation runtime.

Evaluation v3 retains the synthetic inputs with unchanged oracles and removes
all real-source baselines. Previous financial replay v1/v2 and claim coverage v1
outputs remain [historical captures with withdrawn sources](../results/README.md).
The source-dependent coverage evaluation command and runner were removed.

The shared [mapping run contracts](../../contracts/src/mapping-run-record.ts)
prepare records and separate receipts for planned model evaluations. Offline
synthetic tests verify their shape, trace rejection and hash boundary; no provider
instrumentation, run persistence or scoring is implemented. See the
[run-record protocol](../../../docs/EVALUATION.md#mapping-model-run-record-contract).
