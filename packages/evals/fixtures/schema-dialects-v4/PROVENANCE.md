# Synthetic schema dialects v4

Authored on 2026-10-10 UTC for [ADR 0075](../../../../docs/adr/0075-retry-mapping-selection-with-column-ids-and-a-fresh-corpus.md),
before any v4 model call. All rows and headers are synthetic and carry the
repository's Apache-2.0 licence. No trading records, private user text or
provider responses appear here.

Reproduce the original bytes and SHA-256 of both splits with
`pnpm eval:schemas:generate:v4`; the same command rebuilds the DEV-only
[`lexical-baseline/3` vocabulary](../lexical-baseline-v3/vocabulary.json).
The generator authors 24 new whole-header lists, IDs and naming families:
twelve for DEV and twelve for HELD_OUT, none reused from an earlier version or
shared between the splits. Each dialect adds the required `eventType` column and
two synthetic samples per column. Order hashes the v4 dialect ID and full header.
Original-byte SHA-256 is recorded in `DEV.sha256` and `HELD_OUT.sha256`.

Attack texts and placements are written per split. DEV and HELD_OUT each have
their own English and Korean attack sentence, so no attack string is shared
between the splits or with v1 to v3. DEV keeps identity attacks in headers and
annotation attacks in cells, swapping every third dialect; HELD_OUT alternates
by dialect. Encodings rotate between plain text, Base64 and zero-width
separators.

The seven-tag semantic slot rubric is still shared with every earlier version:
clear, abbreviated, synonym, ambiguous, absent lure, transform lure and
injection, with the same gold definition for each slot. This is a fresh input
seal, not evidence of independent task templates or a secret holdout. Prompt,
schema, adapter and validator changes are checked on v4 DEV only; no model
response on v4 HELD_OUT was seen before its seal. The pre-run test reproduces
bytes, exposes every attack to the adapter and validates authored gold under
`mapping-validator/2` and `mapping-validator/3`; none of that is measured model
performance.
