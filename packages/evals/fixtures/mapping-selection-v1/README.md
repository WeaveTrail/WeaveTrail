# Dated selection inputs

`prices.json` is the paid Standard text tariff observed on 2026-10-08 from
Google's [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing?hl=ja).
Publisher and attribution: Google, “Gemini Developer API の料金”. The page's
footer licenses its content under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
which permits storage, adaptation and redistribution with attribution. This
capture and derived table retain that licence, rather than the repository's
Apache licence. Google does not endorse this evaluation.

`google-pricing-2026-10-08.html.txt` preserves the original response bytes
from `curl -fsSL 'https://ai.google.dev/gemini-api/docs/pricing?hl=ja'`.
Its SHA-256 is in the table's provenance. Verify the deterministic derivation
with `node scripts/extract-mapping-prices.mjs`; `--write` regenerates it.
The extractor takes the first paid input/output rate from the first (Standard)
table in each named model section and converts USD to integer micro-USD.
No floating-point arithmetic is used. This is an adaptation of the source;
no other parts of the source are presented as evaluation results.

Rates apply to uncached text requests with at most 200,000 input tokens,
including output thinking tokens. No batch, flex, priority, search, caching,
tax, discount or invoice reconciliation is included. Gemini 3.8 Flash uses
introductory rates ending 2026-12-31. Unknown reported model IDs or token usage
have unknown cost; they are not silently priced as an alias. The run operator
must check model availability on the run date; this dated page is not a
catalogue attestation. Selection commands reject usage beyond this table's
input-token scope.

`protocol.json` binds the original bytes of DEV, HELD_OUT, the frozen DEV-only
vocabulary and this price table. It is a pre-run input, not an evaluation result.
No provider run records are committed here.
