# ADR 0046: Retain public sources in two provenance tiers

- Status: Accepted
- Date: 2026-09-13
- Partially supersedes [ADR 0014](0014-keep-replay-workflows-request-local.md)
  where collected source inputs and derived results require persistence.

## Context

A collected public document can change at its origin URL. Request-local
metadata cannot let a later reader recover the bytes behind a derived event,
conclusion or check. Committing every service collection would make repository
history the service database, while abandoning committed fixtures would remove
the offline verification path.

## Decision

Keep two provenance tiers. Committed artifacts remain the verification tier
for source admission, goldens and regressions. The service tier retains admitted
public HTTP entity bytes and their provenance outside Git. Both record the
publisher, origin, retrieval time, reuse terms, attribution and original-byte
SHA-256. Service records additionally require a collector version; existing
committed acquisition records and their pinned bytes keep their current shape.

Use SQLite through Node's built-in `node:sqlite` in the server-only
`@weavetrail/service-store` package. This requires Node 22.13 or newer and an
explicit absolute database path on a persistent local volume. No new external
dependency is needed: the package reuses the workspace Zod contracts and replay
engine's canonical JSON serializer. The database stores blobs, snapshot records,
derived-result records and foreign-key input bindings in one transaction domain.
The package does not open a database on import.

SQLite transactions with `BEGIN IMMEDIATE`, a five-second busy timeout and
`synchronous=FULL` serialize writers and commit bytes and metadata together.
Tables have update/delete/replacement rejection triggers; the application exposes only
insertion and verified resolution. This protects the supported write path, not
against an administrator replacing the database or removing its triggers.

Raw-byte SHA-256 identifies a blob. Each canonical snapshot record has its own
SHA-256 `snapshotId`, including its provenance and predecessor. Origin identity
is the canonical WHATWG serialization of a credential-free, fragment-free
HTTPS URL, including public selection parameters. This is the address Fetch
resolves, so parser-normalized whitespace, scheme or host case, default ports
and equivalent URL spellings cannot create separate histories. Empty fragment
delimiters are rejected instead of being normalized away. A snapshot's recorded
permission review must be no later than its retrieval time.
Unchanged consecutive recollections return the existing reference and retain
the first retrieval's metadata. Changed bytes append a record pointing to the
previous snapshot at that origin. Returning from A to B to A reuses A's blob but
creates a new record linked to B. Equal bytes from different publishers share
one blob while retaining distinct provenance records. This is snapshot history,
not a log of every fetch attempt or later permission review.

Each derived service record is a versioned envelope with a kind (`event`,
`conclusion`, `check`), computation version, nonempty unique snapshot references,
their byte hashes, and the application result. Insertion resolves and verifies
every reference before committing. The envelope's SHA-256 is its stable
`resultId`; resolution re-hashes the envelope, snapshot metadata and original
bytes without fetching a remote URL. The envelope is storage provenance, not a
substitute for the corresponding domain contract, mapping/case approval, or
evidence bundle. Trusted application code must validate those before storing a
derived record. Neither collection nor storage runs model output or decides a
pattern result.

Snapshot and storage-envelope hashes are separate from existing canonical
event, dataset, result and evidence-bundle hashes. Retrieval times belong to
snapshot provenance and do not enter deterministic engine hashes. Existing
replay HTTP workflow histories remain request-local under ADR 0014; the new
store does not resume them or persist pasted user text.

The collection entry point is for operator-selected, admitted, unauthenticated
public sources. It validates recorded permission before transport, refuses
redirects, partial and failed responses, and stores entity bytes without text or
JSON reserialization. It is not a browser-facing arbitrary-URL fetch endpoint.
Authenticated collectors require their own reviewed credential boundary before
using the lower-level storage API.

## Alternatives

- Git alone remains suitable for a small reviewed verification inventory, but
  service collection should not require a code commit for each changed source.
- Immutable files plus a separate lineage index require a cross-file commit
  protocol to keep blobs, predecessors and derived references consistent.
- Object storage plus a database can support multiple service hosts and larger
  artifacts. There is no such deployment configured here; introducing it now
  would add external credentials and coordination without a running consumer.

## Consequences

The package and collection/resolution APIs are implemented and exercised with
synthetic responses and temporary on-disk databases. Public event/share routes,
a scheduled collector, multi-host storage, backup automation and production
deployment of this tier are not implemented. The current web app still reads
committed inputs. Existing manual verification-tier acquisition scripts retain
their existing outputs and do not implicitly populate a service database.

SQLite operations and whole-response hashing are synchronous/in-memory. A busy
or full store fails the collection; there is no ephemeral fallback. Operators
must provision a durable local volume and backups before running collection.
An ephemeral serverless filesystem is not an acceptable persistent service
store. SHA-256 detects changes relative to a retained reference; it is neither
publisher authentication nor a signature against database replacement.

See [service snapshot operations](../SERVICE_SNAPSHOTS.md) for contracts,
migration, resolution and reproducible checks.
