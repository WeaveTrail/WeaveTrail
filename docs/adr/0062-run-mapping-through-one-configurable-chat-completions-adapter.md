# ADR 0062: Run mapping through one configurable Chat Completions adapter

- Status: Accepted
- Date: 2026-10-07

## Context

The configured adapter fixed `/v1/chat/completions` after an HTTPS origin.
Path-bearing compatible endpoints could not be configured, and the sanitized
proposal API discarded the observations needed by `mapping-run/1`.

## Decision

Keep one transport and the unchanged `schema-mapping/1` instruction and output
schema for all endpoints. Configuration includes the HTTPS base URL with its
API path, key and pinned model ID. Append only `/chat/completions`; prohibit
credentials, query and fragment in the URL, and reject `latest`, `auto` and
`default` model aliases. A generic client cannot prove arbitrary vendor IDs
immutable; operators must verify pinning against the provider's catalogue.

Use strict `json_schema`, temperature 0, no tools, no redirects and no retries.
The 30-second deadline covers transport and body consumption. Bound success
and error bodies to 65,536 UTF-8 bytes and cancel oversized or timed-out reads.
Strict-mode rejection never triggers a relaxed request. Continue to use the
shared validator from [ADR 0059](0059-share-the-model-mapping-validator-with-hostile-probes.md).

The server adapter returns a sanitized attempt internally. Envelope refusal,
truncation, tools, malformed envelope and oversize are provider failures;
parsed field-output failures are contract rejections with validator reasons.
Only exact closed field output accepted by the retention schema may survive;
unknown keys are never stripped to manufacture a retainable output. Credential
echoes are discarded. Reported model and positive safe-integer token counts
are nullable observations, never inferred from the request. The web proposal
API still fails closed as `REVIEW_REQUIRED` without disclosing these records.

`packages/ai-harness` owns the transport on its existing server export.
`packages/evals` owns configuration lists, context binding and the explicit
local CLI; its existing downward edges to contracts, ai-harness, scenarios and
replay-engine suffice. There is no new workspace package or browser edge.
`tsx` is added solely to execute that TypeScript CLI, outside default checks.

The manual command requires `--live`, keys named by every model-list entry,
and an environment without `CI`. It runs one registered synthetic dialect per
entry and saves immutable local records and separate receipts under ignored
`dist/`. It neither reads the held-out corpus nor scores or chooses models.
The reusable record binder requires the caller to supply and verify evaluation
membership and seals; the smoke CLI binds its registered source artifact hash.

## Migration and limits

Change origin-only local base URLs to include their API path (usually `/v1`).
Trailing slashes are accepted. Existing HTTP proposal/approval contracts and
the `mapping-run/1` contract are unchanged. `StructuredOutputClient.generate`
now returns the internal sanitized attempt; proposal callers use `propose`.
No raw storage, vendor SDK, routing, live quality claim or deployment is added.
The prompt text and schema have not changed, so no prompt version is advanced
and no held-out set is burned. No new observed model/validator failure is fixed.

## Verification

Run `pnpm check` and `pnpm build`. The recorded-response tests use authored
synthetic envelopes and injected transport, not captured live vendor responses.
They cover path preservation, request parity, usage, refusal, truncation,
oversize, HTTP/strict failures, transport/body deadlines and fail-closed review.
