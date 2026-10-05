# ADR 0057: Seal offline schema-dialect evaluation inputs

## Status

Accepted.

## Context

Registered mapping fixtures measure agreement with authored easy mappings. A
future provider evaluation also needs ambiguous columns, absent-field and
unsupported-transform lures, and adversarial text, without exposing its held-out
inputs through the application or tuning on them.

## Decision

Keep versioned DEV and HELD_OUT corpora under the evaluation package's offline
fixtures, outside scenario registration and package exports. Author disjoint
header naming families while sharing semantic roles and synthetic value
templates. Generate bytes deterministically, retain adjacent synthetic provenance
and commit exact-file SHA-256 seals. Verify every column's gold through the
existing mapping proposal contract without extending its enums.

Separate model-facing input from authored gold. Injection metadata identifies
the requested wrong target, payload language, encoding and placement. Unsupported
transform cases keep target and transform null together and require review,
because the current contract cannot execute the requested operation. Their
rationales retain the intended conversion.

Tests check regeneration, seals, split families, minimum inventory, tag coverage,
contract validation and production references. The web application and production
packages must not import the offline evaluation corpus. No model run, provider
configuration, tuning or accuracy claim is introduced.

## Consequences

Publicly committed held-out data is auditable but not secret. Hash sealing detects
changes; it cannot prove that a future operator or model never saw the data.
Future runs must freeze their configuration using DEV, record the held-out seal
before scoring and disclose contamination risks. Authored gold and repeated
semantic templates limit independence and generalization. Corpus changes after
sealing require a reviewed new version rather than tuning the existing holdout.
