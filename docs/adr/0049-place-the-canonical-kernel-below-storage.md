# ADR 0049: Place the canonical kernel below storage

- Status: Accepted
- Date: 2026-09-28

## Context

Snapshot storage needs canonical JSON to bind immutable records to their
hashes. Importing the serializer through replay-engine kept the loaded code
small, but its workspace dependency still pointed at the decision layer.
Future storage and collection code needs the same primitives without access
to rules, thresholds, hypotheses or verdicts.

## Decision

Create `@weavetrail/canonical-kernel` as a workspace package beneath both
storage and replay-engine. Move canonical JSON serialization, SHA-256 hashing,
time normalization and ordering, and scaled-decimal arithmetic there. The
event comparator accepts structural ordering keys, without importing an event
or rule contract. Its callers still validate events and reject mixed sequence
presence before sorting.

The kernel depends on contracts only through its existing
`decimal-string-runtime` subpath. This preserves the shared decimal grammar
without loading the contracts barrel and its decision vocabulary. Storage
imports the new `contracts/service-snapshot` subpath for the same reason.
That entry exports the existing snapshot schemas and types without changing
their validation or serialization.

The root kernel entry and `canonical-hash` subpath use Node crypto. The
`canonical-json`, `canonical-order` and `scaled-decimal` subpaths remain
runtime-neutral. In particular, browser consumers of the engine's existing
`canonical-json` subpath do not acquire a Node crypto dependency.

Replay-engine retains its published root and `canonical-json` entry. Its four
former primitive modules re-export the kernel implementations, preserving
function and error-class identity. Existing importers require no migration.
New consumers that need only these primitives declare a dependency on the
kernel and use its root or runtime-specific subpaths.

Event validation, semantic projection, duplicate resolution, dataset and
result hash preimages, approvals, rules and evidence assembly remain in
replay-engine. This extraction changes no engine version, hash scope or
canonical spelling. Existing golden and evidence-hash suites run without
regenerating expectations.

## Consequences

The manifest graph now expresses the storage boundary instead of recording
an exception. `packages/service-store/src/dependency-boundary.test.ts` pins
the runtime workspace dependency closure, follows workspace source imports,
re-exports and type imports, and checks that storage can reach only snapshot
contracts and serialization primitives. It also checks that the complete
kernel entry reaches only the decimal runtime and that engine runtime code
cannot reach storage. External library internals are outside this source
check; their versions remain pinned in the lockfile.

Compatibility tests check shared exports and error identities, while existing
engine invariants and committed golden hashes establish unchanged behavior.
A separate package adds one workspace manifest and lockfile importer; it
adds no third-party dependency. A replay-engine subpath alone would leave the
original manifest dependency pointing at decisions and would not establish
this boundary.
