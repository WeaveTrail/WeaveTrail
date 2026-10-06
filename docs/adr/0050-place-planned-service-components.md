# ADR 0050: Place planned service components

> Historical decision: source-dependent portions are superseded by
> [ADR 0056](0056-withdraw-the-committed-real-data-tier.md). The original
> account below describes the withdrawn tier. Generic contracts, synthetic
> behavior and provenance safeguards remain applicable.
>
> The service components it places are no longer planned. The placement matrix
> it adopted is no longer in the architecture document; the link below pins the
> last revision that carried it.

- Status: Partially superseded by ADR 0056 (committed sources and composition)
- Date: 2026-09-28

## Context

The current dependency graph separates contracts, canonical primitives,
interpretation, storage, decisions and application composition. It names the
responsibilities of planned service components without assigning their package
homes. Independent implementation choices could make collection depend on a
rule, parsing depend on the web app, or a calculation open a store.

[ADR 0049](0049-place-the-canonical-kernel-below-storage.md) gives storage and
decisions a common lower-tier primitive package. Component placement must
preserve that direction, including type imports and transitive dependencies.

## Decision

Adopt the component-to-package matrix and import allowlists in
[planned service component placement](https://github.com/WeaveTrail/WeaveTrail/blob/b943b91e9077b7b010ac85e81eff126aa5e754dd/docs/ARCHITECTURE.md#planned-service-component-placement).
The Korean architecture document carries the same record. These are accepted
placements for planned work, not newly implemented packages or APIs.

- Add `packages/collectors` at tier 3 for the shared collection lifecycle and
  the FSC, FSS and SEC adapters. It uses the existing tier 2 `service-store`
  snapshot API; it owns no database insertion or decision implementation.
  Source-specific transport, retries and collection health stay above storage.
- Add `packages/document-parser` and `packages/instrument-resolver` at tier 2.
  They accept resolved bytes or listing rows and their provenance as arguments,
  and use only contracts and canonical primitives. Parsing coordinates and
  date-aware resolution are reusable input preparation, independent of both
  the model provider and the web framework.
- Extend `packages/ai-harness` at tier 2 with event structuring and claim
  extraction modules, including deterministic validation of proposed quoted
  spans. Fixture and configured providers keep the existing proposal boundary;
  accepting a proposal's shape or span is not human approval or final grading.
- Extend `packages/replay-engine` at tier 2 with conclusion definitions, feed
  statistics and claim checking. They share the engine's exact calculations,
  versioned definitions and evidence machinery through internal modules.
  Descriptive statistics do not authorize a pattern hypothesis. Definitions,
  coverage, resolved inputs and required approvals come from the caller.
- Keep brief/PDF rendering, share-fragment handling, scheduling and server
  composition in `apps/web`. Reserve tier 4 for this application so importing
  the tier 3 collectors remains a downward edge. The existing graph retains
  its current web tier until that edge is implemented; tiers 0–2 and `evals`
  at tier 3 need no change.

Shared versioned schemas belong to tier 0 contracts. Server composition
resolves and re-hashes snapshot inputs, then passes data between the tier 2
components; none imports a peer. It validates domain results before asking
storage to bind them to immutable inputs. Collection and storage use narrow
contract entries that cannot reach decision vocabulary. Browser presentation
cannot import server storage, collectors or configured-provider credentials.

The initial brief/share work uses pinned committed artifacts and a URL
fragment with no server storage of pasted text. Sharing service snapshots is
separate planned work; this placement adds neither persistence nor a public
collection endpoint.

New packages require declared workspace dependencies, published `exports`
entry points, no imports into another package's internals, strictly downward
edges, and typechecking and boundary tests before admission. A public entry
point means an exported workspace API, not registry publication. The
architecture's admission checklist applies to development dependencies,
re-exports and type imports as well as runtime imports. Existing boundary
tests cover storage and the kernel; extending enforcement to new packages is
part of their implementation, not a check claimed by this document change.

## Alternatives

- Putting collectors inside `service-store` would mix publisher-specific
  retries and lifecycle policy with immutable persistence. The existing generic
  public transport helper remains useful without giving storage that ownership.
- Putting parsers and name resolution inside `apps/web` would tie reusable
  input preparation to presentation. Putting them in `ai-harness` would make
  deterministic parsing and lookup depend on provider ownership.
- Giving conclusions, statistics and checks separate packages would create
  peer edges or force additional tiers just to share definitions. Existing
  engine modules can share code without duplicating calculations or introducing
  another decision authority.

## Consequences

Each planned issue has a package home and a bounded import set before coding
starts. Three new packages are planned; existing packages gain modules where
their responsibility already fits. The application carries explicit data
handoffs and server/client boundaries instead of allowing lower layers to
discover their inputs.

No workspace package, dependency, contract, runtime behavior, engine version
or golden hash changes in this decision. Package admission will update the
manifest graph, dependency figure and applicable boundary checks when the
implementation exists. A future need for a different home or dependency must
revise this record and the bilingual matrix together.
