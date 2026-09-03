# Evaluation Protocol

WeaveTrail has no published accuracy or performance result yet. This page
defines the measurements that future results must follow so a target cannot be
presented as an achieved number.

## Versioned evaluation units

Each result must record:

- dataset and mutation-set version;
- contract, rule, prompt, model, and engine versions where applicable;
- exact command and commit SHA;
- runtime environment;
- sample count and aggregation method; and
- known limitations and abstentions.

## Planned measurements

| Area                  | Definition                                                                         |
| --------------------- | ---------------------------------------------------------------------------------- |
| Mapping accuracy      | Field-level agreement with a committed gold mapping                                |
| Ambiguity handling    | Incorrect auto-approval rate and `REVIEW_REQUIRED` rate                            |
| Replay determinism    | Canonical-hash agreement for repeated identical inputs                             |
| Mutation tolerance    | Result agreement after shuffle, duplicate, time-format, and late-arrival mutations |
| Scenario result       | Agreement with synthetic expected outcomes                                         |
| Evidence completeness | Findings whose event references resolve to source-row hashes                       |
| Investigation effort  | Completion time under a documented comparison protocol                             |
| Performance           | Runtime and peak memory by event count                                             |

## Foundation checks

The current unit suite tests these engineering invariants only:

```bash
pnpm test
```

- **Row-order invariance** — shuffling does not change canonical order or the
  result hash, including across every committed fixture permutation.
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
- **Scenario classification** — the supported, broad-participation, and
  insufficient-evidence synthetic scenarios are pinned to `SUPPORTED`,
  `NOT_SUPPORTED`, and `INCONCLUSIVE` respectively. The same suite pins their
  semantic result hashes, declared orders, duplicate tolerance, finding
  references, and dataset-hash independence.

The scenario-classification sample is three authored synthetic fixtures. Run
`pnpm test -- packages/replay-engine/src/rapid-price-lift-golden.test.ts` on
Node 22.18.0, pnpm 10.33.2, Vitest 4.1.11, Linux WSL2 x86_64. These outcomes
verify only the declared cases and illustrative per-case thresholds; they do
not estimate performance on independent or real-market data.

These checks do not measure schema-mapping accuracy, anomaly-detection quality,
real-market generalization, user productivity, or large-scale performance.

## Publication gate

A number may appear in the main README only after its evaluation case and raw
or machine-readable summary are committed, the command is reproducible, and
the limitations are linked next to the number.
