# Service snapshot operations

The `@weavetrail/service-store` package implements a second provenance tier for
collected public documents and data responses. The committed verification tier
remains in `packages/published-data` and `packages/scenarios`, with its existing
admission checks, goldens and hashes. The two-tier decision is recorded in
[ADR 0046](adr/0046-retain-public-sources-in-two-provenance-tiers.md).

## Storage and collection

Use Node 22.13 or newer (`node:sqlite` can emit an experimental warning), an
existing directory on a persistent local disk, and an explicit absolute SQLite
filename. `new SnapshotStore(path)` initializes the version-1 database on first
use. It rejects unsupported database versions. No default store is opened;
imports, web requests, builds and existing manual acquisition scripts do not
start collection. A local `.service-store/` directory is ignored by Git.

`collectPublicSource(store, source, fetchResponse?)` accepts a validated
`PublicSource` record: exact HTTPS origin URL, publisher, collector version and
licence evidence. The licence fields are `label`, `termsUrl`, UTC `checkedAt`,
`attributionRequirements`, `attribution`, and explicit `true` values for
`permitsStorage`, `permitsModification` and `permitsRedistribution`. An operator
must review the actual terms; these assertions are not automatic licence
verification. Neither a model proposal nor an arbitrary browser URL is an
admitted source. URLs and public query parameters must contain no secrets.

The built-in transport is for unauthenticated public endpoints. It omits
credentials, refuses redirects and non-success/partial HTTP responses, applies
a 30-second timeout, and reads `arrayBuffer()` before storing the original
entity bytes. It preserves binary documents, invalid UTF-8, whitespace and line
endings. Entity bytes are the response body exposed by Fetch, not HTTP headers,
TLS traffic or compressed wire framing. The retrieval timestamp is recorded
after the body is received. Transport errors are replaced with a fixed message.
There is no pasted-text input or upload persistence call site.

Reviewed authenticated collectors can call
`storeSnapshot(bytes, { source, retrievedAt })` after enforcing their own
credential-echo and source-admission guards. Existing verification collectors
continue to save their original response files and receipts. Their reviewed
outputs are not automatically imported, and this change does not retrieve or
commit any additional real source.

## Identities and immutable records

| Identity     | Coverage                                                                      | Resolution                                                                            |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `sha256`     | Exact original entity bytes                                                   | Verified when reading a snapshot                                                      |
| `snapshotId` | Canonical `ServiceSnapshot` 1.0 metadata, including byte hash and predecessor | `getSnapshot(snapshotId)` returns metadata and verified bytes                         |
| `resultId`   | Canonical `ServiceDerivedResult` 1.0 envelope                                 | `resolveDerivedResult(resultId)` returns the result and every verified original input |

All hashes are lowercase hexadecimal SHA-256. Snapshot metadata includes
`schemaVersion`, `source`, UTC `retrievedAt`, `sha256` and nullable
`previousSnapshotId`. A changed source at the same exact URL creates a new
record linked to its predecessor. Unchanged consecutive recollections return
the original reference without changing its first retrieval time, collector
version or licence record. A new collection after A → B → A links back to B,
while deduplicating A's blob. Different origin URLs keep independent histories.
An unchanged recollection is not a durable record of a new permission review.

The store has no replace/delete API. SQLite triggers reject updates, deletes
and replacement inserts for existing records. Transactions commit each snapshot's bytes and
metadata together, and each result together with its input bindings. Reads
validate Zod contracts and recalculate hashes. Missing snapshots, mismatched
hashes, invalid records and corruption fail closed; resolution never fetches
the latest source as a fallback. Call `close()` when finished.

## Derived results

Use `storeDerivedResult(record)` for every service event, conclusion or check.
The strict envelope requires:

- `schemaVersion: "1.0"` and `kind: "event" | "conclusion" | "check"`;
- a nonempty `computationVersion` identifying the reviewed implementation;
- nonempty, unique `inputs`, each containing both `snapshotId` and `sha256`;
- a JSON `value` containing the application-validated result.

Compute from `getSnapshot` bytes and retain those returned references. Domain
contracts and approvals must be enforced by the application before inserting
the result. Persist all input dependencies, including separately collected
supporting documents; the store cannot infer omitted inputs or validate the
meaning of an arbitrary computation-version label. Financial decimals in
application results remain strings. No function executes generated code or
interprets a model's text as an approved result.

The store checks every referenced input before insertion and on resolution.
Identical envelopes reuse their result ID. Changing the computation version,
input reference or output changes that ID. Input order is preserved. A later
collection cannot retarget an old result: a reader uses the retained result ID,
never an origin's current head. Public event pages and share-link HTTP routes
using these IDs are not yet implemented.

The envelope is separate from canonical replay and Evidence Bundle 1.3. It
does not change their contracts or hashes, establish a new approval, sign a
result, or authenticate its publisher. Retrieval timestamps affect snapshot
identity, not deterministic engine result hashes.

## Migration and deployment

These contracts are additive. Existing `SourceProvenance`, committed artifact
records, replay responses and bundles need no migration or regeneration. New
workspace installs require Node 22.13 or newer so the storage tests can load
`node:sqlite` without an experimental CLI flag. New
service producers must store admitted inputs before producing records and use
the new envelope. SQLite `user_version = 1` names the storage layout; later
versions need an explicit migration, never silent replacement. Request-local
workflow transition histories remain request-local.

The package uses the existing contracts and canonical JSON implementation via
workspace dependencies and Node's built-in SQLite; no third-party database
dependency is added. The current fixture deployment does not mount this store
or perform runtime collection. For an actual collector, provision a persistent
local volume with restricted filesystem access and backups, outside Git and
public asset directories. Use a consistent SQLite backup, or stop all writers
and close connections before copying the database. Retain result IDs outside
the database when independent integrity comparison is required.

The implementation buffers full responses and uses synchronous SQLite calls.
There is no streaming ingestion, multi-host database, retention deletion,
backup automation, publisher authenticity check or production-scale benchmark.
An operator able to replace the database or drop triggers can tamper with it;
hash verification detects mismatches to retained IDs, not an independently
replaced set of records. A full disk or five-second lock timeout is an error.
Never fall back to temporary or request-local storage after a persistence error.

## Reproducible verification

Run the synthetic on-disk storage/transport tests with:

```bash
pnpm exec vitest run packages/service-store/src/snapshot-store.test.ts
```

They cover byte preservation and re-hashing after reopening, single-byte and
metadata corruption, unchanged and changed recollection, A → B → A lineage,
cross-origin blob deduplication, separate connections, atomic rollback,
immutable tables, result-version/input bindings and transport/admission
failures. No live publisher or credentials are used. `pnpm test` also runs the
existing committed-artifact and golden suites without updating their snapshots.
