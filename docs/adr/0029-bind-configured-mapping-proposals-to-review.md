# ADR 0029: Bind configured mapping proposals to review

- Status: Accepted
- Date: 2026-09-06

## Context

A configured provider may return a different proposal on each call. Repeating
the call during replay would invalidate approval of the displayed proposal.
The mapping contract and canonical result must remain independent of provider
metadata. Provider identifiers and raw traces must remain server-only.

## Decision

Implement ADR 0028 through an explicit `POST /api/mapping` request. Page
preparation and builds make no provider calls. Only the committed synthetic
`concentrated-buy-dialect-a.csv` and `concentrated-buy-dialect-b.jsonl` artifacts
are eligible. This closed application registry leaves published data and the
worked rule cases on registered deterministic mappings, even in configured
mode. Eligibility does not depend on source values or a model decision.

Send the artifact hash, declared columns and the first eight parsed rows in
committed order, projecting only declared columns. The request is limited to
32 columns and 16 KiB of serialized source data; excess data fails closed rather
than being selectively truncated. The row count is bounded before serialization.
Dataset and venue constants come from the server registry and are never model
output. There are no tools or generated-code execution paths.

The server-only adapter uses an HTTPS origin plus `/v1/chat/completions`, a
closed JSON schema and a separate instruction/data message pair. It rejects
redirects, refuses incomplete or multiple completions, limits responses to
64 KiB and gives the transport a 30-second timeout. It does not retry. The
strict local mapping contract remains authoritative after structured output:
each declared column must occur once in order, targets must be unique and
include the required identity/time/type fields, evidence must contain text,
and every field must have confidence 1 and status `PROPOSED`. Low confidence
does not become an approvable configured proposal. Fixture override behavior
is unchanged. These are structural controls, not proof of semantic correctness
or a calibrated confidence measure.

Record provider mode, configured model identifier and prompt version beside
the validated proposal, outside the mapping and case contracts. An AES-256-GCM
receipt encrypts and authenticates this record with a 30-minute expiry. HKDF-SHA256
derives its key from the server credential, endpoint origin and a dedicated
receipt purpose. Each receipt uses a random 96-bit nonce and authenticated
purpose data. This avoids a process-local cache that would fail across serverless
instances and does not introduce another deployment variable. Credential or
model changes invalidate receipts. The receipt is not an approval.

The browser receives only a validated mapping, its actual provider mode and an
opaque receipt. Replay decrypts and revalidates the record, checks its source
binding and then uses the existing approval gate. It never calls the provider.
Missing, expired, altered or mismatched receipts fail as `REVIEW_REQUIRED`.
There is no substitution with a fixture in an eligible configured request.
The approved mapping projection alone continues to enter canonical replay.

## Consequences

- The existing mapping/case versions and golden hashes are unchanged. The
  replay HTTP contract adds an optional `mappingReceipt` and permits result
  mode `ai`; existing fixture clients require no migration.
- Metadata is recoverable on the server from the receipt for its lifetime.
  Durable audit storage, identity controls and provider quality evaluation
  remain future work. Refresh clears local approvals; an expired proposal
  requires another request and explicit approval.
- Shared adapter types, sanitized failures and structured transport live in
  `ai-harness`; server configuration and transport are exposed only through
  its separate `server` entry. The client-module graph test guards that entry
  and the application receipt module.
- Mocked transport tests establish protocol and boundary behavior only. They
  do not establish compatibility or mapping quality for a live vendor.
- The configured public endpoint has no identity or spending controls yet;
  deployed environments remain in fixture mode pending those controls and
  the deployment promotion checks.

The wire format follows the official
[Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs).
Supporting that protocol is a requirement of a configured endpoint, not a
claim that every compatible provider has been tested.
