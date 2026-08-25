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

- row shuffling does not change canonical order or result hash;
- exact duplicate insertion does not change canonical events or result hash;
- event order is stable at equal timestamps.

These checks do not measure schema-mapping accuracy, anomaly-detection quality,
real-market generalization, user productivity, or large-scale performance.

## Publication gate

A number may appear in the main README only after its evaluation case and raw
or machine-readable summary are committed, the command is reproducible, and
the limitations are linked next to the number.
