# Limitations

_[한국어](LIMITATIONS.ko.md)_

WeaveTrail is an early reference implementation for reproducible event
verification. It is not a production market-surveillance system.

## Current limitations

- Deterministic fixtures remain the default. The configured mapping adapter is
  tested with mocked transport only; no live provider quality or compatibility
  is claimed. Only the two committed synthetic source dialects are eligible.
  Configured proposals expire after 30 minutes and need a new request and
  approval; durable provider audit storage and identity/spending controls do
  not exist yet. See [ADR 0029](adr/0029-bind-configured-mapping-proposals-to-review.md).
- The deployment configuration uses fixture proposals over committed synthetic
  and licensed published source artifacts; it contains no model-provider credential.
- Case Replay uses a supported synthetic case and a separate Dialect B mapping
  review example. Dialect B has no rule manifest; its justified override cannot
  authorize the worked case. The guide is not a missing/conflicting-source
  scenario suite.
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
- The published-case browser asks the visitor to approve before running. Its API
  validates the exact approved scope hash from a caller-supplied `APPROVED`
  record but does not authenticate the reviewer or prove that a person created
  the record. It demonstrates approval binding, not audit-grade human identity.
- Rule evaluations use synthetic cases and one fixed, licensed published
  index-and-futures case. The published case is a deterministic worked example;
  it does not establish real-market rule accuracy.
- Rule thresholds are illustrative per-case configuration, not calibrated
  market thresholds. In the published case they were selected with the
  observations already known. Synthetic and published-case results are not a
  detection-rate measurement.
- No large-scale performance benchmark has been run.
- Complete-series acquisition has a manual collector and offline admission
  checks; transport tests use synthetic responses, and no production retrieval
  service exists. Committed real complete-series artifacts retain every page
  and a row count equal to the publisher total for their predeclared scopes.
  That completeness is not a claim of stable remote snapshots, authenticity or
  coverage outside those scopes. The earlier FSC stock-quote artifact remains
  a bounded window. See
  [Published acquisition scopes](PUBLISHED_ACQUISITION.md).
- Upload persistence, authentication, multi-tenancy, and signed exports are out
  of the current scope.
- Finite-number spelling is specified, but independent Evidence Bundle
  assembly and verification remain planned. The implementation does not claim
  full JSON Canonicalization Scheme compliance.
- [Evidence Bundle 1.3 hash scopes](EVIDENCE_HASH_SCOPES.md) define contracts
  and a pure declaration hash, not an exported or independently verified bundle.
  Schema validation and hashing do not resolve source bytes, bind approval
  records, recompute a replay or authenticate evidence; those checks remain
  planned in #13. The legacy 1.2 schema stays available but cannot represent
  normalization without a rule result or the complete engine evaluation.
- `canonicalResultHash` alone does not bind case scope: approved mappings,
  manifests and complete audit records belong to `bundleHash`. A changed
  approval time can change the latter without changing the semantic result
  hash. The published FSC artifact has a foundation result hash after mapping
  approval, but no case or rule evaluation; it is not an INCONCLUSIVE rule run.

## Interpretation limits

- `SUPPORTED` means only that data satisfies a declared technical rule.
- `NOT_SUPPORTED` is not proof that no misconduct occurred.
- `INCONCLUSIVE` is a first-class safe outcome, not an error to hide.
- Removing the approved actor group and replaying metrics is a mechanical
  sensitivity comparison, not a causal conclusion.
- Model confidence is not calibrated probability unless a documented
  evaluation establishes that property.

## Prohibited uses

Do not use this prototype to determine guilt, make legal findings, recommend or
execute trades, process undisclosed personal data, or replace qualified human
review.

The published FSC KOSPI daily quotation window has no participant identities,
execution side or individual execution time. It normalizes after explicit
mapping approval, but an attempted case actor is refused before rule evaluation.
Its first-page sample is not the entire market. No actor, side, order,
hypothesis or verdict is added to the published source rows. A separate,
pre-approved case may evaluate the index and contract with a versioned rule;
each observed-value and threshold pair links to the thresholds' origin, and the
result means support for that declared pattern only. See
[ADR 0034](adr/0034-evaluate-real-instruments-without-altering-source-facts.md)
for the boundary and [daily quote normalization](DAILY_QUOTES.md) for exact
provenance and reproduction.
