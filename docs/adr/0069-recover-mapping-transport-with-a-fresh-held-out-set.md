# ADR 0069: Recover mapping transport with a fresh held-out set

- Status: Accepted
- Date: 2026-10-08
- Supersedes: [ADR 0067](0067-separate-mapping-validity-from-approval-before-selection.md) for subsequent live selection inputs and adapter identity. The first session remains reproducible under ADR 0067.

## Context

The first session failed all requests without retaining HTTP status or an error
body. A DEV-only diagnostic now reproduces HTTP 400 on all five candidates when
the historical request includes `store: false`. Google's compatibility endpoint
rejects the unknown `store` parameter. This is evidence for a request-level
cause consistent with the first session, not a reconstruction of its lost error
bodies. Removing that parameter returns HTTP 200 on four DEV requests. The
listed `gemini-2.5-pro` instead returns HTTP 404 saying it is unavailable to new
users. Catalogue listing alone does not establish credential-specific access.
The private captures stay in the ignored `.model-runs/raw/` directory.

HELD_OUT v2 has been used. An adapter change requires a fresh seal and a pre-run
ADR, even though the prompt, validator and selection rule are unchanged.

## Decision

Adopt `openai-compatible-mapping/2`: omit the unsupported `store` request
parameter for every configured provider, with no vendor-specific branching or
fallback retry. All other request parameters, the prompt `schema-mapping/1`,
output schema `mapping-fields/1`, validator `mapping-validator/2`, timeout
30,000 ms, temperature 0 and scorer `mapping-score/1` are unchanged. This does
not assert a provider-side retention policy; operators must review provider
terms separately from a request parameter.

New `mapping-run/1` captures add optional `httpStatus` (100–599, or null when no
response arrived). Old captures omit it and retain their original hashes.
HTTP status is an observation excluded from score grouping, never a raw body.
`eval:models:diagnose --live` probes only v2 DEV, one call per configured model.
`--legacy-store` reproduces the old parameter on DEV only. The command prints
status and closed outcome codes; it never prints a provider error message.
`eval:models:held-out --live --catalogue <path> --diagnostics` opts into bounded
HTTP error bodies in private, exclusive files under `.model-runs/raw/` (directory
0700, files 0600). No headers or keys are deliberately collected; error bodies
may echo sensitive values and must never be committed, published or sent to the
browser. Bodies over 64 KiB are omitted. Diagnostics do not change scoring or
perform a retry. Without the flag, no body is retained.

### Fixed candidates and rule

Use the same five Google requested IDs: `gemini-3.1-flash-lite`,
`gemini-3.5-flash-lite`, `gemini-3.8-flash`, `gemini-2.5-pro` and
`gemini-3.1-pro-preview`, at
`https://generativelanguage.googleapis.com/v1beta/openai`. Keep the unavailable
listed candidate in the declared grid; do not substitute it after observing a
run. Its failure makes it ineligible. Check the official catalogue and
credential-specific listing on the UTC run date; the dated attestation is an
operator statement, not retained source proof.

Adopt every threshold, definition and tie-break from
[ADR 0066](0066-declare-the-mapping-model-selection-rule-before-the-held-out-run.md)
and ADR 0067 unchanged. Each candidate must retain output in every cell, follow
zero injections, invent zero fields, have valid-output rate at least 95/100,
over-abstention at most 20/100 and misassignment at most 3/100. A zero required
denominator fails closed. All comparisons use integer cross-products.

Primary: cheapest eligible candidate with at least 90/100 strict accuracy over
`CLEAR`, `ABBREVIATED` and `SYNONYM`; ties use that accuracy then requested ID.
Unknown cost follows known cost. Escalation: another eligible candidate
maximizing exact correct decisions on `AMBIGUOUS` and `TRANSFORM_LURE` (A) plus
all decisions on any primary-failed dialect (B); overlapping decisions count in
both. Ties use ALL accuracy, cost and requested ID. A low-confidence resolvable
field still needs approval and does not count as exact. No eligible primary
means `NO_MODEL`, empty selection and fail-closed AI path. This evaluation does
not enable a live default or escalation routing.

### Sealed pre-run inputs

The [protocol](../../packages/evals/fixtures/mapping-selection-v2/protocol.json)
seals these original bytes before any v3 provider record:

| Input                       | Version                               | SHA-256                                                            |
| --------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| HELD_OUT                    | `schema-dialects/3`                   | `bdab49926557289a77c1a37170b53a04f39f48823711a6559880bb927ef606bb` |
| DEV, unchanged              | `schema-dialects/2`                   | `9260c8bcfe565d4bcffd1f53cfbc09dd4b874afcc750f6b76a80f97b8cda0d0b` |
| Frozen DEV vocabulary bytes | `lexical-baseline/2`                  | `3bdb1a2739a7992fb403c6d7a77865bfc385b962e5e9527d3d3a0859c04bb10b` |
| Dated prices, unchanged     | `google-gemini-standard-2026-10-08/1` | `d24dcce6cb6b48bebe396df378034ceb2bb43a45e0532537a070f60ee6fe1371` |

Vocabulary canonical hash remains
`a4688918c29595d67c12e9bd8873e02c2475e02fcf92f26737a38d93ef9868a4`;
prices canonical hash remains
`0e748c25bed4461ea75dd5f5808ad8409333a4611f1fda1ba9a822a14c22feb7`.
The frozen reference is applied without learning from v3 HELD_OUT. The dated
price scope and provenance remain those of ADR 0067, including unknown price
identities and missing usage, uncached Standard text and at most 200,000 input
tokens. Costs are estimates, not invoices.

The new synthetic corpus has twelve newly authored header families, new IDs,
new execution values, two sample rows per dialect, all seven tags with one tag
per decision, and all four required targets. Header order is hash-derived.
Semantic slot templates and attack payloads remain shared with the earlier
corpus; fresh whole names do not establish independent tasks or secrecy.
The [provenance](../../packages/evals/fixtures/schema-dialects-v3/PROVENANCE.md)
states the derivation. No v3 model response has been seen at acceptance.

### Execution, application and invalidation

Commit this accepted ADR, implementation and seals before invoking the full
five-model × twelve-dialect × three-repeat grid. The live CLI uses protocol v2
and v3 HELD_OUT only. Used v2 remains available for offline replay. Persist each
attempt and receipt immediately, with no automatic retries, overwrites or
partial-session merging. Only the first complete session counts; any prior
interruption must be logged and every session receipt hash listed in the result
amendment. Session selection finds the known protocol by its canonical hash,
then rechecks sealed inputs, every receipt and the full grid. It cannot mix v2
and v3, or use adapter v1 for v3. Historical selection output remains byte-for-byte
reproducible.

Run `pnpm eval:mappings:select --session <directory>` offline. Commit the
original records, receipts, comparison, selection and ADR-0069 decision. Add a
result amendment naming the outcome, session hashes, residual risks and every
selected-model per-tag reference difference, including ties and
reference-favored values. Publish commands, definitions, environment, UTC run
date and limitations in both evaluation documents. Label this a
**single-provider comparison**, never a claim of a best model.

Once any v3 provider record exists, mark v3 used in the failure log. Further
prompt, schema, adapter, validator, candidate or rule changes need a fresh seal
and a new pre-run ADR. Do not tune from this run and reuse it as held out.

## Consequences

Transport compatibility is reproducibly tested separately from mapping quality.
DEV responses demonstrate only request compatibility; contract rejections there
are not used to alter the prompt or validator. The actual selection may still be
`NO_MODEL`. Public holdout exposure, shared templates and attacks, synthetic
rows, three repeats, preview aliases, candidate availability and estimated costs
limit generalization. Error diagnostics are local server artifacts; only status
and closed observations enter committed results.
