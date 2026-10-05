# Synthetic schema dialect inputs, version 1

All headers, values, constants, identifiers, prompt-injection strings and gold
labels are authored synthetic material. No exchange, customer, personal or
production data is used. Author: WeaveTrail contributors. Repository Apache-2.0
license applies. There is no external data source or acquisition record.

Definition: [deterministic generator](../../src/schema-dialects-generator.ts).
Regenerate from the repository root with `pnpm eval:schemas:generate`.
The generator has no clock, randomness, provider or network dependency. It
serializes using the locked Prettier version. Node 22.18.0 and pnpm 10.33.2
were used to generate v1. Verify with
`pnpm exec vitest run packages/evals/src/schema-dialects.test.ts`.

`DEV.json` has 8 naming families and 112 decisions. `HELD_OUT.json` has 12
separate naming families and 168 decisions, including 24 for each of seven tags.
Each family has 14 columns. Values are strings; unsupported scaling is described,
never performed. These are inventory counts, not model results. Header families
are authored separately; semantic field roles and value templates are shared.
They do not represent independent statistical samples or real-world prevalence.

Each dialect separates `input` (columns, sample strings, and source constants)
from `gold` (one decision for every column). Only `input` may be presented to a
future model. Source constants are untrusted context, not approved mapping
constants. Gold is checked through the existing mapping proposal contract 1.4;
null target and null transform are paired. An unsupported transform has no
executable mapping and requires review; its rationale names the missing
operation. A description beside a real price or actor column remains unmapped.

Injection gold preserves the underlying identity or unmapped annotation even
when adversarial instructions request a different `injectedTarget`. Language,
encoding, placement and exact payload are retained in gold. Headers, cells and
source constants each include English and Korean payloads in plain, base64 and
zero-width forms in HELD_OUT. Payloads are never interpreted or executed here.

`DEV.sha256` and `HELD_OUT.sha256` hash the exact UTF-8 JSON file bytes, including
the final newline. The held-out checksum is the seal to record before any future
provider run. Regeneration deliberately updates both files and checksums; review
any such change as a new corpus version once sealed. Normal tests never rewrite
files. Keep HELD_OUT out of prompts, demonstrations, tuning and provider selection;
use DEV for that work and freeze configuration before opening HELD_OUT results.

This public repository cannot enforce secrecy or prove absence of contamination.
The split is a procedural holdout, not a private test set. No model was run and
no configuration was tuned in producing these inputs. A future evaluation must
record the sealed commit/hash and tuning protocol. These fixtures stay offline,
are not exported by the evaluation package entry point, and are guarded against
production imports or public-asset copies. See
[ADR 0057](../../../../docs/adr/0057-seal-offline-schema-dialect-evaluation-inputs.md).
