# First ADR 0067 held-out session

Captured on 2026-10-08 UTC, outside CI, at checkout
`70f3b403331d543cab6f09a01a82c82a71bfcefe`, with Node 22.18.0,
pnpm 10.33.2, Linux x86_64. The provider is Google at the fixed endpoint in
[ADR 0067](../../../../docs/adr/0067-separate-mapping-validity-from-approval-before-selection.md).
This is a **single-provider comparison** of the sealed synthetic
`schema-dialects/2` HELD_OUT grid, not evidence of model quality.

[catalogue-2026-10-08.json](catalogue-2026-10-08.json) is the operator's
dated attestation that the five requested IDs appeared in the official
[model catalogue](https://ai.google.dev/gemini-api/docs/models) and the
authenticated `GET /v1beta/models?pageSize=1000` listing before any mapping
call; the session receipt embeds it. It is an operator statement, not a
retained source: neither response was kept (the authenticated listing is
credential-scoped), so the listing cannot be verified offline. No result
depends on it, since every attempt failed before any output was observed.

The first and only session is
`365e2daf-a833-427d-8921-718890100b59`.
[session.json](sessions/365e2daf-a833-427d-8921-718890100b59/session.json)
records its start time, checkout, environment, endpoint and protocol hash.
Each of the 180 attempts has its original `mapping-run/1` record and
hash-linked receipt. [records.json](sessions/365e2daf-a833-427d-8921-718890100b59/records.json)
is the complete grid. No interrupted session, automatic retry or replacement
session was run. Credentials and raw provider envelopes are not stored.

Run commands (server-only key and `AI_EVALUATION_MODELS` configured as in the
[evaluation protocol](../../../../docs/EVALUATION.md#run-and-reproduce)):

```bash
pnpm eval:models:held-out --live --catalogue dist/mapping-held-out/catalogue-2026-10-08.json
pnpm eval:mappings:select --session dist/mapping-held-out/365e2daf-a833-427d-8921-718890100b59
```

All 180 attempts returned `PROVIDER_FAILED` / `HTTP_ERROR`; each candidate has
36 failed attempts, no parsed output, no reported model and no token usage.
The complete grid is selectable even though every candidate is ineligible.
[decision.json](decision.json) records `NO_MODEL`, no eligible candidates and
no primary or escalation. [selection.json](selection.json) has an empty
selected list, so there are no selected-model per-tag reference differences.
[comparison.json](comparison.json) includes the frozen lexical reference.

The scorer's strict-accuracy zero means no correct decision was credited in
this session; it does not estimate model accuracy. Zero injection or invention
counts do not establish safety without observed output. Cost coverage is 0/36
for every candidate, so cost is unknown, not zero. Latencies measure failed
HTTP attempts, not successful inference. The sanitized records contain no
HTTP status or error body, so their root cause cannot be diagnosed from this
capture. The operator attests listing only; that attestation does not
establish request compatibility.

The JSON files preserve the runner and selector bytes. Reproduce all three
outputs offline without a provider key:

```bash
pnpm eval:mappings:select --session packages/evals/results/mapping-held-out-v1/sessions/365e2daf-a833-427d-8921-718890100b59
cmp dist/mapping-selection/comparison.json packages/evals/results/mapping-held-out-v1/comparison.json
cmp dist/mapping-selection/selection.json packages/evals/results/mapping-held-out-v1/selection.json
cmp dist/mapping-selection/decision.json packages/evals/results/mapping-held-out-v1/decision.json
pnpm exec vitest run packages/evals/src/held-out-result.test.ts
```

The protocol and source seals are unchanged. HELD_OUT v2 has been used;
configuration or rule changes require a fresh sealed corpus and pre-run ADR.
The live defaults and escalation routing are unchanged. See the
[result amendment](../../../../docs/adr/0067-separate-mapping-validity-from-approval-before-selection.md#result-amendment-2026-10-08)
and [F-004](../../../../docs/AI_FAILURE_LOG.md#f-004-every-held-out-mapping-request-failed-without-observed-output).
