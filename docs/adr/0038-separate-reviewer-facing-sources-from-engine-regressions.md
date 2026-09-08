# ADR 0038: Separate reviewer-facing sources from engine regressions

## Status

Accepted. Verified by catalog, reviewer-list, result-coverage, and existing
engine golden tests.

## Context

The committed source registry originally served two different purposes. It
held stable placeholder fixtures that pin normalization and rule behavior, and
it supplied the source picker shown to a reviewer. Once synthetic executions
shaped by published FIX 4.4 and H0STCNT0 schemas existed, showing the older
repository-shaped dialects to a reviewer obscured which examples have an
external schema basis. Removing those fixtures would also discard their value
as fixed regression inputs and would require rewriting golden expectations.

A grounded case currently produces `SUPPORTED`. The only committed cases that
produce `NOT_SUPPORTED` and `INCONCLUSIVE` are still placeholders. Removing all
placeholders from the picker would therefore make two declared result meanings
unreachable from the review surface.

Licensed published artifacts have a different constraint: a browser control
may reorder their committed rows, but it may not add an invented value,
participant, or pattern verdict.

## Decision

Keep `committedReplayScenarios` and the combined server registry complete and
unchanged as engine and contract inputs. Add an adjacent catalog that declares,
for every source:

- whether its purpose is `REVIEWER_FACING` or `ENGINE_REGRESSION`;
- whether it is temporarily available in Case Replay; and
- the exact input mutations the surface offers.

Published-schema projections and licensed published artifacts are
reviewer-facing. Other synthetic fixtures exist to pin engine behavior. An
engine regression fixture may remain in the Case Replay list only while its
declared result meaning has no grounded replacement. Consequently the
`SUPPORTED` placeholder is no longer listed, while the `NOT_SUPPORTED` and
`INCONCLUSIVE` placeholders remain as explicit fallbacks.

The web loader reads only the reviewer-facing selection. The replay API and
fixture mapping provider continue to resolve the complete committed registry,
so regression and contract suites retain access to every placeholder.

Synthetic examples offer `baseline`, `shuffle`, and `duplicate`. Licensed
published artifacts offer `baseline` and `shuffle`; they have no case manifest
or expected result in this surface, so no offered control attaches a
participant or verdict.

The expectations publication continues to list every committed source because
it is also the public record of pinned engine behavior. Each entry states its
purpose, Case Replay availability, and offered mutations.

## Consequences

The human review path now starts with the published-schema FIX case and uses
the actorless H0STCNT0 projection as its separate mapping-review example. The
older source dialects and the replaced `SUPPORTED` fixture remain available to
engine, provider, API, and contract tests without changing their bytes,
manifests, or hashes.

Adding a grounded `NOT_SUPPORTED` or `INCONCLUSIVE` case requires removing the
matching placeholder from the Case Replay selection. Tests fail if a declared
result meaning becomes unreachable or if a placeholder remains after a
grounded replacement exists.
