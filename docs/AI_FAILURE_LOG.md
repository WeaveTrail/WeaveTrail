# AI Failure Log

_[한국어](AI_FAILURE_LOG.ko.md)_

This log records observed model and validator failures, the assumption each one
broke, and the change that answered it. Each entry is engineering history, not a
one-off fix note. Entries are append-only: a later change to a fixed failure
gets a new entry that refers to the earlier one.

Only observed cases are entered. An entry quotes no raw model output beyond what
a committed [`mapping-run/1` record](EVALUATION.md#mapping-model-run-record-contract)
already retains; for an offline probe, the counterexample is the committed
authored fixture and the observed validator result.

[`CONTRIBUTING.md`](../CONTRIBUTING.md#change-requirements) requires a fix for a
model or validator failure to ship with its entry here and a regression test
that fails without the fix. The [log check](../packages/evals/src/ai-failure-log.test.ts)
runs in `pnpm test` and fails when an entry is incomplete or names a test file
that Git does not track or the test suite does not collect. It also resolves
every source prompt version through the TypeScript checker and fails when one
is missing from the table below or is not a string literal type.

## Entry fields

Each `F-nnn` entry, numbered consecutively from `F-001`, states:

| Field             | Content                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Role              | The constrained role whose output failed or was misjudged                                                   |
| Model and version | The requested and reported model, or `Validator` with its version or commit                                 |
| Run record        | The `mapping-run/1` record reference, or why none exists                                                    |
| Assumption        | What the prompt, contract or validator assumed                                                              |
| Counterexample    | Dialect or profile ID and the observed output that broke the assumption                                     |
| Fix               | Contract, validator, prompt version or routing change, with its pull request                                |
| Regression test   | The committed test file that fails without the fix                                                          |
| Status            | `FIXED`, or `ACCEPTED_RESIDUAL` followed by the reason the residual is accepted and where it is now handled |

## Prompt versions

Every prompt version identifier in the repository is listed here. A held-out set
is burned once any output it produced guided a prompt, contract, validator or
routing change; a burned set may no longer be reported as held out.

| Prompt version                       | Role and source                                                                                                                                                        | Introduced      | What changed and why                                                                                                                 | Held-out burned                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `schema-mapping/1`                   | Field mapping instruction sent by the [configured adapter](../packages/ai-harness/src/configured-provider.ts)                                                          | `95f283b`, #17  | Initial version: propose a target and transform per supplied column under a closed output schema, with review for anything uncertain | No. No model run has used the [schema-dialect HELD_OUT seal](../packages/evals/fixtures/schema-dialects-v1/HELD_OUT.sha256) |
| `fixture-mapping/1`                  | Trace label of the deterministic [registered mapping fixture](../packages/ai-harness/src/fixture-provider.ts); no prompt is sent                                       | `95f283b`, #17  | Initial version: label registered mappings so a trace distinguishes them from model output                                           | No. No model is called                                                                                                      |
| `rapid-price-lift-case-v1`           | Trace label on authored synthetic case manifests ([scenarios](../packages/scenarios/src/rapid-price-lift-scenarios.ts)); provider `fixture`, no prompt is sent         | `bf8946a`, #15  | Initial version: identify the authored manifest that declares the rapid price lift cases                                             | No. No model is called                                                                                                      |
| `published-execution-schema-case-v1` | Trace label on an authored synthetic case manifest ([scenario](../packages/scenarios/src/published-execution-schema.ts)); provider `fixture`, no prompt is sent        | `e60b89d`, #79  | Initial version: identify the authored manifest for the published-schema synthetic source                                            | No. No model is called                                                                                                      |
| `published-execution-broad-case-v1`  | Trace label on an authored synthetic case manifest ([scenario](../packages/scenarios/src/published-execution-not-supported.ts)); provider `fixture`, no prompt is sent | `e8689cf`, #176 | Initial version: identify the authored manifest for the broad not-supported case                                                     | No. No model is called                                                                                                      |

No prompt version has changed since it was introduced, and no entry below has
changed a prompt.

## Entries

### F-001: The configured mapping gate accepted transform-invalid outputs

| Field             | Value                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Role              | Field mapping output gate of the configured adapter                                                                                                                                                                                                                                                                                                                                                    |
| Model and version | Validator: the configured adapter's `validateConfiguredProposal` gate before `mapping-validator/1`, at `9b15a96`                                                                                                                                                                                                                                                                                       |
| Run record        | None. Offline probes from `hostile-mapping-fixtures/1` with an injected local transport; no model was called and no `mapping-run/1` record exists                                                                                                                                                                                                                                                      |
| Assumption        | A proposal that passes the strict proposal contract, the supplied-column check and the required-target check can be converted by its declared transforms                                                                                                                                                                                                                                               |
| Counterexample    | Input `hostile-synthetic/1`. Probe `target-transform-mismatch` maps `id` to `sourceEventId` with `DECIMAL_STRING`; probe `transform-fails-on-rows` maps `time` to `eventTime` with `EPOCH_MS_TO_ISO` over ISO-8601 samples. The adapter at `9b15a96` returned each as a proposal ready for approval instead of `REVIEW_REQUIRED`. The other 24 probes were rejected and the valid control was accepted |
| Fix               | Validator: `validateMappingOutput`, version `mapping-validator/1`, checks structural target/transform compatibility (`TARGET_TRANSFORM_MISMATCH`) and dry-runs the exact ingest transforms on every supplied sample row (`TRANSFORM_FAILED`); the configured adapter and sealed-proposal re-validation use it. #296, [ADR 0059](adr/0059-share-the-model-mapping-validator-with-hostile-probes.md)     |
| Regression test   | `packages/evals/src/adversarial-mapping.test.ts`                                                                                                                                                                                                                                                                                                                                                       |
| Status            | `FIXED`                                                                                                                                                                                                                                                                                                                                                                                                |

Observed on 2026-10-06 and reproduced by a committed
[historical replay](../packages/evals/src/history/f-001-pre-269-gate.test.ts). It
passes the committed probes and valid control from
[the fixture file](../packages/evals/src/adversarial-mapping-fixtures.ts) through
`ConfiguredSchemaMappingProvider` in a
[historical copy](../packages/evals/src/history/configured-provider-9b15a96.ts)
of the gate at `9b15a96`, with the regression test's offline configuration and
local transport. The copy differs from
`git show 9b15a96:packages/ai-harness/src/configured-provider.ts` only by a
four-line header and its `./provider` import specifiers; the replay checks the
original's SHA-256 after reversing both. `pnpm test` runs it in CI; run it
separately with:

```bash
pnpm exec vitest run packages/evals/src/history/f-001-pre-269-gate.test.ts
```

The count was observed and reproduced with the locked dependencies on Node
22.18.0, pnpm 10.33.2 and Vitest 5.0.2, Linux x86_64 (WSL2 kernel 6.18.33.2);
the project supports Node 22.13 or newer. It covers only the 26 authored
synthetic probes of `hostile-mapping-fixtures/1`; it is a validator regression
observation, not a measurement of any model or of coverage against arbitrary
outputs. Both probes now fail closed with the reason
codes above in the regression test.

### F-002: A well-formed swap of same-shaped columns passes validation

| Field             | Value                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role              | Field mapping output gate                                                                                                                                                                                                                         |
| Model and version | Validator: `mapping-validator/1`                                                                                                                                                                                                                  |
| Run record        | None. Offline authored control; no model was called and no `mapping-run/1` record exists                                                                                                                                                          |
| Assumption        | An output that passes every structural and transform stage maps each column to its intended target                                                                                                                                                |
| Counterexample    | Input `hostile-synthetic/1` with the targets of `price` and `quantity` swapped, both `DECIMAL_STRING` and in the supplied column order. `validateMappingOutput` returned `VALID`                                                                  |
| Fix               | No validator change. Semantic correctness stays with human review and the existing explicit approval gate. #296, [ADR 0059](adr/0059-share-the-model-mapping-validator-with-hostile-probes.md)                                                    |
| Regression test   | `packages/evals/src/adversarial-mapping.test.ts`                                                                                                                                                                                                  |
| Status            | `ACCEPTED_RESIDUAL`: two decimal columns are structurally indistinguishable from their samples, so the validator cannot decide which is price; the test pins the residual so that a validator change which starts rejecting it updates this entry |
