# ADR 0008: Use justified field overrides as the replay review boundary

## Status

Accepted

## Decision

A mapping field marked `REVIEW_REQUIRED`, or carrying confidence below the
declared review threshold, is adjudicated at the replay service boundary by a
matching field override in the mapping approval record. The override names the
field path and carries a non-empty reviewer-authored reason. The deterministic
engine validates that relationship before producing a replay result.

The replay route does not reject an entire scenario merely because its mapping
proposal contains a flagged field. It passes the proposal and approval record
to the engine, which returns `MAPPING_OVERRIDE_REQUIRED` for each unresolved
field. A justified matching override clears that field without changing the
approved mapping values or the canonical result.

`MAPPING_REVIEW_REQUIRED` is removed from the replay response issue-code
contract because the service no longer emits a scenario-level review outcome.
The workflow state with the same name remains part of the workflow vocabulary;
this decision changes only the replay response contract and service gate.

## Consequences

An absent approval still returns `APPROVAL_RECORD_REQUIRED`. A flagged field
without a matching justified override returns `MAPPING_OVERRIDE_REQUIRED` and
no result hash. A flagged field with a valid override may replay, subject to
the remaining approval, source-row, mapping-application, and canonicalization
checks.

Reviewer reasons remain opaque audit metadata. They are not interpreted as
mapping values and do not enter the canonical result hash.

## Contract migration

Replay-response consumers must stop matching `MAPPING_REVIEW_REQUIRED` and
handle `MAPPING_OVERRIDE_REQUIRED` at its reported field path instead. Existing
approval records for a changed mapping proposal do not match its new artifact
hash and must be recorded again with any required field override.
