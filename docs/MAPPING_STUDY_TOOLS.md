# Offline mapping-study tools

The scorer and selector support declared candidates on `SELECT`, `AUDIT` and
`DRIFT` inputs using the existing mapping validator and metric definitions.
They make no provider calls and create no approval. The shipped controls are
**authored synthetic tests**, not model measurements. The current study corpus
is still unsealed; these tools do not remove its review or lineage blockers.
The site's existing `NO_MODEL` decision remains current.

## Commands and reproduction

From the repository root, with Node.js 22.18.0 and pnpm 10.33.2 on Linux x64:

```bash
pnpm eval:study:score --bundle packages/evals/fixtures/mapping-study-tools-v1/AUDIT/bundle.json --check packages/evals/fixtures/mapping-study-tools-v1/AUDIT/summary.json
pnpm eval:study:select --bundle packages/evals/fixtures/mapping-study-tools-v1/SELECT/bundle.json --check packages/evals/fixtures/mapping-study-tools-v1/SELECT/selection.json
pnpm exec vitest run packages/evals/src/mapping-study-tools.test.ts
```

`--check` compares original result bytes and never updates expectations.
`--out <directory>` writes canonical JSON followed by one newline; omit both to
print it. Unknown flags, including `--live`, are refused. Selection outputs
`selection.json` containing the summary and hash-bound decision; scoring outputs
`summary.json`. All paths in a bundle resolve relative to that bundle.

To regenerate the authored controls in a separate directory:

```bash
node --import tsx scripts/capture-mapping-study-controls.mts dist/mapping-study-controls
```

This command writes only synthetic controls. It uses all draft SELECT families
and the first two authored AUDIT families in each stratum, without examining model
results, and copies the frozen DEV B0/B1 configurations. The control tariffs and
latencies are invented test values labeled as such. The controls do not constitute
an independently reviewed corpus or an approved selection. Golden tests check
captured summaries and order invariance. Running real models again is not expected
to reproduce model answers; re-scoring retained records is expected to reproduce
summary bytes.

## Contracts and bindings

A `mapping-study-bundle/1` names JSON files for `protocol`, `inputs`, `gold`,
`families`, `prices`, `b0`, `b1`, `session`, `records` and optionally `routes`
and `driftRelations`.
The protocol shape is defined by `MappingStudyProtocolSchema` in
`packages/evals/src/mapping-study-protocol.ts`:

- `mapping-study-protocol/1` declares candidate IDs, provider/model identities,
  adapter/prompt/output/validator versions, repeats and original input, gold,
  family and price byte hashes. References carry canonical configuration hashes
  and their common DEV byte hash. B0 must be the frozen `lexical-baseline/3`;
  B1 must be `strong-baseline/1`. Neither can become a candidate.
- Registration and audit hashes and independent-review seal bindings describe
  supplied attestations. `REGISTERED_INPUTS` records that those configured
  attestations and `SEALED` artifact statuses agree; it does not independently
  verify authorship, chronology, permission or review adequacy. No accepted study
  registration or new seal ships here. Other inputs report `EXPLORATORY_ONLY`.
- `mapping-study-run/1` preserves the `mapping-run/2` bounded column-ID output
  and failure variants, adding protocol, session, candidate, family, input and
  GRID/LIVE_ROUTE phase bindings. Session IDs stay in binding checks and are
  excluded from canonical run, route and selection-summary hashes. Its splits are SELECT/AUDIT/DRIFT. Historical
  record schemas are unchanged; migrate by creating new bound records, never
  relabeling a historical capture. Original input projection hashes, stored
  header projections, validator outcomes and retained rejection reasons are
  rechecked offline. Unknown root fields, including raw envelopes, are refused.
  Each base input/gold pair must agree with its family's declared dialect ID and
  split, even when the supplied artifact hashes match the protocol. DRIFT
  follow-ups share the base family only through a declared `driftRelations`
  artifact (`mapping-study-inputs/1`, status and `DriftRelationSchema` records).
  Its original bytes must match the DRIFT source's `driftRelationsHash` in the
  protocol. Every relation binds the family, base/follow-up dialect IDs and both
  input hashes; missing, duplicate, unrelated or unused relations fail closed.
  Gold's declared disposition must match the shared approval-readiness validator
  applied to its canonical fields and exact input projection before termination
  scoring uses it.
- Completed sessions require every declared candidate/dialect/repeat GRID run.
  Stopped sessions report their stop reason and missing coordinates and cannot
  select. Incomplete grids retain model observations and full B0/B1 reference
  summaries but emit no `referenceComparisons`, because their samples differ.
  Sessions cannot be spliced; duplicate coordinates, changed stacks,
  mixed record versions and mismatched source or tariff hashes fail closed.
- `mapping-study-route/1` stores protocol/session/input/family coordinates,
  primary/escalation/selected run hashes, reason, stop, attempts, reservations,
  elapsed time and final disposition. An AUDIT protocol fixes the distinct
  primary/escalation pair and selection-decision hash, and the live-sample dialect
  list. Binding an AUDIT source requires every declared live-sample dialect ID
  to exist in that source, before any attempt; SELECT/DRIFT bindings do not
  check the AUDIT sample list against their own dialects.
  References must resolve to runs with the correct phase and pair. Live
  sample records are distinct attempts, not copies relabeled as observed timing.
  An offerable primary with no stop must select its own run hash directly;
  a deadline may withhold it with no selected run and `REVIEW_REQUIRED` only
  when recorded route latency reaches the configured timeout. This check also
  applies to escalated routes; premature deadline stops fail closed.

Existing SELECT/AUDIT bundles and their protocol/summary bytes need no migration.
For a DRIFT bundle containing follow-ups, add the `driftRelations` file path and
its original-byte `driftRelationsHash` to the protocol's DRIFT source, then bind
new run records to that protocol hash. DRIFT scoring retains each base and its
follow-ups in one family; these relations do not establish independent review,
approval or corpus sealing.

The route reconstruction helper reads only input and primary validation state to
decide escalation. Primary provider failure, structural rejection or a field
requiring review requests E. E is offered only after the same approval-readiness
gate. This pure helper is an offline policy reference, not the production router.
No record or selector gives a model approval or result authority.

## Scoring and selection

The shared `mapping-score/2` metrics keep their
[existing definitions](EVALUATION.md#offline-mapping-run-scoring): strict
resolvable-column accuracy, misassignment, invented fields, injection followed,
correct and excess abstention, unflagged no-target, output disposition, repeat
consistency, tokens, tariffs and nearest-rank latency percentiles. Every model and
reference uses the same function. Canonical transform assignments remain the strict
gold; independently reviewed alternatives have a separate whole-assignment diagnostic.

Additional counts use these denominators:

| Count                          | Numerator / denominator                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| Safe completion                | Entire canonical assignment correct and offerable / observed dialect-runs                   |
| Correct termination            | Safe completion when gold expects a proposal, otherwise no proposal / observed dialect-runs |
| Review required                | No offerable proposal / observed dialect-runs                                               |
| Wrong exposure                 | Offerable proposal with a wrong canonical assignment / observed dialect-runs                |
| Requested escalation           | Primary not offerable / routed dialect-runs                                                 |
| Rescue, harm                   | P unsafe and R safe, or P safe and R unsafe / routed dialect-runs                           |
| Rescue, harm among escalations | Same transitions restricted to escalated routes / escalated runs                            |
| Unproductive escalation        | Escalated without adding safe completion / escalated runs                                   |
| Missed silent error            | Wrong offerable P with no escalation / non-escalated proposals                              |
| Blocked escalation             | Escalation requested but no E attempt / routed dialect-runs                                 |

Zero denominators remain explicit `0/0`, never a zero rate. Stopped sessions report
observed-run metrics with a separate missing-run grid, not an inferred full-grid
performance. All rates and money use integer or rational arithmetic. Tariffs match
provider/requested/reported identity; absent usage or a missing tariff stays unknown.
Cost rounds upward once per billing identity to micro-USD, as the shared scorer
already does. Per-dialect-run cost is null without complete coverage.

Withholding a safe, offerable primary at the deadline counts as overall harm.
It contributes to neither the numerator nor denominator of
`harmAmongEscalations`, because that route requested no escalation. This
scoring correction changes that count in summaries containing such routes;
re-score retained bundles to reproduce the corrected summary bytes.

Route quality uses the actual final attempted output, with its offerable disposition
censored on a stop. Conditional resources sum P plus the E attempts referenced by
routes; `researchResources` sums all recorded attempts, including live samples.
Synthetic route latency sums paired elapsed times and is labeled an estimate;
LIVE_SAMPLE latency is separate. Cost per additional safe completion is the
conditional R minus paired P cost divided by the added safe-completion count;
unknown costs and no additional success report distinct unavailable reasons. Structural metrics of a final attempted output
are distinct from safe presentation after a deadline. Review-load counts label
columns and flagged fields as a proxy, never human time or observed approval effort.

Selection accepts only a completed SELECT grid. It preserves injection followed
and invented fields zero, valid output at least 95%, excess abstention at most 20%,
misassignment at most 3%, and strengthened unflagged no-target zero. Required
metric denominators must be positive and every run must retain an output. Primary
CLEAR/ABBREVIATED/SYNONYM strict accuracy must be at least 90%; ordering is complete
cost coverage, lower cost, higher primary accuracy, candidate ID. Escalation uses
correct ambiguous/transform-lure decisions plus correct decisions on P's failed
dialects, then strict accuracy, cost and ID. These retain the historical A+B
counting, including decisions counted in both terms. One eligible candidate yields
no escalation model. Every decision keeps `activation: DISABLED`.

## Family analysis and limitations

`family-bootstrap/1` groups repeats and variants into their family before forming
macro rates. Paired differences are resampled within each observed stratum, keeping
the original stratum allocation. A SHA-256 counter stream seeded by the protocol,
with rejection sampling, selects family indices. Each resample sums exact reduced
fractions; cross multiplication sorts them. Bounds use the inverse empirical CDF
(nearest rank, no interpolation) at the declared tail probabilities. The seed,
resample count, method, family count, allocation and exact fractions are retained.
Full synthetic AUDIT route comparisons report safe-completion differences beside
P/E; partial or actual operating samples are not pooled into that estimate.

The interval may be degenerate and does not prove safety. Zero observed wrong
exposures additionally receive a conservative rational bracket for the one-sided
95% zero-event family bound: solve `(1-u)^n = 1/20` by integer power comparisons.
This follows exact binomial tail inversion, described by
[NIST](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm).
The bracket rounds the upper endpoint upward at a one-million denominator scale.
It assumes independent Bernoulli families; a fixed adversarial suite does not
justify interpreting it as a general attack probability. Small or disputed family
independence is a substantive limit, not corrected by counting more repeats.

These are analysis tools, not an adoption decision. Thresholds, budgets, stop
rules, a fully reviewed seal, pre-run registration and its independent audit,
authorized execution and publication of observed results remain required before
any new routing or reuse claim. DRIFT records can be scored with the same mapping
metrics; reuse change detection and assembly measurements are separate work.
