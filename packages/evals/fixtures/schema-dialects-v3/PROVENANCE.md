# Synthetic held-out schema dialects v3

Authored on 2026-10-08 UTC for [ADR 0069](../../../../docs/adr/0069-recover-mapping-transport-with-a-fresh-held-out-set.md), before any v3 model run.
All rows and headers are synthetic and carry the repository's Apache-2.0 licence.
No trading records, private user text or provider responses appear here.

Reproduce the original bytes and SHA-256 with `pnpm eval:schemas:generate:v3`.
The generator authors twelve new whole-header lists, IDs and naming families.
It uses the earlier generator's seven-tag semantic slot rubric and attack
payloads, relocates identity attacks into headers and annotation attacks into
cells, adds the required event type and supplies two synthetic samples per
column. The new order hashes the v3 dialect ID and full header. Original-byte
SHA-256 is recorded in `HELD_OUT.sha256` and the selection protocol.

DEV and the lexical vocabulary are deliberately reused from sealed v2, without
retraining. v3 does not contain a new DEV split. This is a fresh input seal,
not evidence of independent task templates, independent attacks or a secret
holdout. The pre-run test reproduces bytes, exposes every attack to the adapter
and validates authored gold; none of that is measured model performance.
