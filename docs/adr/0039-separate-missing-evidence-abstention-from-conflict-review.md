# ADR 0039: Separate missing-evidence abstention from conflict review

## Status

Accepted. Verified by source-artifact, rule golden, normalization, API, catalog,
and generated-expectation tests.

## Context

The declared `INCONCLUSIVE` rapid-price-lift fixture previously contained four
complete, non-conflicting trades. It reached abstention only because removing
the approved actor group left too few trades for the sensitivity comparison.
Missing rule evidence and conflicting source identity were covered only by
constructed unit inputs, so neither condition was reproducible from a committed
source artifact.

Those conditions belong to different authority boundaries. A trade with no
side can still be normalized without inventing a value, but the participant
rule cannot classify it and must withhold it from every metric. Reusing one
source execution identity for different canonical facts is ambiguous before
rule evaluation and must stop in input review. Treating both as
`INCONCLUSIVE` would hide a source conflict inside a rule result.

## Decision

Replace the third declared rule source with a synthetic FIX 4.4 projection that
omits `Side(54)` from the artifact and its approved mapping. Its four in-window
trades normalize with no inferred side. `RAPID_PRICE_LIFT` 1.1 therefore counts
all four as non-comparable and returns `INCONCLUSIVE` with
`INSUFFICIENT_ELIGIBLE_EVENTS`, empty findings, and null sensitivity.

Add a separate synthetic FIX 4.4 projection in which `ExecID(17)` `120001`
appears twice with different `TransactTime(60)` and `LastPx(31)` values. The
mapping remains valid, but canonicalization returns
`CONFLICTING_SOURCE_IDENTITY`. The workflow stops at
`INPUT_REVIEW_REQUIRED`, before a manifest or rule result, and produces no
canonical result hash.

Each scenario stores its expected outcome and a sentence describing the
condition it demonstrates. The generated expectations publication records
those conditions, the missing-evidence abstention reason and non-comparable
count, and the conflict review code and absent hash.

## Consequences

- The existing supported and not-supported artifacts, manifests, dataset
  hashes, and literal result hashes do not change.
- The missing-evidence source, dataset, manifest approval, and result hashes are
  newly pinned because its committed bytes and semantics change.
- The missing-evidence case is grounded in a published schema and replaces the
  temporary `INCONCLUSIVE` fallback in the Case Replay list. The
  `NOT_SUPPORTED` fallback remains.
- Missing evidence remains an `INCONCLUSIVE` rule outcome only after valid
  normalization and case approval. Conflicting identity remains a pre-replay
  `REVIEW_REQUIRED` outcome and cannot be presented as one of the three rule
  results.

## Migration

Strict replay clients must accept
`published-execution-fix44-conflicting-evidence.csv` as an additional
`ReplayScenario` literal. No existing literal is removed. Consumers that pin
the bytes or expected hashes of `rapid-price-lift-insufficient-evidence.csv`
must update that fixture's source, dataset, manifest-approval, and result hashes;
the supported and not-supported literals and hashes remain unchanged.
