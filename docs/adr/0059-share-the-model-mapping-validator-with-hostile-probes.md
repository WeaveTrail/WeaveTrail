# ADR 0059: Share the model mapping validator with hostile probes

## Status

Accepted.

## Context

The configured mapping adapter checks structure, columns and required targets,
but historically did not dry-run transforms. Generic review failures also do
not identify which property an offline hostile output violates. A model's
willingness to follow instructions cannot establish the validator's behavior.

## Decision

Use one server-side `validateMappingOutput`, version `mapping-validator/1`, for
configured outputs, sealed-proposal re-validation and offline hostile envelopes.
It stops at the first failing stage: envelope, contract, columns, required and
unique targets, transforms on every supplied sample row, then review status.
Each failure has only a stable reason code and path, compatible with the reason
shape in [ADR 0058](0058-separate-mapping-run-records-from-raw-provider-traces.md).
Live callers still expose only sanitized `REVIEW_REQUIRED` failures.

The current configured model supports mapping 1.4/event 1.1. Parsed structured
fields and sealed proposals enter at the contract stage; daily and composite
execution mapping fixtures are outside this model-output gate. Envelope parsing
does not copy transport metadata into the proposal. Streamed responses are
bounded before parsing. No tools or generated code are executed.

Add an internal ai-harness dependency on replay-engine to reuse
`applyApprovedMapping` and the exact existing transforms and resulting event
contract. Dry-run coordinates are synthetic, temporary events are discarded,
and source rows are projected without mutation. Validation does not approve a
mapping, evaluate a pattern or produce evidence. All supplied samples are
checked, even when the model prompt includes only its first eight rows.

The offline hostile fixture provider authors malformed and ambiguous outputs.
Tests assert independently specified reason codes, fixed stage precedence,
repeatability, input immutability, the configured adapter's fail-closed behavior
and a valid control. CI runs them in the ordinary test suite without network.
No provider capture, model-run producer or semantic judge is introduced.

## Consequences

Validation rejects structurally invalid and transform-invalid outputs
independently of any model. New providers or model evaluations must use this
gate rather than their own interpretation of acceptance. Changes to its reason
meaning or ordering require a validator version change and updated invariants.

A well-formed, transform-valid swap of two same-shaped columns still passes.
A regression control swaps decimal price and quantity targets to make that
residual risk explicit. Human review and existing explicit approval remain
necessary; a valid output establishes structural compatibility, not semantic
correctness. Finite authored probes do not measure model robustness or guarantee
coverage of arbitrary malicious outputs.

Existing HTTP response contracts need no migration. The stricter configured gate
now holds transform failures and incompatible target/transform pairs in review
before any proposal can be approved. Registered fixture evaluations and their
published summaries remain unchanged.
