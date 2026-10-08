# Limitations

_[한국어](LIMITATIONS.ko.md)_

WeaveTrail is an early reference implementation for reproducible event
verification. It is not a production market-surveillance system.

## Current limitations

Current source inputs and evaluations are synthetic only. Real quotations and their pages/APIs have been withdrawn; earlier evaluation captures are labelled with withdrawn sources.

- Deterministic fixtures remain the default. The configured mapping adapter is
  tested with mocked transport only; no live provider quality or compatibility
  is claimed. Only the two committed synthetic source dialects are eligible.
  Configured proposals expire after 30 minutes and need a new request and
  approval; durable provider audit storage and person authentication do not
  exist yet. See [ADR 0029](adr/0029-bind-configured-mapping-proposals-to-review.md).
- Public live model requests enforce shared daily IP-based visitor and global
  call caps, resetting at 00:00 KST. Visitors default to 15 requests; the global
  cap requires configuration. Missing trusted Vercel IP/configuration or an
  unavailable store stops calls as `REVIEW_REQUIRED`. JSON content type and
  same-origin checks when an Origin header is present prevent third-party
  browser requests from reserving budget. The screen displays validated denial
  reasons. These pseudonymous IP counters do not authenticate people or limit
  tokens/currency; shared IPs share a quota, changed IPs can change visitors,
  and failed/unused reservations are retained. Hosted Redis/Vercel integration
  remains unverified; tests use fake storage and mocked transport. Local model
  evaluation bypasses public budgets. See [deployment settings](DEPLOYMENT.md#daily-public-model-budget)
  and [ADR 0063](adr/0063-reserve-public-model-budgets-in-shared-daily-counters.md).
- Model evaluation is partly built and nothing in it is measured yet. The
  sealed synthetic DEV and HELD_OUT schema-dialect set, the run-record
  contract, the validator probes and the [AI failure log](AI_FAILURE_LOG.md)
  exist. No model has been run against the held-out set, so no model accuracy,
  comparison, cost or selection is published. A configuration-driven
  Chat Completions adapter and explicit local smoke command with sanitized
  records exist, verified offline only. Offline integer scoring and a DEV-only
  lexical reference with explicit selection-record serialization are implemented.
  Their captures use authored synthetic controls, not measured models. The
  dialect corpus lacks a required eventType mapping, so the shared validator
  rejects every baseline run; this does not measure accepted-proposal quality.
  See [the baseline protocol](EVALUATION.md#non-model-lexical-reference).
  A selection rule fixed before the held-out model run, routing to one escalation model, bounded
  case-scope proposals are planned. A
  future comparison will hold for its synthetic set, prompt version, date and
  rule, not for exchange schemas in general.

- Case Replay uses the complete published-schema FIX 4.4 projection as its
  supported synthetic case and the actorless H0STCNT0 projection as its
  separate mapping-review example. H0STCNT0 has no rule manifest;
  acknowledging its absent actor cannot authorize the worked case. The source
  list also exposes a comparable broad-participation case that reaches
  `NOT_SUPPORTED`, a missing-side case that reaches `INCONCLUSIVE` and a
  conflicting-identity case that reaches `INPUT_REVIEW_REQUIRED`; the guided
  walkthrough itself still follows only the complete supported case.

- Guided completion preserves approvals and results only in the mounted
  browser view. Refresh starts unapproved. Repeating a case compares two actual
  hashes for same-input repeatability; it establishes neither authenticity nor
  general mutation tolerance. Advanced shuffle permutes parsed committed
  source-row records before mapping; duplicate repeats one derived event after
  mapping. Neither rewrites artifact bytes or renumbers coordinates. Tests cover
  representative committed-row permutations, not arbitrary rewritten files.
- Replay requests execute mapping, input, and case transitions through the
  approval state machine, and responses expose their final state. State and
  transition history are request-local: persistence, cross-request correlation,
  and audit history are not implemented. Corrected input after
  `INPUT_REVIEW_REQUIRED` starts a new request at `UPLOADED`.
- Mapping-only foundation validation ends at `MAPPING_APPROVED`; only an
  approved case rule replay reaches `REPLAYED`.

- No large-scale performance benchmark has been run.

- Upload persistence, authentication, multi-tenancy, and signed exports are out
  of the current scope.
- Public-source persistence has a SQLite implementation with immutable bytes,
  provenance and derived-result input bindings. Its collection and resolution
  APIs are tested with synthetic responses on local disk; the web app does not
  yet use them. Scheduled collection, event/share routes, multi-host storage and
  backup automation are not implemented, and the current plan does not include
  them. See
  [service snapshot operations](SERVICE_SNAPSHOTS.md).
- Finite-number spelling is specified, but the implementation does not claim
  full JSON Canonicalization Scheme compliance.
- [Evidence Bundle 1.3 hash scopes](EVIDENCE_HASH_SCOPES.md) define the
  byte-backed assembly and independent verification boundary. Verification
  recomputes source, approval, replay and hash relationships, but it does not
  authenticate a publisher or reviewer, provide a signature, or define
  multi-source replay. The legacy 1.2 schema stays available but cannot represent
  normalization without a rule result or the complete engine evaluation.

- `canonicalResultHash` alone does not bind case scope: approved mappings, manifests and audit records belong to `bundleHash`. Approval time may change the bundle hash without changing the semantic result hash.

## Interpretation limits

- `SUPPORTED` means only that data satisfies a declared technical rule.
- `NOT_SUPPORTED` is not proof that no misconduct occurred.
- `INCONCLUSIVE` is a first-class safe outcome, not an error to hide.
- Removing the approved actor group and replaying metrics is a mechanical
  sensitivity comparison, not a causal conclusion.
- Recomputing a cross-market reversal multiple against a declared alternative
  denominator is likewise mechanical, not evidence that the denominator caused
  the observation. A minimum price increment is an instrument specification,
  not a level established by a trade.
- Model confidence is not calibrated probability unless a documented
  evaluation establishes that property.

## Prohibited uses

Do not use this prototype to determine guilt, make legal findings, recommend or
execute trades, process undisclosed personal data, or replace qualified human
review.
