# ADR 0058: Separate mapping run records from raw provider traces

## Status

Accepted.

## Context

The sealed synthetic dialect corpus is input for a planned model evaluation.
Comparisons need each attempted call's configuration, validation outcome and
resource observations, including failures. Provider envelopes and error messages
can contain request identifiers, headers or credentials. Publishing them is not
necessary to re-score field mappings. Wall-clock metadata also varies separately
from the retained observations.

## Decision

Add the strict, versioned `MappingRunRecordSchema` to shared contracts. A record
binds a corpus version, exact-file SHA-256 and split to a dialect and a one-based
repeat. It records provider, requested and reported model, adapter, prompt,
output-schema and validator versions, decimal-string temperature, outcome,
validator reason codes and paths, failure class, parsed output, integer latency
and nullable token counts. Unknown usage and unreported models are null; token
counts cannot use zero as a placeholder.

Only a closed `{ fields: [...] }` projection of structured model output may be
retained, bounded to 65,536 bytes of UTF-8 `JSON.stringify` output. `VALID`
requires the existing mapping-field contract, no reasons and no failure class;
it does not authorize a mapping or prove semantic correctness. Rejected output
may retain missing fields or incorrect scalar values for re-validation, but
unknown keys and nested objects in field values are rejected. Output with an
unsafe shape, excess size or no parseable JSON is null with coded reasons;
the original cannot be recovered from that record. Provider failures have null
output, no validator reasons and a classified failure rather than a raw error.

Every object boundary rejects additional properties. There is no place for a
request body, response envelope, headers, provider request ID, credential or
exception message, including inside retained output or reasons. Do not extract
a convenient subset from an envelope and label it a model output: parse only
the structured message content. Producers must keep secrets out of permitted
strings as well; a shape validator cannot identify arbitrary secrets embedded
in prose. Raw envelopes may only be retained locally under the ignored
`.model-runs/raw/` directory. No raw capture is introduced by this change.

`MappingRunReceiptSchema` records a run ID, wall-clock start and the canonical
record hash in a separate file. Hash validated records with the existing
`sha256Canonical` function; summaries consume records, never receipts. Latency,
usage and reported model stay in the record because they are observations of
that particular call. Receipt metadata stays outside its hash and any stable
scoring summary, following [ADR 0002](0002-volatile-metadata-outside-canonical-hash.md).

## Consequences

Re-scoring committed records is reproducible with the same sealed inputs,
validator and scoring versions. Re-running a model is a new record, even with
identical request configuration: output, reported model, usage and latency may
change. Null-output failures can be re-counted from their outcome and reasons,
but their discarded output cannot be re-validated. Corrections and new scoring
versions must preserve the original observations rather than overwrite them.

This implements contracts and offline tests only. Provider instrumentation,
record persistence, live calls and scoring remain planned. Existing mapping
responses, configured-provider behavior and the fixture evaluation publication
are unchanged. Tests use synthetic records, not captured model results.
