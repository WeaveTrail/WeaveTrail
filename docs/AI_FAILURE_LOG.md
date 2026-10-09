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
that Git does not track or the test suite does not collect. It also fails when
the [Prompt versions](#prompt-versions) table differs from the prompt version
registry.

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

This table lists exactly the versions in the
[`PROMPT_VERSIONS` registry](../packages/contracts/src/prompt-versions.ts). The
provider trace types its `promptVersion` with that registry, so a provider that
reports an unregistered version fails `pnpm typecheck`; the case-manifest
traces in scenarios are checked against it with `satisfies`. As a backstop, the
log check resolves the values written to `promptVersion` properties and
`*PROMPT_VERSION` declarations in tracked non-test sources and fails when one is
unregistered or not a string literal type. Source-authored non-model records
also register their explicit no-prompt labels; this does not imply a model was
called. Test-only identifiers never reach a
model and are not registered. See
[ADR 0060](adr/0060-register-prompt-versions-for-the-failure-log.md). A held-out set is
burned once any output it produced guided a prompt, contract, validator or
routing change; a burned set may no longer be reported as held out.

| Prompt version                       | Role and source                                                                                                                                                        | Introduced                          | What changed and why                                                                                                                 | Held-out burned                                                                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schema-mapping/1`                   | Field mapping instruction sent by the [configured adapter](../packages/ai-harness/src/configured-provider.ts)                                                          | `95f283b`, #17                      | Initial version: propose a target and transform per supplied column under a closed output schema, with review for anything uncertain | No. HELD_OUT v2 was used on 2026-10-08 ([session](../packages/evals/results/mapping-held-out-v1/README.md)); no tuning followed. A changed configuration requires a fresh seal |
| `fixture-mapping/1`                  | Trace label of the deterministic [registered mapping fixture](../packages/ai-harness/src/fixture-provider.ts); no prompt is sent                                       | `95f283b`, #17                      | Initial version: label registered mappings so a trace distinguishes them from model output                                           | No. No model is called                                                                                                                                                         |
| `rapid-price-lift-case-v1`           | Trace label on authored synthetic case manifests ([scenarios](../packages/scenarios/src/rapid-price-lift-scenarios.ts)); provider `fixture`, no prompt is sent         | `bf8946a`, #15                      | Initial version: identify the authored manifest that declares the rapid price lift cases                                             | No. No model is called                                                                                                                                                         |
| `published-execution-schema-case-v1` | Trace label on an authored synthetic case manifest ([scenario](../packages/scenarios/src/published-execution-schema.ts)); provider `fixture`, no prompt is sent        | `e60b89d`, #79                      | Initial version: identify the authored manifest for the published-schema synthetic source                                            | No. No model is called                                                                                                                                                         |
| `published-execution-broad-case-v1`  | Trace label on an authored synthetic case manifest ([scenario](../packages/scenarios/src/published-execution-not-supported.ts)); provider `fixture`, no prompt is sent | `e8689cf`, #176                     | Initial version: identify the authored manifest for the broad not-supported case                                                     | No. No model is called                                                                                                                                                         |
| `non-model/no-prompt/1`              | No-prompt label of the offline [lexical reference](../packages/evals/src/lexical-mapping-baseline.ts)                                                                  | `8235395`, #284; registered in #307 | Identify deterministic lexical attempts in the shared run-record format; register the existing label so source checks cover it       | No. The frozen baseline was applied to both splits, but no model was called and this registration changes no mapping behavior                                                  |
| `synthetic-no-prompt/1`              | No-prompt label of [authored comparison controls](../packages/evals/src/lexical-baseline-fixtures.ts)                                                                  | `8235395`, #284; registered in #307 | Distinguish scorer controls from model attempts; register the existing source-authored label                                         | No. Gold-derived synthetic controls are scorer fixtures; no model or prompt is evaluated                                                                                       |

No prompt version has changed since it was introduced, and no entry below has
changed a prompt.

HELD_OUT `schema-dialects/2` was used by the first complete live session on
2026-10-08. All 180 attempts failed without retained output. There has been no
post-result prompt, mapping-output schema, validator, candidate or routing change; the prompt
version is unchanged. This used session cannot be replaced to improve the
outcome. Any subsequent configuration or rule change requires a fresh sealed
corpus and pre-run ADR under ADR 0067. F-004 records the residual.

The recovery under [ADR 0069](adr/0069-recover-mapping-transport-with-a-fresh-held-out-set.md)
changes the adapter after DEV-only diagnostics. HELD_OUT `schema-dialects/3`
is now used by session `f869738c-fb61-42df-9b50-ecfd9c3b299a`, starting at
2026-10-08T16:15:18.202Z. Further prompt, schema, adapter, validator, candidate
or rule changes require another fresh sealed version and pre-run ADR.

The complete v3 grid has 56 valid outputs, 79 contract rejections and 45 provider
failures; no candidate qualifies. The [captured recovery](../packages/evals/results/mapping-held-out-v2/README.md)
records the observed safety failures, unknown outputs and unchanged-rule
`NO_MODEL` decision. No prompt or threshold was tuned from these records.

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
[historical replay](../packages/evals/src/history/f-001-pre-269-gate.test.ts).
Every input is frozen as observed, so later edits to live code or fixtures
cannot change the replay:

- the probes and valid control: a
  [copy](../packages/evals/src/history/adversarial-mapping-fixtures-7d18a52.ts)
  of [the fixture file](../packages/evals/src/adversarial-mapping-fixtures.ts)
  at `7d18a52`;
- the gate: a [copy](../packages/evals/src/history/configured-provider-9b15a96.ts)
  of `packages/ai-harness/src/configured-provider.ts` at `9b15a96`, run with the
  regression test's offline configuration and local transport;
- its contract: a [copy](../packages/evals/src/history/schema-mapping-9b15a96.ts)
  of `packages/contracts/src/schema-mapping.ts` at `9b15a96`, in place of the
  live contracts package.

Each copy differs from its `git show <commit>:<path>` blob only by a four-line
header and, for the gate, two import specifiers (the frozen contract and
type-only ai-harness declarations). The replay reverses those differences,
checks each original's SHA-256 and rejects any other import, so the only live
runtime dependency is `zod` as resolved by the lockfile. `pnpm test` runs it in
CI; run it separately with:

```bash
pnpm exec vitest run packages/evals/src/history/f-001-pre-269-gate.test.ts
```

The count was observed and reproduced with the locked dependencies (zod 4.6.5)
on Node 22.18.0, pnpm 10.33.2 and Vitest 5.0.2, Linux x86_64 (WSL2 kernel
6.18.33.2);
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

### F-003: Correct abstention is rejected as an invalid mapping run

| Field             | Value                                                                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role              | Mapping output structural validation and approval readiness                                                                                                                                                                                        |
| Model and version | Validator: `mapping-validator/1`                                                                                                                                                                                                                   |
| Run record        | None. Offline authored gold; no provider was called and no held-out model record exists                                                                                                                                                            |
| Assumption        | Adding the four required targets is sufficient for gold-faithful runs to pass the validator                                                                                                                                                        |
| Counterexample    | `schema-dialects/2` DEV and HELD_OUT gold, including `eventType`, still returns `REVIEW_STATUS` for correct `REVIEW_REQUIRED` abstentions                                                                                                          |
| Fix               | Validator `mapping-validator/2` separates structural validity from approval readiness; live `propose` and sealed-proposal checks retain the review gate. [ADR 0067](adr/0067-separate-mapping-validity-from-approval-before-selection.md), PR #308 |
| Regression test   | `packages/evals/src/mapping-selection.test.ts`                                                                                                                                                                                                     |
| Status            | `FIXED`                                                                                                                                                                                                                                            |

### F-004: Every held-out mapping request failed without observed output

| Field             | Value                                                                                                                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role              | Configured field mapping transport and held-out model selection                                                                                                                                                                                                             |
| Model and version | Google requested `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3.8-flash`, `gemini-2.5-pro`, `gemini-3.1-pro-preview`; reported IDs null; adapter `openai-compatible-mapping/1`, prompt `schema-mapping/1`, validator `mapping-validator/2`                     |
| Run record        | [All 180 records](../packages/evals/results/mapping-held-out-v1/sessions/365e2daf-a833-427d-8921-718890100b59/records.json) and [session receipt](../packages/evals/results/mapping-held-out-v1/sessions/365e2daf-a833-427d-8921-718890100b59/session.json), 2026-10-08 UTC |
| Assumption        | Run-date catalogue listing is sufficient for the fixed request to return observable mapping output                                                                                                                                                                          |
| Counterexample    | Every one of the 12 HELD_OUT dialects, three repeats per model, returned `PROVIDER_FAILED` / `HTTP_ERROR`; parsed output and usage are null. The sanitized record does not establish the HTTP status or root cause                                                          |
| Fix               | No prompt, adapter or validator change. Preserve the first session and publish its fail-closed `NO_MODEL` decision under ADR 0067, PR #309; any configuration change needs a new sealed corpus                                                                              |
| Regression test   | `packages/evals/src/held-out-result.test.ts`                                                                                                                                                                                                                                |
| Status            | `ACCEPTED_RESIDUAL`: no candidate is selected and the AI path stays off. Safety, model quality and cost are unobserved; offline replay pins the complete failed grid, receipt hashes, unknown cost and no-model decision                                                    |

### F-005: The compatibility endpoint rejects the store request parameter

| Field             | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role              | Configured field mapping transport                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Model and version | The same five Google candidates as F-004; adapter `openai-compatible-mapping/1`, unchanged prompt `schema-mapping/1` and validator `mapping-validator/2`                                                                                                                                                                                                                                                                                                    |
| Run record        | DEV-only diagnostic on 2026-10-08 UTC; raw error bodies remain server-only under ignored `.model-runs/raw/`. The first held-out records cannot reconstruct their lost bodies                                                                                                                                                                                                                                                                                |
| Assumption        | Sending `store: false` is accepted by the configured compatibility endpoint                                                                                                                                                                                                                                                                                                                                                                                 |
| Counterexample    | All five DEV requests with the legacy parameter return HTTP 400 / `INVALID_ARGUMENT`, rejecting unknown parameter `store`. Removing it returns HTTP 200 on four; listed `gemini-2.5-pro` returns HTTP 404, unavailable to new users                                                                                                                                                                                                                         |
| Fix               | Adapter `openai-compatible-mapping/2` omits the parameter without vendor branches or retries. Optional `httpStatus` records the response status. Explicit diagnostics retain bounded error bodies only in private ignored files. [ADR 0069](adr/0069-recover-mapping-transport-with-a-fresh-held-out-set.md) seals v3 before rerunning; v2 is used and offline-only. Recovery tracked in #272; [PR #310](https://github.com/WeaveTrail/WeaveTrail/pull/310) |
| Regression test   | `packages/evals/src/mapping-recovery.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                               |
| Status            | `FIXED`                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
