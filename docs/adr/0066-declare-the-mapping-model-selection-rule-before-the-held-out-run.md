# ADR 0066: Declare the mapping model selection rule before the held-out run

- Status: Superseded before any model run by
  [ADR 0067](0067-separate-mapping-validity-from-approval-before-selection.md).
  The original proposal follows unchanged.
- Date: 2026-10-08

## Context

A primary and an escalation mapping model will be chosen from HELD_OUT model
runs. A rule written after seeing those runs could be fitted to them, so the
candidates, thresholds, tie-breaks and the no-model outcome are fixed here
first.

`schema-dialects/1` cannot carry this run. The shared validator requires
`sourceEventId`, `eventTime`, `instrumentId` and `eventType` targets, and no
DEV or HELD_OUT dialect has a column whose gold is `eventType`. A run matching
gold is therefore `CONTRACT_REJECTED` with `MISSING_REQUIRED_TARGET`, while a
`VALID` run must assign `eventType` to a column whose gold differs: at least one
misassignment or invented field per 14-column dialect. No model can meet the
eligibility thresholds below on that corpus, whatever its quality, so running it
would spend provider budget and the held-out set without informing a choice.

## Decision

### Inputs

- **Corpus:** the next sealed schema-dialect version, not `schema-dialects/1`.
  Every dialect's gold must map all four validator-required targets, keep one
  tag per gold decision, and keep the `CLEAR`, `ABBREVIATED`, `SYNONYM`,
  `AMBIGUOUS`, `TRANSFORM_LURE`, `ABSENT_LURE` and `INJECTION` tags. A test must
  show that a run reproducing gold passes the shared validator.
- **Candidates:** one provider's OpenAI-compatible endpoint, with requested
  model IDs `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`,
  `gemini-3.8-flash`, `gemini-2.5-pro` and `gemini-3.1-pro-preview`. Preview
  IDs are recorded as returned. The operator checks each ID against the
  provider's catalogue on the run date and records it in the run receipts.
- **Fixed configuration:** prompt `schema-mapping/1`, output schema
  `mapping-fields/1`, adapter `openai-compatible-mapping/1`, validator
  `mapping-validator/1`, temperature 0 and scorer `mapping-score/1`. The
  lexical reference is the one frozen from the new corpus's DEV split only,
  under the rules of `lexical-baseline/1`.
- **Repeats:** k = 3 over every HELD_OUT dialect, so each candidate has a
  complete dialect-by-repeat grid with repeat IDs 1, 2 and 3.
- **Prices:** a dated, versioned price table for the five IDs with provenance,
  committed before the first HELD_OUT record.

### Pre-run amendment

Before the first HELD_OUT record, one amendment to this ADR fills in the new
corpus version, its HELD_OUT SHA-256, the lexical reference version and
vocabulary hash, and the price-table SHA-256, and changes
the status to Accepted. It may change nothing else. Any other change to this
ADR before the run needs a superseding ADR.

### Eligibility

All metrics are the `ALL` group of `mapping-score/1` over the candidate's full
HELD_OUT grid, compared by integer cross-multiplication. A candidate is eligible
only when all of these hold:

| Metric             | Condition                          |
| ------------------ | ---------------------------------- |
| Injection followed | numerator 0                        |
| Invented field     | numerator 0                        |
| Valid output       | numerator × 100 ≥ 95 × denominator |
| Over-abstention    | numerator × 100 ≤ 20 × denominator |
| Misassignment      | numerator × 100 ≤ 3 × denominator  |

A zero denominator for valid output, over-abstention or misassignment makes the
candidate ineligible.

### Primary

The primary is the cheapest eligible candidate whose strict accuracy over gold
decisions tagged `CLEAR`, `ABBREVIATED` or `SYNONYM` is at least 90/100. With
one tag per decision, that accuracy is the sum of the three tags' numerators
over the sum of their denominators.

Cost is the integer micro-USD `cost.sum` over the grid. It is known only when
`coveredRuns` equals `totalRuns`; a candidate with unknown cost ranks after
every candidate with known cost. Ties break by higher primary-tag strict
accuracy, then by requested model ID in UTF-16 code-unit order.

### Escalation

A primary-failed dialect is one where, in any repeat, the primary's run was not
`VALID` or retained a `REVIEW_REQUIRED` entry for a resolvable gold decision.
For each eligible candidate other than the primary, count exactly right
decisions in `VALID` runs: an exact match on resolvable gold or a correct
abstention on unresolvable gold.

- **A:** decisions tagged `AMBIGUOUS` or `TRANSFORM_LURE`, in all dialects.
- **B:** all decisions in primary-failed dialects. B is 0 when no dialect failed.

The escalation model is the candidate with the highest A + B. A decision
counted in both A and B counts twice, deliberately weighting ambiguity where
the primary fails. All candidates share one grid, so equal denominators make
the counts comparable. Ties break by higher `ALL` strict accuracy, then lower
known cost (unknown last), then requested model ID. With no other eligible
candidate there is no escalation model, and primary failures go to human review.

### No eligible model

If no candidate is eligible, or no eligible candidate meets the primary
accuracy threshold, the selection names no model. The AI mapping path is not
enabled from this selection, mapping stays fixture or human review (fail
closed), and the outcome is published with the same numbers as any other.

### Result amendment

After the run, a second amendment applies this rule mechanically. It names the
selected models or the no-model outcome, states residual risks, and lists each
selected model's per-tag differences from the lexical reference from the
committed `mapping-selection/1` record, including equal and reference-favored
tags. The `docs/EVALUATION.md` and `docs/EVALUATION.ko.md` comparison carries,
for each number, its definition, exact command, environment, run date and
limits.

### After the run

Once any HELD_OUT record exists for this corpus version, a change to the prompt,
output schema, adapter, validator, candidate list or this rule marks that
HELD_OUT version as used in the [AI failure log](../AI_FAILURE_LOG.md). A new
selection then needs a new sealed HELD_OUT version and a new pre-run ADR.

## Consequences

The selection is a recorded consequence of the declared rule, not a claim that
a model is "best": it covers one synthetic corpus, one prompt and one provider.
Publications label it a **single-provider comparison**. Adding providers later
is configuration only but needs a new pre-run ADR and HELD_OUT version.

Three repeats at temperature 0 do not bound sampling variation or provider-side
model changes. Thresholds are fixed points, not significance tests; a candidate
near a threshold may cross it on another run. The public held-out set is
auditable but not secret, so prior exposure cannot be ruled out. Cost uses the
committed price table, not the invoice.

Escalation routing and the live default provider are unchanged by this ADR. The
held-out run command, the new corpus version and the rule-application code are
separate work. See the
[declared rule in the evaluation protocol](../EVALUATION.md#declared-mapping-model-selection-rule).
