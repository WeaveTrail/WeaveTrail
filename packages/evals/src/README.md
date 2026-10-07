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
The fixture publication never calls configured providers. No third-party
evaluation runtime is used.

Evaluation v3 retains the synthetic inputs with unchanged oracles and removes
all real-source baselines. Previous financial replay v1/v2 and claim coverage v1
outputs remain [historical captures with withdrawn sources](../results/README.md).
The source-dependent coverage evaluation command and runner were removed.

The shared [mapping run contracts](../../contracts/src/mapping-run-record.ts)
prepare records and separate receipts for planned model evaluations. Offline
synthetic tests verify their shape, trace rejection and hash boundary. The
[mapping model runner](mapping-model-runner.ts) now records sanitized adapter
observations; the explicit `pnpm eval:models --live --scenario
concentrated-buy-dialect-a.csv` command saves local records and separate receipts
under ignored `dist/mapping-runs/`. It requires configured endpoints and keys,
is disabled in CI and never reads the held-out set. Scoring remains planned. See the
[run-record protocol](../../../docs/EVALUATION.md#mapping-model-run-record-contract).

The [hostile mapping fixture provider](adversarial-mapping-fixtures.ts) supplies
authored synthetic envelopes to the shared server-side model-output validator.
The [offline tests](adversarial-mapping.test.ts) assert each probe's reason code
and exercise the configured adapter with an injected local transport. They run
in `pnpm test`, separately from the unchanged fixture publication, with no
credentials or network. A valid price/quantity swap control documents the
semantic limitation left to human review. See the
[probe protocol](../../../docs/EVALUATION.md#adversarial-mapping-validator-probes).
