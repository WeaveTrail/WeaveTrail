# Service snapshot operations

`@weavetrail/service-store` is the second provenance tier, for collected public
documents and data responses. The committed verification tier stays in
`packages/published-data` and `packages/scenarios` with its existing admission
checks, goldens and hashes
([ADR 0046](adr/0046-retain-public-sources-in-two-provenance-tiers.md)).

## Storage and collection

```text
new SnapshotStore(path)        Node ≥ 22.13 · existing directory on a persistent local disk
                               explicit absolute SQLite filename
                               initializes the version-1 database on first use
                               rejects unsupported database versions
no default store               imports · web requests · builds · manual acquisition scripts
                               never start collection      (.service-store/ is Git-ignored)

collectPublicSource(store, source, fetchResponse?)
  PublicSource   exact HTTPS origin URL · publisher · collector version · licence evidence
  licence        label · termsUrl · checkedAt (UTC) · attributionRequirements · attribution
                 · permitsStorage · permitsModification · permitsRedistribution (explicit true)
  refused        secrets or a fragment delimiter in the URL, including a trailing "#"
                 · a model proposal or an arbitrary browser URL as a source
                 · a review time later than collection
  stored URL     WHATWG canonical serialization Fetch resolves, so equivalent scheme, host,
                 default-port and whitespace spellings share one source identity

built-in transport   unauthenticated public endpoints only
  omits credentials · refuses redirects and non-success/partial responses · 30 s timeout
  reads arrayBuffer() before storing the original entity bytes
  preserves binary documents, invalid UTF-8, whitespace, line endings
  entity bytes = the Fetch response body, never headers, TLS traffic or wire framing
  retrievedAt recorded after the body arrives · transport errors use a fixed message
```

- An operator must review the actual terms; the licence assertions are not
  automatic verification. There is no pasted-text input and no upload
  persistence call site.
- Reviewed authenticated collectors may call
  `storeSnapshot(bytes, { source, retrievedAt })` after enforcing their own
  credential-echo and source-admission guards. Existing verification collectors
  keep saving their original response files and receipts; their outputs are not
  imported automatically, and this tier retrieves and commits no additional real
  source.

## Identities and immutable records

| Identity     | Coverage                                                                      | Resolution                                                                            |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `sha256`     | Exact original entity bytes                                                   | Verified when reading a snapshot                                                      |
| `snapshotId` | Canonical `ServiceSnapshot` 1.0 metadata, including byte hash and predecessor | `getSnapshot(snapshotId)` returns metadata and verified bytes                         |
| `resultId`   | Canonical `ServiceDerivedResult` 1.0 envelope                                 | `resolveDerivedResult(resultId)` returns the result and every verified original input |

```text
same URL, changed bytes    → new snapshot, previousSnapshotId → the one before it
same URL, unchanged bytes  → the original reference, unchanged first retrievedAt,
                             collector version and licence record; not a durable record
                             of a new permission review
A → B → A                  → the third record links back to B, A's blob deduplicated
different origin URLs      → independent histories

no replace, no delete      SQLite triggers reject updates, deletes and replacement inserts
one transaction            snapshot bytes + metadata; result + its input bindings
every read                 Zod contract validation + hash recalculation
fail closed                missing snapshot · hash mismatch · invalid record · corruption
                           resolution never falls back to the current source
```

Snapshot metadata is `schemaVersion`, `source`, UTC `retrievedAt`, `sha256` and
nullable `previousSnapshotId`; all hashes are lowercase hexadecimal SHA-256.
Call `close()` when finished.

## Derived results

```text
storeDerivedResult(record)   every service event, conclusion or check
  schemaVersion "1.0" · kind "event" | "conclusion" | "check"
  computationVersion  nonempty, identifies the reviewed implementation
  inputs              nonempty, unique, each { snapshotId, sha256 }
  value               JSON, already validated by the application

getSnapshot bytes ──compute──► value ──store──► resultId
  identical envelope              → the same resultId
  changed version | input | output → a different resultId
  input order                      preserved
  a later collection               cannot retarget an old result: readers use the
                                   retained resultId, never an origin's current head
```

- Domain contracts and approvals are enforced by the application before
  insertion. Persist every input dependency, including separately collected
  supporting documents: the store cannot infer an omitted input or judge what a
  computation-version label means. Financial decimals stay strings, and no
  function executes generated code or treats a model's text as an approved
  result.
- Inputs are checked before insertion and again on resolution.
- The envelope is separate from canonical replay and Evidence Bundle 1.3. It
  changes neither contract nor hash, establishes no approval, signs nothing and
  authenticates no publisher. Retrieval timestamps affect snapshot identity, not
  engine result hashes.
- Public event pages and share-link HTTP routes over these IDs are not
  implemented.

## Migration and deployment

```text
additive               SourceProvenance · committed artifact records · replay responses
                       · bundles need no migration or regeneration
new installs           Node ≥ 22.13, so storage tests load node:sqlite without a flag
new producers          store admitted inputs first, then use the envelope
user_version = 1       names the storage layout; a later version needs an explicit
                       migration, never silent replacement
workflow histories     remain request-local
dependencies           existing contracts + canonical JSON + Node's built-in SQLite;
                       no third-party database dependency
current deployment     mounts no store and performs no runtime collection
```

For an actual collector: provision a persistent local volume with restricted
filesystem access and backups, outside Git and public asset directories; use a
consistent SQLite backup, or stop all writers and close connections before
copying; retain result IDs outside the database where independent integrity
comparison is required.

```text
not implemented   streaming ingestion · multi-host database · retention deletion
                  · backup automation · publisher authenticity · production-scale benchmark
known limits      full responses are buffered, SQLite calls are synchronous
                  an operator who can replace the database or drop triggers can tamper:
                  hash verification detects mismatches against retained IDs, not an
                  independently replaced set of records
errors            a full disk or the five-second lock timeout is an error; never fall back
                  to temporary or request-local storage after a persistence error
```

## Reproducible verification

```bash
pnpm exec vitest run packages/service-store/src/snapshot-store.test.ts
```

Synthetic on-disk storage and transport tests cover byte preservation and
re-hashing after reopening, single-byte and metadata corruption, unchanged and
changed recollection, A → B → A lineage, cross-origin blob deduplication,
separate connections, atomic rollback, immutable tables, result-version and
input bindings, and transport and admission failures. No live publisher or
credential is used. `pnpm test` also runs the committed-artifact and golden
suites without updating their snapshots.
