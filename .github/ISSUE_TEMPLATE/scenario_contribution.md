---
name: Synthetic scenario
about: Propose a versioned synthetic scenario or mutation.
title: "Scenario: "
labels: enhancement
assignees: ""
---

## Summary

- Describe the technical pattern or delivery fault and why it matters.

## Expected result

- Expected result: `SUPPORTED` / `NOT_SUPPORTED` / `INCONCLUSIVE`
- Explain why the synthetic ground truth supports that expectation.

## Traceability

- [ ] Every event has a synthetic source identity and `rawRowHash`.
- [ ] No real person, venue, customer, order, trade, or production schema is included.
- [ ] Mutations preserve or deliberately violate a documented invariant.

## Validation

- Describe the golden or property test that should demonstrate the scenario.
