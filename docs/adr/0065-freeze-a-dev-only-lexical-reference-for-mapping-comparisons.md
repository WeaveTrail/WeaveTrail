# ADR 0065: Freeze a DEV-only lexical reference for mapping comparisons

- Status: Accepted
- Date: 2026-10-08

## Context

Mapping model comparisons need a non-model reference under the same scorer
and validator. A lexical lookup tuned on held-out names would leak evaluation
answers. A baseline accepted or selected through a special path would not
represent the model's trust boundary.

## Decision

Freeze whole-header normalization and a versioned dictionary derived only from
sealed DEV names and labels. Runtime decisions use the dictionary, whole input
names, sample strings and existing mapping enums/string contracts. They do not
use gold, tags, naming families, instructions, arbitrary substrings or positions.
Unknown keys, bad/missing samples and competing target aliases abstain. Keep
authoring, records, comparison and selection helpers outside the package's
production exports; neither live routes nor routing use this baseline.

Emit proposal 1.4 and invoke the existing shared validator. Preserve its actual
gate outcome in mapping-run/1, with retained field decisions for diagnostics.
Do not weaken the validator or promote rejected abstentions to valid output.
The present dialect corpus has no eventType column, so all baseline attempts
are rejected. Synthetic oracle/abstention controls test metric and selection
serialization only, with explicitly authored validator outcomes. They cannot
establish model performance or accepted baseline quality.

Publication generates a reference for each model's sealed dialect/repeat grid,
requires candidates within a split to share that grid, and invokes the same
integer scorer for all records. Reference identities are reserved and cannot
enter as selectable candidates. Every comparison retains the reference row
and exact signed differences for every tag and decision metric. Record explicit
model choices with all differences, including equal and baseline-favored tags,
and the full comparison hash. No automatic choice is made.

Use stable zero latency only as a nonmeasurement sentinel, mark reference
resources as NON_MODEL_SENTINEL, and leave token observations unavailable.
Capture deterministic compact JSON with one newline; verify baseline records,
summary and explicit synthetic selection fixture byte for byte offline. Bind
the dictionary hash, DEV byte seal and algorithm version in the comparison.

## Alternatives

- Guessing semantic fields from numeric values or substring matches: can assign
  plausible targets to ambiguous names or instruction-bearing text.
- Learning aliases from both splits: makes the held-out reference a gold lookup.
- Special acceptance or scoring rules for the reference: changes the trust
  boundary and obscures the evaluation corpus's missing required fields.
- Dropping equal or unfavorable tags from selection records: hides where a
  selected model supplies no measured advantage over deterministic code.

## Consequences

The reference has deliberately limited coverage and can reject whole proposals
even when some retained columns match. This version and corpus cannot measure
accepted-proposal quality; a future evaluation design must address that in a
separate version. Applying the frozen baseline to HELD_OUT is now recorded;
changes must not be tuned on those results. Real model evaluation, a selection
rule fixed before that run, and routing remain planned. See
[the protocol](../EVALUATION.md#non-model-lexical-reference).
