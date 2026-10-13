# ADR 0080: Build a DEV-only ordered-token mapping reference

- Status: Accepted for offline development reference; experiment pre-registration and new-corpus comparison integration remain planned.
- Date: 2026-10-13
- Supersedes: none. ADR 0069's `NO_MODEL` decision stands.

## Context

The next mapping comparison needs a stronger non-model reference beside the
existing exact-name dictionary. Numeric values alone cannot distinguish a price
from a quantity, and a timestamp alone cannot establish event versus receipt
time. Unordered keyword matching can also discard modifiers that change a
header's meaning, including units and annotation labels.

## Decision

Implement `strong-baseline/1` in the evaluation package. Author its whole-name
aliases and five finite, ordered two-token rules from committed
`schema-dialects/4` DEV only. Every token alternative has an unambiguous DEV
witness at the same position for the same target and transform. Record those
witnesses, the original-byte DEV seal, configuration hash and code hashes.

Whole-name normalization lowercases Unicode letters and removes the allowed
ASCII separators. It does not fold Unicode compatibility characters or decode
instructions. Token matching splits ASCII camel case and separators, preserves
order and consumes the entire header. Additional words, unsupported units and
instruction-bearing punctuation therefore cannot be discarded to obtain a match.

Union all name and rule answers before inspecting samples. Conflicting answers,
known ambiguous DEV names, incompatible samples and competing columns abstain.
There is no precedence rule that makes an exact match override a conflicting
token rule, and no sample-based tie breaker. Sample checks can disqualify an
answer, but cannot establish its meaning.

Emit the existing mapping proposal and column-ID run-record contracts, and use
`mapping-validator/3` for the same full structural and dry-run checks as model
output. A `VALID` record can still contain fields requiring human review; it is
neither an approval nor a routing adoption. Both references remain unselectable.
The historical comparison publisher rejects B1 as a model candidate and keeps
historical captures unchanged.

## Consequences

The [development replay](../EVALUATION.md#stronger-non-model-development-reference)
reproduces B0/B1 records and common-scorer results without credentials, network or
held-out data. It measures development behavior only, including failures and
equal results. Whole-name aliases can memorize DEV; the closed rules offer
limited compositional coverage but cannot resolve hidden semantics or unknown
units. Identifier-like strings remain subject to the whole-proposal validator
and human review.

The configuration is committed and reproducible. An independently audited
pre-registration must still bind the exact reference implementations and inputs
before any selection or evaluation run. New corpus contracts, comparison runners
and production adoption are separate work. No model is selected or called here.
