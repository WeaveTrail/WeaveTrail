import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PublicSourceSchema,
  type PublicSource,
  type ServiceDerivedResult,
} from "@weavetrail/contracts";
import { collectPublicSource, SnapshotStore } from "./index";

const source: PublicSource = {
  originUrl: "https://publisher.example/document?edition=1",
  publisher: "Synthetic test publisher",
  licence: {
    label: "Synthetic permission fixture; not real licence evidence",
    termsUrl: "https://publisher.example/terms",
    checkedAt: "2026-09-13T00:00:00Z",
    attributionRequirements: "Credit the synthetic test publisher",
    attribution: "Synthetic test publisher",
    permitsStorage: true,
    permitsModification: true,
    permitsRedistribution: true,
  },
  collectorVersion: "synthetic-document/1.0",
};
const metadata = { source, retrievedAt: "2026-09-13T01:00:00Z" };
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

describe("durable public source snapshots", () => {
  let directory: string;
  let path: string;
  let store: SnapshotStore;
  const connections: { close(): void }[] = [];

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "weavetrail-snapshots-"));
    path = join(directory, "sources.sqlite");
    store = new SnapshotStore(path);
    connections.push(store);
  });

  afterEach(async () => {
    for (const connection of connections.splice(0).reverse())
      connection.close();
    await rm(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function inspect() {
    const db = new DatabaseSync(path);
    connections.push(db);
    return db;
  }

  it("retains arbitrary original bytes and all provenance across a fresh connection", () => {
    const bytes = Uint8Array.from([0, 255, 254, 13, 10, 32, 123, 125]);
    const reference = store.storeSnapshot(bytes, metadata);
    bytes[0] = 42;
    store.close();
    connections.pop();
    store = new SnapshotStore(path);
    connections.push(store);
    const retained = store.getSnapshot(reference.snapshotId);
    expect(retained.bytes).toEqual(
      Uint8Array.from([0, 255, 254, 13, 10, 32, 123, 125]),
    );
    expect(hash(retained.bytes)).toBe(reference.sha256);
    expect(retained.record).toEqual({
      schemaVersion: "1.0",
      ...metadata,
      sha256: reference.sha256,
      previousSnapshotId: null,
    });
    retained.bytes[0] = 99;
    expect(store.getSnapshot(reference.snapshotId).bytes[0]).toBe(0);
  });

  it("deduplicates unchanged recollections and links changes, including a return to old bytes", () => {
    const first = store.storeSnapshot(Buffer.from("first\r\n"), metadata);
    const unchanged = store.storeSnapshot(Buffer.from("first\r\n"), {
      source: { ...source, collectorVersion: "synthetic-document/2.0" },
      retrievedAt: "2026-09-13T02:00:00Z",
    });
    expect(unchanged).toEqual(first);
    expect(store.getSnapshot(first.snapshotId).record.retrievedAt).toBe(
      metadata.retrievedAt,
    );
    const changed = store.storeSnapshot(Buffer.from("first\n"), metadata);
    expect(changed.sha256).not.toBe(first.sha256);
    expect(
      store.getSnapshot(changed.snapshotId).record.previousSnapshotId,
    ).toBe(first.snapshotId);
    const restored = store.storeSnapshot(Buffer.from("first\r\n"), metadata);
    expect(restored.sha256).toBe(first.sha256);
    expect(restored.snapshotId).not.toBe(first.snapshotId);
    expect(
      store.getSnapshot(restored.snapshotId).record.previousSnapshotId,
    ).toBe(changed.snapshotId);
    const db = inspect();
    expect(db.prepare("SELECT COUNT(*) AS count FROM blobs").get()?.count).toBe(
      2,
    );
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM snapshots").get()?.count,
    ).toBe(3);
  });

  it("deduplicates bytes across origins while preserving each publisher's provenance", () => {
    const first = store.storeSnapshot(Buffer.from("same"), metadata);
    const second = store.storeSnapshot(Buffer.from("same"), {
      ...metadata,
      source: {
        ...source,
        originUrl: "https://other.example/document",
        publisher: "Other synthetic publisher",
      },
    });
    expect(first.sha256).toBe(second.sha256);
    expect(first.snapshotId).not.toBe(second.snapshotId);
    expect(
      store.getSnapshot(second.snapshotId).record.previousSnapshotId,
    ).toBeNull();
    expect(
      inspect().prepare("SELECT COUNT(*) AS count FROM blobs").get()?.count,
    ).toBe(1);
  });

  it("serializes recollections made through separate store connections", async () => {
    const other = new SnapshotStore(path);
    connections.push(other);
    const fetchResponse = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response("same"));
    const references = await Promise.all([
      collectPublicSource(store, source, fetchResponse),
      collectPublicSource(other, source, fetchResponse),
    ]);
    expect(references[0]).toEqual(references[1]);
    expect(
      inspect().prepare("SELECT COUNT(*) AS count FROM snapshots").get()?.count,
    ).toBe(1);
  });

  it.each(["event", "conclusion", "check"] as const)(
    "pins a %s to all original inputs and computation version after recollection",
    (kind) => {
      const original = store.storeSnapshot(Buffer.from("original"), metadata);
      const other = store.storeSnapshot(Buffer.from("other"), {
        ...metadata,
        source: { ...source, originUrl: "https://other.example/data" },
      });
      const result: ServiceDerivedResult = {
        schemaVersion: "1.0",
        kind,
        computationVersion: "synthetic-check/1.0",
        inputs: [original, other],
        value: { observation: "illustrative synthetic output", amount: "1.20" },
      };
      const resultId = store.storeDerivedResult(result);
      expect(store.storeDerivedResult(result)).toBe(resultId);
      store.storeSnapshot(Buffer.from("new document"), metadata);
      const reader = new SnapshotStore(path);
      connections.push(reader);
      const resolved = reader.resolveDerivedResult(resultId);
      expect(resolved.record).toEqual(result);
      expect(
        resolved.snapshots.map((snapshot) =>
          Buffer.from(snapshot.bytes).toString(),
        ),
      ).toEqual(["original", "other"]);
      expect(
        store.storeDerivedResult({
          ...result,
          computationVersion: "synthetic-check/2.0",
        }),
      ).not.toBe(resultId);
      expect(
        store.storeDerivedResult({ ...result, value: { amount: "2.40" } }),
      ).not.toBe(resultId);
    },
  );

  it("refuses incomplete, missing, duplicate or mismatched result bindings before storing anything", () => {
    const reference = store.storeSnapshot(Buffer.from("original"), metadata);
    const result: ServiceDerivedResult = {
      schemaVersion: "1.0",
      kind: "check",
      computationVersion: "synthetic-check/1.0",
      inputs: [reference],
      value: null,
    };
    for (const inputs of [
      [],
      [reference, reference],
      [{ ...reference, sha256: "0".repeat(64) }],
      [{ ...reference, snapshotId: "0".repeat(64) }],
    ]) {
      expect(() => store.storeDerivedResult({ ...result, inputs })).toThrow();
    }
    expect(() =>
      store.storeDerivedResult({ ...result, computationVersion: " " }),
    ).toThrow();
    expect(
      inspect().prepare("SELECT COUNT(*) AS count FROM results").get()?.count,
    ).toBe(0);
  });

  it("blocks updates, deletes and replacement inserts for every evidence table", () => {
    const db = inspect();
    const reference = store.storeSnapshot(Buffer.from("original"), metadata);
    store.storeDerivedResult({
      schemaVersion: "1.0",
      kind: "event",
      computationVersion: "synthetic/1",
      inputs: [reference],
      value: {},
    });
    for (const [table, column] of [
      ["blobs", "bytes"],
      ["snapshots", "record_json"],
      ["results", "record_json"],
      ["result_inputs", "snapshot_id"],
    ]) {
      expect(() => db.exec(`DELETE FROM ${table}`)).toThrow("immutable");
      expect(() =>
        db.exec(`UPDATE ${table} SET ${column} = ${column}`),
      ).toThrow("immutable");
      expect(() =>
        db.exec(`INSERT OR REPLACE INTO ${table} SELECT * FROM ${table}`),
      ).toThrow("immutable");
    }
  });

  it("rolls back blob insertion when snapshot storage fails", () => {
    const db = inspect();
    db.exec(
      "CREATE TRIGGER fail_snapshot BEFORE INSERT ON snapshots BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END",
    );
    expect(() =>
      store.storeSnapshot(Buffer.from("original"), metadata),
    ).toThrow("simulated disk failure");
    expect(db.prepare("SELECT COUNT(*) AS count FROM blobs").get()?.count).toBe(
      0,
    );
    db.exec("DROP TRIGGER fail_snapshot");
    expect(
      store.getSnapshot(
        store.storeSnapshot(Buffer.from("original"), metadata).snapshotId,
      ).record.previousSnapshotId,
    ).toBeNull();
  });

  it("detects a changed stored byte on snapshot read, recollection and result resolution", () => {
    const reference = store.storeSnapshot(Buffer.from("original"), metadata);
    const resultId = store.storeDerivedResult({
      schemaVersion: "1.0",
      kind: "check",
      computationVersion: "synthetic/1",
      inputs: [reference],
      value: {},
    });
    const db = inspect();
    // Simulate disk/operator corruption outside the append-only API.
    db.exec("DROP TRIGGER blobs_no_update");
    db.prepare("UPDATE blobs SET bytes = ? WHERE sha256 = ?").run(
      Buffer.from("Original"),
      reference.sha256,
    );
    expect(() => store.getSnapshot(reference.snapshotId)).toThrow("SHA-256");
    expect(() =>
      store.storeSnapshot(Buffer.from("original"), metadata),
    ).toThrow("SHA-256");
    expect(() => store.resolveDerivedResult(resultId)).toThrow("SHA-256");
  });

  it("detects changed provenance and computation records", () => {
    const reference = store.storeSnapshot(Buffer.from("original"), metadata);
    const result: ServiceDerivedResult = {
      schemaVersion: "1.0",
      kind: "check",
      computationVersion: "synthetic/1",
      inputs: [reference],
      value: {},
    };
    const resultId = store.storeDerivedResult(result);
    const db = inspect();
    db.exec("DROP TRIGGER results_no_update");
    db.prepare("UPDATE results SET record_json = ?").run(
      JSON.stringify({ ...result, computationVersion: "tampered" }),
    );
    expect(() => store.resolveDerivedResult(resultId)).toThrow("SHA-256");
    const snapshot = store.getSnapshot(reference.snapshotId);
    db.exec("DROP TRIGGER snapshots_no_update");
    db.prepare("UPDATE snapshots SET record_json = ?").run(
      JSON.stringify({
        ...snapshot.record,
        retrievedAt: "2026-09-13T03:00:00Z",
      }),
    );
    expect(() => store.getSnapshot(reference.snapshotId)).toThrow("SHA-256");
  });

  it("collects original binary entity bytes without JSON or text conversion", async () => {
    const bytes = Uint8Array.from([0, 255, 13, 10]);
    const fetchResponse = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(bytes));
    const reference = await collectPublicSource(store, source, fetchResponse);
    expect(fetchResponse).toHaveBeenCalledWith(source.originUrl, {
      signal: expect.any(AbortSignal),
      redirect: "error",
      credentials: "omit",
    });
    expect(store.getSnapshot(reference.snapshotId).bytes).toEqual(bytes);
    expect(store.getSnapshot(reference.snapshotId).record.source).toEqual(
      source,
    );
  });

  it.each([206, 304, 404, 500])(
    "does not admit HTTP %s responses",
    async (status) => {
      const fetchResponse = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status }));
      await expect(
        collectPublicSource(store, source, fetchResponse),
      ).rejects.toThrow("transport boundary");
      expect(
        inspect().prepare("SELECT COUNT(*) AS count FROM snapshots").get()
          ?.count,
      ).toBe(0);
    },
  );

  it("validates permission and provenance before any network request", async () => {
    const fetchResponse = vi.fn<typeof fetch>();
    for (const invalid of [
      { ...source, originUrl: "not a URL" },
      { ...source, publisher: " " },
      { ...source, originUrl: "https://user:password@publisher.example/" },
      { ...source, originUrl: "http://publisher.example/" },
      { ...source, pastedText: "do not retain" },
      { ...source, licence: { ...source.licence, permitsStorage: false } },
      { ...source, licence: { ...source.licence, termsUrl: "not a URL" } },
    ]) {
      expect(PublicSourceSchema.safeParse(invalid).success).toBe(false);
      await expect(
        collectPublicSource(store, invalid as PublicSource, fetchResponse),
      ).rejects.toThrow();
    }
    expect(fetchResponse).not.toHaveBeenCalled();
  });

  it("does not expose transport errors or store failed bodies and redirects", async () => {
    const redirected = new Response("body");
    Object.defineProperty(redirected, "redirected", { value: true });
    const broken = new Response("body");
    vi.spyOn(broken, "arrayBuffer").mockRejectedValue(
      new Error("sensitive transport detail"),
    );
    for (const response of [redirected, broken]) {
      const fetchResponse = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(
        collectPublicSource(store, source, fetchResponse),
      ).rejects.toThrow(
        /^Public source collection failed at the transport boundary$/,
      );
    }
    const fetchResponse = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("sensitive transport detail"));
    await expect(
      collectPublicSource(store, source, fetchResponse),
    ).rejects.toThrow(
      /^Public source collection failed at the transport boundary$/,
    );
    expect(
      inspect().prepare("SELECT COUNT(*) AS count FROM snapshots").get()?.count,
    ).toBe(0);
  });
});
