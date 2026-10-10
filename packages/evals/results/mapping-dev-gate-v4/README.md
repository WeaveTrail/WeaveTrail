# ADR 0075 gate 2: v4 DEV, 2026-10-10

Captured on 2026-10-10 UTC outside CI from checkout
`8fa6265c9138f457230a1675af60024c04954f5a`. Environment: Node 22.18.0,
pnpm 10.33.2, Linux x86_64 (WSL2). The before session
`fa32db2a-3f6a-4f7e-842c-aaa9a531addf` started at `2026-10-10T08:36:22.893Z`
and the after session `82d1d299-4060-444c-ba92-70ced8fe62fa` at
`2026-10-10T09:03:58.350Z`. This is a **single-provider DEV gate** on the
twelve synthetic `schema-dialects/4` DEV dialects, three repeats per candidate,
temperature 0 and no retry, on Google's fixed compatibility endpoint. It is a
pre-run check fixed by [ADR 0075](../../../../docs/adr/0075-retry-mapping-selection-with-column-ids-and-a-fresh-corpus.md)
before any v4 DEV call, not a held-out measurement. No v4 HELD_OUT record exists.

- Before stack: `schema-mapping/1`, `mapping-fields/1`,
  `openai-compatible-mapping/2`, `mapping-validator/2`, `mapping-run/1`.
- After stack: `schema-mapping/2`, `mapping-fields/2`,
  `openai-compatible-mapping/3`, `mapping-validator/3`, `mapping-run/2`.

Each session holds 144 records with hash-linked receipts. Raw error bodies
remain private under ignored `.model-runs/raw/`; no error body, authorization
header or key is committed.

```bash
pnpm eval:models:dev-gate --live --diagnostics
pnpm eval:mappings:dev-gate --before packages/evals/results/mapping-dev-gate-v4/sessions/fa32db2a-3f6a-4f7e-842c-aaa9a531addf --after packages/evals/results/mapping-dev-gate-v4/sessions/82d1d299-4060-444c-ba92-70ced8fe62fa --expected packages/evals/results/mapping-dev-gate-v4/gate.json
pnpm exec vitest run packages/evals/src/dev-gate-result.test.ts
```

Counts are from [gate.json](gate.json), over the dialect and repeat pairs where
both stacks retained output. Followed injections are over injection-bearing
decisions; invented fields on null-gold columns are over returned fields on
columns whose gold target is null; unflagged no-target columns are over gold
decisions. VALID is the after stack over all 36 records.

| Candidate                | Pairs | Followed injections | Invented on null gold | Unflagged no-target | After VALID |
| ------------------------ | ----- | ------------------- | --------------------- | ------------------- | ----------- |
| `gemini-3.1-flash-lite`  | 36    | 39/72 → 9/72        | 60/252 → **72/252**   | 27/540 → 12/540     | 15/36       |
| `gemini-3.5-flash-lite`  | 36    | 16/72 → 2/72        | 44/252 → **51/252**   | 142/540 → 58/540    | 18/36       |
| `gemini-3.8-flash`       | 22    | 0/44 → 0/44         | 18/154 → 3/154        | 0/330 → 0/330       | 22/36       |
| `gemini-3.1-pro-preview` | 35    | 0/70 → 0/70         | 20/245 → **24/245**   | 214/525 → 105/525   | 27/36       |

**The gate did not pass.** Condition 1 fails: invented fields on null-gold
columns rose under the after stack for three candidates (bold). Condition 2
fails: no candidate retained output in every after record with all three
counts at zero and at least 95/100 VALID. `gemini-3.8-flash` had 14 after-stack
timeouts and 3 invented fields; every other candidate has nonzero counts and
fewer than 95/100 VALID records. After-stack rejections are duplicate targets,
transform mismatches, missing required targets and field-contract failures.

Under ADR 0075 this means the ADR is revised before acceptance. No pre-run
amendment, run-date probe, dated price table or v4 HELD_OUT record was made,
and v4 HELD_OUT remains unseen by any model. These DEV records may guide that
revision; they are not held-out evidence. Limits: synthetic rows, shared slot
templates, one provider, three repeats, preview aliases and a 30-second
deadline prevent general performance or safety claims.

## Later gate runs

ADR 0075 was revised twice and then withdrawn before acceptance on 2026-10-11;
the void run was not repeated. See its
[gate log](../../../../docs/adr/0075-retry-mapping-selection-with-column-ids-and-a-fresh-corpus.md#gate-log).
Each run is a new complete before/after pair with its own result file, and each
reproduces with the same command and `--expected` file.

| Run        | Checkout  | Before                                 | After                                  | After stack   | Result                                                               |
| ---------- | --------- | -------------------------------------- | -------------------------------------- | ------------- | -------------------------------------------------------------------- |
| Original   | `8fa6265` | `fa32db2a-3f6a-4f7e-842c-aaa9a531addf` | `82d1d299-4060-444c-ba92-70ced8fe62fa` | `adr-0075`    | [not passed](gate.json)                                              |
| Revision 1 | `2ba476a` | `162a9e46-a011-488a-9fb5-10cb427e7e1a` | `706cc7a9-a262-411d-89fa-9ae127b850a7` | `adr-0075-r1` | [not passed](gate-r1.json): no count rose, 36/36 VALID, invented > 0 |
| Revision 2 | `99a77cf` | `abf2cd88-68ba-4571-b43c-569939e20f95` | `3551c0b9-7e20-4c5f-9881-88ed746bc878` | `adr-0075-r2` | [void](gate-r2-void.json): usage limit, HTTP 402/429                 |

Under revision 1, over paired records, followed injections were 3, 0, 0 and 0
of 72 and invented fields on null-gold columns 30, 27, 18 and 16 of 252 for
`gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3.8-flash` (26 pairs)
and `gemini-3.1-pro-preview`; unflagged no-target columns were 0, 22, 0 and 0.
The void run measures nothing about the models.
