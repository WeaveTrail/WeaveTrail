# ADR 0064: Score mapping records offline with integer metrics

- Status: Accepted
- Date: 2026-10-08

## Context

The sealed schema-dialect corpus and `mapping-run/1` records need a common
scorer for model and non-model producers. Counting correct abstentions as
mapping accuracy would reward a mapper that refuses every resolvable column.
Averages can also hide provider failures, missing usage and repeat variation.

## Decision

Add an offline-only scorer under `packages/evals`, outside its production
entry point. Read committed records, verify the corpus byte seals and exact
version/split/dialect bindings, and reject duplicate run identities and
incomplete dialect-by-repeat grids. A cohort can cover a subset of the corpus;
its exact dialect inventory and repeat IDs are retained. Never generate gold,
call providers or change a recorded validator outcome during scoring.

Strict field accuracy counts exact proposed target/transform/status matches
on resolvable gold decisions only. Every invalid run contributes zero correct
decisions with its full denominator. Correct abstention on unresolvable gold
and over-abstention on resolvable gold are inseparable companion metrics.
Missing output is a miss, not an observed abstention. See the
[metric definitions](../EVALUATION.md#offline-mapping-run-scoring).

Group by requested model, provider, prompt, adapter, output schema, validator,
temperature and sealed split. Report returned model identities and missing
identities as counts inside the group: a failed attempt without a returned
model must stay in its requested model's denominator. Rejected retained fields
can still reveal misassignment, invented fields and followed injections;
null outputs cannot establish that these behaviors were absent.

Use BigInt for metrics, token products, rational comparisons and cost. Serialize
integer counts as decimal strings. Reserve `numerator`/`denominator` for ratios;
latency quantiles use `valueMs`/`sampleCount`, and token/cost totals use
`sum`/`coveredRuns` with `totalRuns` coverage. Distinct field names prevent
consumers from dividing a quantile or silently turning a total into a mean.
Price entries bind exact provider/requested/
reported identities, including explicit null if appropriate, in a dated,
versioned table with provenance. Round each reported-model identity's summed micro-USD amount upward once, then
sum those amounts for the requested-model group;
report known-cost coverage. No implicit free price or inferred missing usage.

Rank only strict accuracy, for matching inventories and repeat IDs with at least
two repeats. The absolute difference between repeat means must strictly exceed
each group's own maximum-minus-minimum repeat accuracy. Cross-multiply all
fractions. Ties, insufficient repeats and zero denominators remain unranked;
this is a deterministic heuristic, not a significance test or model selection.

## Migration and limits

The additive `mapping-score/1` summary and `eval:mappings:score` command do not
change `mapping-run/1`, prompts, the live path or existing evaluation summaries.
Before this summary's initial merge, its resource fields changed from
`numerator`/`denominator`: consumers must read latency as `valueMs`/`sampleCount`
and token/cost totals as `sum`/`coveredRuns`, preserving `totalRuns`. Regenerate
any pre-merge summaries from their original records and price tables; ratio
fields and arithmetic are unchanged. No mean or mean-rounding contract is added.

The same function consumes a non-model producer's records without special
scoring rules. Implementing the lexical baseline remains separate work.

Committed records and prices in `mapping-score-v1` are explicitly authored
synthetic scorer regression fixtures. They are not model measurements or the
lexical baseline. No vendor prices, model results or selection are published.
No held-out input was used to tune a prompt. No observed model/validator defect
is fixed, so this change does not add a failure-log entry or prompt version.
