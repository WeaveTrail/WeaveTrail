# Synthetic schema dialect inputs, version 2

All material is authored synthetic data by WeaveTrail contributors, licensed
under the repository's Apache-2.0 licence. No external dataset, personal,
customer or production data is used.

`schema-dialects-v2.ts` revises the v1 generator without rewriting v1 captures.
Each dialect gains the explicit `eventType` column with `TRADE` samples and
`IDENTITY` gold. All four required targets are represented. Every decision has
exactly one tag; all seven existing tags remain. The additional decision is
`CLEAR`. The original split's eight DEV and twelve HELD_OUT naming families
remain disjoint. Each dialect now has fifteen decisions: 120 DEV and 180
HELD_OUT. These are fixture inventory counts, not measured performance.

The fixed adapter only transmits columns and sample rows. Therefore v1's
constant-placement attacks move to their own column headers in v2; placement
metadata says `HEADER`. This avoids scoring attacks that were never presented
to the model. Other attacks and wording are retained. The adapter projection
contains no gold, tags, rationales or naming-family labels. Provider-visible
source identity is the canonical hash of the complete dialect input.

Input columns and gold move together in ascending SHA-256 order of
`<dialect id>:<column name>`, with original index as tie-break. Unsupported
transform values remain strings; no generated instructions are executed.

Regenerate with `pnpm eval:schemas:generate:v2` and verify with
`pnpm exec vitest run packages/evals/src/mapping-selection.test.ts`.
Generated with Node 22.18.0, pnpm 10.33.2 and locked Prettier on Linux x86_64.
The `.sha256` files bind original UTF-8 JSON bytes including the final newline.
Normal tests never rewrite files. Once model runs exist, changes require a
new corpus version. v2 retains v1's public exposure and shared semantic-template
limitations; it is a procedural holdout, not a secret or independent sample.
