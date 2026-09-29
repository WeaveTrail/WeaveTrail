# Evaluation Protocol

_[한국어](EVALUATION.ko.md)_

WeaveTrail publishes fixture agreement counts, not accuracy or performance
estimates. The versioned offline runner checks committed source dialects,
canonical mutations, declared rule results, and finding-to-source traces.

## Versioned fixture evaluation

From a clean checkout, install the locked dependencies with
`pnpm install --frozen-lockfile`, then run:

```bash
pnpm eval
```

This fixture-only command writes `dist/evaluation/summary.json` and
`dist/evaluation/run.json`. The summary must reproduce the committed
[raw summary](../packages/evals/results/financial-replay-v1.json) byte for byte.
The run receipt records the actual Node, pnpm, Vitest, OS and architecture,
commit SHA, working-tree state, input-tree fingerprint and summary checksum.
The [captured receipt](../packages/evals/results/financial-replay-v1.run.json)
records the publication environment. Environment and checkout metadata stay
outside the stable summary; both files form the machine-readable publication.
No API credentials, network requests or configured AI providers are used.

The [case definitions](../packages/evals/src/cases.ts) declare mapping fields,
review outcomes and mutation oracles. The [runner](../packages/evals/src/runner.ts)
reads scenario outcomes from the existing
[scenario expectations](../apps/web/src/app/expectations/scenario-expectations.json),
also consumed by the public expectations page. It verifies the actual artifact
bytes against their declared hashes before comparing parsed and registered rows.
Changes to expected mappings, review outcomes, mutation oracles, scenario results
or trace references fail the command. Neither the command nor Vitest's snapshot
update flag rewrites these targets. Tests exercise those failure paths.

## Captured counts and scope

All counts below come from the linked raw summary and its cases, using `pnpm eval`
on the environment in the captured receipt (Node 22.18.0, pnpm 10.33.2,
Vitest 5.0.1, Linux x86_64). They count authored fixtures, not independent samples.

| Check                    | Captured outcome                                                                                               | Denominator and limitation                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Mapping proposal fields  | 13 agreements                                                                                                  | 7 FIX 4.4 fields and 6 H0STCNT0 fields; registered fixture proposals against authored targets, not model accuracy      |
| Mapping review           | FIX accepted; H0STCNT0 requires review without its absent-actor override; both accepted with fixture overrides | 2 schema-grounded synthetic dialects; no automatic human approval is claimed                                           |
| Synthetic rule results   | 2 `SUPPORTED`, 1 `NOT_SUPPORTED`, 1 `INCONCLUSIVE`                                                             | 4 `RAPID_PRICE_LIFT/1.1` cases, counted once each; no real-market interpretation                                       |
| Canonical mutations      | 40 preserved, 24 rejected with declared errors                                                                 | 8 mutations on each of 8 successful synthetic baselines; excludes published artifacts and the pre-replay conflict case |
| Finding traces           | 75 of 75 references resolve; 15 findings                                                                       | Counts reference occurrences, including reuse across findings; zero-finding cases contribute no successful references  |
| Published baselines      | 5 normalized                                                                                                   | Licensed committed artifacts only, with no rule verdict or mutation included                                           |
| Total baseline inventory | 14 cases                                                                                                       | 9 synthetic sources, including one conflicting source that requires input review, plus 5 published sources             |

**Evidence completeness** is checked over baseline finding references.

Mapping agreement compares source column, target field, allowed transform and
review status. Composite event time and declared absent fields are checked
separately. The two dialects are schema projections with authored values; they
replace the placeholder dialect pair for mapping publication. Placeholder
sources remain explicit engine-regression inputs in the baseline and mutation
inventory. No agreement count is converted to an accuracy percentage.

The mutation matrix operates on mapped synthetic events. Repeat, reverse order,
exact duplicate, equivalent UTC timestamp spelling and late arrival preserve
the canonical result hash, including the rule evaluation where present. Source
identity conflict, event-ID conflict and mixed sequence presence must raise their
specific canonicalization errors. A rejection yields no result hash. These are
engine probes; their generated values and retained fixture coordinates do not
create source evidence. Trace completeness is measured only over baseline
findings: every reference must resolve through canonical `eventId` and
`rawRowHash` to a parsed row of the hash-verified committed artifact. The summary
retains each distinct event's hash and source coordinate for inspection.

Published sources enter only through the admitted
[published-data registry](../packages/published-data/src/real-market-data.ts)
and its adjacent provenance and acquisition records. The runner reads committed
bytes offline and performs baseline normalization only. It does not collect new
sources, grant reuse permission, alter actual market values, synthesize actors,
or evaluate a real-instrument hypothesis. Fixture approvals are generated test
inputs and do not satisfy the human approval requirements for case evidence.

For a reviewed change to a target, edit the case definition or shared scenario
expectation deliberately and review a newly captured versioned summary alongside
it; routine evaluation never updates targets. Summary v1 is introduced here,
so there is no earlier evaluation format to migrate. See
[ADR 0053](adr/0053-publish-fixture-evaluations-with-separate-run-receipts.md).

## Measurements still planned

Model accuracy on independent mappings, configured-provider comparisons,
real-market generalization, investigation effort, latency, memory use and
evidence-grade shares remain separate measurements. The current counts imply
none of them. Rules, inputs, provider configuration, sample definitions and
limitations must accompany any future publication.

## Foundation checks

The current unit suite tests these engineering invariants only:

```bash
pnpm test
```

- **Published quote derivation and normalization** — reproduce the complete
  response-derived JSONL and generated rows, pin daily foundation/dataset hashes,
  preserve them on repeat/shuffle/derived duplicate, and reject an explicitly
  untrusted actor request before case approval or evaluation. The committed
  sample is the first 40 FSC KOSPI quotations of 943 for 2026-09-03. It has no
  expected rule outcome and is not a detection benchmark. Exact source, licence,
  hashes and limitations are recorded in the
  [source README](../packages/published-data/src/sources/real/README.md).
- **Row-order invariance** — all permutations of the committed four-event foundation
  fixture preserve canonical order and the result hash. Representative
  permutations of parsed source rows also pass the approved HTTP boundary for
  both dialects and all three rule cases; rule evaluations and source traces
  remain unchanged. Source-file bytes and coordinates are fixed in these checks.
- **Literal golden hash** — a committed fixture is pinned to its literal
  canonical result hash.
- **Exact duplicate tolerance** — identical source-identity duplicates collapse
  without changing canonical events.
- **Identity-conflict rejection** — conflicting reuse of an event or source
  identity fails independent of input order.
- **Time-format equivalence** — equivalent offset and `Z` timestamps normalize
  to the same instant, including across a UTC date boundary.
- **Sub-millisecond order** — supported precision preserves ordering and finer
  than nanosecond timestamps are rejected.
- **Locale-independent order** — canonical keys use UTF-16 code-unit ordering
  without locale data.
- **Volatile-metadata exclusion** — collection metadata is classified and
  excluded from the canonical result hash.
- **Mixed-sequence policy** — mixed sequence presence fails closed and the
  all-absent case orders by event ID.
- **Dialect convergence** — equivalent committed source dialects converge to
  one canonical dataset and result hash.
- **Decimal-spelling convergence** — accepted trailing-zero and signed-zero
  variants normalize before duplicate classification and hashing while their
  verbatim source rows retain distinct raw-row hashes.
- **Dataset-profile determinism** — profiles remain identical across event
  shuffling and committed source dialects.
- **Mapping-approval binding** — approval is bound to the validated proposal
  and its executed transforms.
- **Record-set completeness** — omitted declared rows or approved columns fail
  before result hashing.
- **Shared approval serialization** — browser approval and replay validation
  use the same canonical bytes, including the RFC 8785 finite-number rule, and
  browser hashing failures leave replay blocked.
- **Mapping agreement reporting** — the engine reports per-field agreement
  between mapped canonical events and each mapping application's review
  outcome.
- **Reachable mapping review** — dialect B presents its `source_note` for
  review; replay fails without a matching justified override and succeeds with
  one, while dialect A remains fully resolvable.
- **Scenario classification** — the complete-evidence case satisfies every
  declared gate and is pinned to `SUPPORTED`; the broad-participation case has
  enough evidence to evaluate but fails concentration gates and is pinned to
  `NOT_SUPPORTED`; the missing-side case withholds all four in-window trades as
  non-comparable and is pinned to `INCONCLUSIVE` with
  `INSUFFICIENT_ELIGIBLE_EVENTS`. The same suite pins their semantic result
  hashes, declared orders, duplicate tolerance, finding references, and
  dataset-hash independence.
- **Committed conflict review** — a published-schema synthetic FIX source
  reuses one `ExecID(17)` with different `TransactTime(60)` and `LastPx(31)`
  values. It is pinned to `INPUT_REVIEW_REQUIRED` with
  `CONFLICTING_SOURCE_IDENTITY`; no rule result or canonical result hash is
  produced.

The scenario-classification sample is three authored synthetic fixtures, with
the separate conflicting-input fixture pinning a pre-replay review path. Run
`pnpm test -- packages/replay-engine/src/rapid-price-lift-golden.test.ts packages/replay-engine/src/published-execution-schema.test.ts`
on
Node 22.18.0, pnpm 10.33.2, Vitest 4.1.11, Linux WSL2 x86_64. These outcomes
verify only the declared cases and illustrative per-case thresholds; they do
not estimate performance on independent or real-market data.

These checks do not measure schema-mapping accuracy, anomaly-detection quality,
real-market generalization, user productivity, or large-scale performance.

The published quote checks run offline with Node 22.18.0, pnpm 10.33.2,
Vitest 4.1.11 and Linux WSL2 x86_64:

```bash
pnpm exec vitest run packages/replay-engine/src/real-market-data.test.ts apps/web/src/app/api/replay/real-market-data-route.test.ts
```

Malformed dates, parser edge cases and daily-kind rule eligibility use wholly
synthetic specimens. Actual source values are never altered to construct those
tests. The rejected actor case exists only as an untrusted negative request;
it is not a source fact, registered scenario or published hypothesis.

## Publication gate

A number may appear in the main README only after its evaluation case and raw
or machine-readable summary are committed, the command is reproducible, and
the limitations are linked next to the number.
