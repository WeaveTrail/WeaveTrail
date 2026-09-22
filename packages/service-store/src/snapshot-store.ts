import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  ServiceDerivedResultSchema,
  ServiceSnapshotSchema,
  SnapshotHashSchema,
  type ServiceDerivedResult,
  type ServiceSnapshot,
  type SnapshotReference,
} from "@weavetrail/contracts";
import { canonicalJson } from "@weavetrail/replay-engine/canonical-json";

const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

export type StoredSnapshot = SnapshotReference & {
  record: ServiceSnapshot;
  bytes: Uint8Array;
};

/** Server-only, explicit durable path; no connection or writes on import. */
export class SnapshotStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (!isAbsolute(path))
      throw new Error("An absolute persistent database path is required");
    this.db = new DatabaseSync(path);
    try {
      this.db.exec(
        "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL;",
      );
      this.transaction(() => {
        const version = this.db
          .prepare("PRAGMA user_version")
          .get()?.user_version;
        if (version !== 0 && version !== 1)
          throw new Error("Unsupported snapshot database version");
        if (version === 1) return;
        this.db.exec(`
          CREATE TABLE blobs (
            sha256 TEXT PRIMARY KEY,
            bytes BLOB NOT NULL
          ) STRICT;
          CREATE TABLE snapshots (
            snapshot_id TEXT PRIMARY KEY,
            origin_url TEXT NOT NULL,
            sha256 TEXT NOT NULL REFERENCES blobs(sha256),
            previous_snapshot_id TEXT REFERENCES snapshots(snapshot_id),
            record_json TEXT NOT NULL
          ) STRICT;
          CREATE INDEX snapshots_origin ON snapshots(origin_url);
          CREATE TABLE results (
            result_id TEXT PRIMARY KEY,
            record_json TEXT NOT NULL
          ) STRICT;
          CREATE TABLE result_inputs (
            result_id TEXT NOT NULL REFERENCES results(result_id),
            snapshot_id TEXT NOT NULL REFERENCES snapshots(snapshot_id),
            PRIMARY KEY (result_id, snapshot_id)
          ) STRICT;
          PRAGMA user_version = 1;
        `);
        for (const [table, identity] of [
          ["blobs", ["sha256"]],
          ["snapshots", ["snapshot_id"]],
          ["results", ["result_id"]],
          ["result_inputs", ["result_id", "snapshot_id"]],
        ] as const) {
          for (const operation of ["UPDATE", "DELETE"]) {
            this.db.exec(`CREATE TRIGGER ${table}_no_${operation.toLowerCase()}
              BEFORE ${operation} ON ${table}
              BEGIN SELECT RAISE(ABORT, 'Stored evidence is immutable'); END;`);
          }
          // SQLite REPLACE can bypass DELETE triggers when recursive triggers
          // are disabled on another connection. Refuse it before deletion.
          const match = identity
            .map((column) => `${column} = NEW.${column}`)
            .join(" AND ");
          this.db.exec(`CREATE TRIGGER ${table}_no_replace
            BEFORE INSERT ON ${table}
            WHEN EXISTS (SELECT 1 FROM ${table} WHERE ${match})
            BEGIN SELECT RAISE(ABORT, 'Stored evidence is immutable'); END;`);
        }
      });
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }

  private transaction<T>(run: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = run();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  /** Trusted collectors supply admitted original entity bytes, never pasted user text. */
  storeSnapshot(
    bytes: Uint8Array,
    metadata: Pick<ServiceSnapshot, "source" | "retrievedAt">,
  ): SnapshotReference {
    const retained = Buffer.from(bytes);
    const hash = sha256(retained);
    const candidate = ServiceSnapshotSchema.parse({
      schemaVersion: "1.0",
      ...metadata,
      sha256: hash,
      previousSnapshotId: null,
    });
    return this.transaction(() => {
      const latest = this.db
        .prepare(
          "SELECT snapshot_id FROM snapshots WHERE origin_url = ? ORDER BY rowid DESC LIMIT 1",
        )
        .get(candidate.source.originUrl);
      const previous = latest
        ? this.getSnapshot(String(latest.snapshot_id))
        : undefined;
      // Recollection preserves the first retrieval and its admission metadata.
      if (previous?.sha256 === hash)
        return { snapshotId: previous.snapshotId, sha256: hash };
      const record: ServiceSnapshot = {
        ...candidate,
        previousSnapshotId: previous?.snapshotId ?? null,
      };
      const json = canonicalJson(record);
      const snapshotId = sha256(json);
      const blob = this.db
        .prepare("SELECT bytes FROM blobs WHERE sha256 = ?")
        .get(hash);
      if (blob) {
        if (
          !(blob.bytes instanceof Uint8Array) ||
          !retained.equals(blob.bytes)
        ) {
          throw new Error("Stored source bytes failed SHA-256 verification");
        }
      } else {
        this.db
          .prepare("INSERT INTO blobs (sha256, bytes) VALUES (?, ?)")
          .run(hash, retained);
      }
      this.db
        .prepare(
          `INSERT INTO snapshots
        (snapshot_id, origin_url, sha256, previous_snapshot_id, record_json)
        VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          snapshotId,
          record.source.originUrl,
          hash,
          record.previousSnapshotId,
          json,
        );
      return { snapshotId, sha256: hash };
    });
  }

  getSnapshot(snapshotId: string): StoredSnapshot {
    SnapshotHashSchema.parse(snapshotId);
    const row = this.db
      .prepare(
        `SELECT s.*, b.bytes FROM snapshots s
      JOIN blobs b ON b.sha256 = s.sha256 WHERE s.snapshot_id = ?`,
      )
      .get(snapshotId);
    if (!row) throw new Error("Snapshot not found");
    const record = ServiceSnapshotSchema.parse(
      JSON.parse(String(row.record_json)),
    );
    if (
      sha256(canonicalJson(record)) !== snapshotId ||
      row.origin_url !== record.source.originUrl ||
      row.previous_snapshot_id !== record.previousSnapshotId ||
      row.sha256 !== record.sha256 ||
      !(row.bytes instanceof Uint8Array) ||
      sha256(row.bytes) !== record.sha256
    )
      throw new Error("Stored snapshot failed SHA-256 verification");
    return {
      snapshotId,
      sha256: record.sha256,
      record,
      bytes: Uint8Array.from(row.bytes),
    };
  }

  /** Only validated application computations belong here; this does not approve a result. */
  storeDerivedResult(input: ServiceDerivedResult): string {
    const record = ServiceDerivedResultSchema.parse(input);
    const json = canonicalJson(record);
    const resultId = sha256(json);
    return this.transaction(() => {
      for (const reference of record.inputs) {
        if (
          this.getSnapshot(reference.snapshotId).sha256 !== reference.sha256
        ) {
          throw new Error(
            "Derived result input hash does not match its snapshot",
          );
        }
      }
      const existing = this.db
        .prepare("SELECT record_json FROM results WHERE result_id = ?")
        .get(resultId);
      if (existing) {
        if (existing.record_json !== json)
          throw new Error("Stored result failed SHA-256 verification");
        return resultId;
      }
      this.db
        .prepare("INSERT INTO results (result_id, record_json) VALUES (?, ?)")
        .run(resultId, json);
      for (const reference of record.inputs) {
        this.db
          .prepare(
            "INSERT INTO result_inputs (result_id, snapshot_id) VALUES (?, ?)",
          )
          .run(resultId, reference.snapshotId);
      }
      return resultId;
    });
  }

  resolveDerivedResult(resultId: string): {
    record: ServiceDerivedResult;
    snapshots: StoredSnapshot[];
  } {
    SnapshotHashSchema.parse(resultId);
    const row = this.db
      .prepare("SELECT record_json FROM results WHERE result_id = ?")
      .get(resultId);
    if (!row) throw new Error("Derived result not found");
    const record = ServiceDerivedResultSchema.parse(
      JSON.parse(String(row.record_json)),
    );
    if (sha256(canonicalJson(record)) !== resultId)
      throw new Error("Stored result failed SHA-256 verification");
    const snapshots = record.inputs.map((reference) => {
      const snapshot = this.getSnapshot(reference.snapshotId);
      if (snapshot.sha256 !== reference.sha256)
        throw new Error(
          "Derived result input hash does not match its snapshot",
        );
      return snapshot;
    });
    return { record, snapshots };
  }
}
