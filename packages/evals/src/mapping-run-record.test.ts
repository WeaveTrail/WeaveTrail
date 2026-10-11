import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  MappingRunRecordSchema,
  MappingRunReceiptSchema,
} from "@weavetrail/contracts";
import { sha256Canonical } from "@weavetrail/replay-engine";

describe("mapping run hash boundary", () => {
  it("keeps nested raw provider captures out of Git", () => {
    expect(
      execFileSync(
        "git",
        ["check-ignore", ".model-runs/raw/nested/response.json"],
        { cwd: new URL("../../../", import.meta.url), encoding: "utf8" },
      ).trim(),
    ).toBe(".model-runs/raw/nested/response.json");
  });

  it("hashes the retained record independently of actual run receipts", () => {
    const record = MappingRunRecordSchema.parse({
      schemaVersion: "mapping-run/1",
      evaluationSet: {
        version: "schema-dialects/1",
        sha256: "a".repeat(64),
        split: "HELD_OUT",
      },
      dialectId: "HELD_OUT-synthetic",
      repeat: 1,
      provider: "synthetic-provider",
      requestedModel: "synthetic-model-2026-10-01",
      reportedModel: null,
      adapterVersion: "synthetic-adapter/1",
      promptVersion: "synthetic-prompt/1",
      outputSchemaVersion: "mapping-fields/1",
      validatorVersion: "synthetic-validator/1",
      temperature: "0",
      outcome: "PROVIDER_FAILED",
      validatorReasons: [],
      failureClass: "TIMEOUT",
      parsedOutput: null,
      latencyMs: 30_000,
      inputTokens: null,
      outputTokens: null,
    });
    const recordHash = sha256Canonical(record);
    const receipts = [
      ["synthetic-run-1", "2026-10-06T00:00:00Z"],
      ["synthetic-run-2", "2026-10-07T00:00:00Z"],
    ].map(([runId, startedAt]) =>
      MappingRunReceiptSchema.parse({
        schemaVersion: "mapping-run-receipt/1",
        recordHash,
        runId,
        startedAt,
      }),
    );
    expect(receipts[0]).not.toEqual(receipts[1]);
    expect(sha256Canonical(receipts[0]!)).not.toBe(
      sha256Canonical(receipts[1]!),
    );
    for (const receipt of receipts) {
      expect(receipt.recordHash).toBe(
        sha256Canonical(MappingRunRecordSchema.parse(record)),
      );
      expect(
        MappingRunRecordSchema.safeParse({ ...record, receipt }).success,
      ).toBe(false);
    }
    for (const changed of [
      { repeat: 2 },
      { promptVersion: "synthetic-prompt/2" },
      { latencyMs: 29_999 },
      { reportedModel: "synthetic-reported-model" },
    ]) {
      expect(
        sha256Canonical(
          MappingRunRecordSchema.parse({ ...record, ...changed }),
        ),
      ).not.toBe(recordHash);
    }
  });
});
