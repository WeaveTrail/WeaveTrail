# Evaluation captures

`strong-baseline-dev-v1.json` and its run receipt describe actual deterministic
B0/B1 runs on the same v4 DEV inputs. `pnpm eval:baselines:dev` reconstructs the
frozen B1 configuration and checks both record and summary bytes without updating
expectations. These are development results, with no model calls or confirmation
claims. See the [reference protocol](../../../docs/EVALUATION.md#stronger-non-model-development-reference).

`financial-replay-v3.json` and its run receipt describe the current synthetic-only
evaluation. Run `pnpm eval`; it verifies v3 without updating expectations.

`mapping-score-v1.json` is the authored synthetic metric-scorer regression.
`mapping-comparison-v1.json` adds actual deterministic lexical reference records
beside authored oracle/abstention controls and an explicit synthetic selection
record. Run `pnpm eval:mappings:compare` to verify its bytes. Neither capture is
measured model performance. See
[the protocol](../../../docs/EVALUATION.md#non-model-lexical-reference).

`financial-replay-v1.json`, `financial-replay-v2.json` and
`published-claim-coverage-v1.json`, together with their corresponding run receipts,
are unchanged historical captures with **withdrawn FSC sources**. Their original
counts, identifiers and fingerprints are retained as historical metadata; they
are not current results or permission evidence. The removed source inputs cannot
be reproduced from the current tree. The coverage evaluation command is removed.
See [ADR 0056](../../../docs/adr/0056-withdraw-the-committed-real-data-tier.md).
