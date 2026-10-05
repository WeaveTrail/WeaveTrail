# ADR 0053: Publish fixture evaluations with separate run receipts

> Historical decision: source-dependent portions are superseded by
> [ADR 0056](0056-withdraw-the-committed-real-data-tier.md). The original
> account below describes the withdrawn tier. Generic contracts, synthetic
> behavior and provenance safeguards remain applicable.

## Status

Partially superseded by ADR 0056 for the committed real-data tier.
The following status is historical:

Accepted.

## Context

The repository has committed scenario expectations, synthetic source dialects,
licensed artifacts and deterministic engine tests. An aggregate must not turn
these authored cases into accuracy estimates, silently refresh an oracle, or
mix a configured-provider run into a deterministic publication. Actual runtime
and checkout metadata also vary even when the evaluation result is identical.

## Decision

`packages/evals` owns versioned case definitions and a captured JSON summary.
`pnpm eval` uses the existing Vitest runtime to execute a fixture-only runner;
no additional third-party runtime dependency is needed. Workspace dependencies
connect the runner to the actual provider, contracts, sources and engine.

The runner checks the independently authored mapping and mutation oracles and
reads the existing public scenario expectations directly. It parses hash-checked
committed source bytes, executes approved mapping and case boundaries with
explicitly labeled test approvals, and resolves baseline findings to source
coordinates and raw-row hashes. Assertions, rather than updatable snapshots,
protect the aggregate. The ordinary unit suite also verifies this publication.

The stable `summary.json` contains versions, provider identity, command,
case-level results, counts and limitations. A separate `run.json` receipt
records actual environment, commit, dirty-tree state, input-tree checksum and
summary checksum. The committed capture includes both. A dirty capture is
identified as such; its input fingerprint binds the evaluated bytes without
inventing a future commit hash or creating a self-referential receipt hash.
Receipt metadata is not an input to deterministic equality.

Only the FIX and H0STCNT0 schema-grounded synthetic dialects contribute mapping
agreement counts. Synthetic baselines alone enter the canonical mutation matrix.
Admitted real artifacts enter baseline normalization with no mutated values,
actors or rule verdicts. Generated evaluation approvals do not authorize a
real-instrument case or establish publication permission.

## Consequences

Readers can reproduce and inspect counts without credentials or network access.
A changed expectation fails evaluation and requires an explicit reviewed update
to the case definition and captured summary. `-u` cannot refresh these targets.

Two files are needed to inspect both the stable results and their actual run
context. These regression counts do not measure provider accuracy, market
performance, causal effects, investigation effort or evidence-grade shares.
