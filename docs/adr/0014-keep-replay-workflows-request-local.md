# ADR 0014: Keep replay workflows request-local

## Context

The replay HTTP boundary exposes a workflow state and the replay engine records
the transitions taken while handling a request. These values explain where a
single request stopped, but the repository has no workflow store or durable
audit log. The successful response contract also needs to distinguish a
mapping-only foundation run from an approved case replay without changing the
deterministic evidence hash.

## Decision

Each HTTP request creates its own workflow and transition history at
`UPLOADED`. Corrected input is submitted as a new request and starts again at
`UPLOADED`; it does not continue an earlier request's history.

A mapping-only foundation execution ends at `MAPPING_APPROVED`. Only a replay
with an approved case manifest reaches `REPLAYED`. The successful response
contract enforces those branches: a `MAPPING_APPROVED` response has no
evaluation, while a `REPLAYED` response requires one.

`workflowState` is response context and is not an input to
`canonicalResultHash`.

## Consequences

Workflow state and history describe only the current HTTP request. Persistence,
cross-request correlation, and durable audit history are not implemented. A
caller cannot use the current API to resume a previous workflow, and systems
that need durable workflow evidence would require a separate, explicitly
designed persistence boundary.

Equivalent validated data and approvals retain the same canonical result hash
regardless of request-local workflow metadata.
