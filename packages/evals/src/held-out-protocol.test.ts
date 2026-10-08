import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { sha256Canonical } from "@weavetrail/replay-engine";
import { SELECTION_MODELS } from "./mapping-selection";
import { loadHeldOutSession, runHeldOut } from "./held-out-protocol";
import { requireLiveMappingCommand } from "./mapping-model-runner";

// Test the write/network orchestration without a pre-run commit or real provider.
vi.mock("node:child_process", () => ({
  execFileSync: (_cmd: string, args: string[]) => {
    if (args[0] === "diff") return Buffer.from("");
    if (args[0] === "rev-parse") return "synthetic-test-commit\n";
    if (args[1]!.endsWith(".md")) return Buffer.from("- Status: Accepted");
    return readFileSync(args[1]!.slice("HEAD:".length));
  },
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: (
      path: Parameters<typeof readFileSync>[0],
      ...args: unknown[]
    ) => {
      if (
        String(path).endsWith(
          "0067-separate-mapping-validity-from-approval-before-selection.md",
        )
      )
        return Buffer.from("- Status: Accepted");
      return Reflect.apply(actual.readFileSync, actual, [path, ...args]);
    },
  };
});
const directories: string[] = [];
afterEach(() => {
  for (const d of directories.splice(0))
    rmSync(d, { recursive: true, force: true });
});
const models = SELECTION_MODELS.map((model) => ({
  provider: "google",
  model,
  apiKey: "synthetic-test-key",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
}));
const catalogue = () => ({
  checkedOn: new Date().toISOString().slice(0, 10),
  sourceUrl: "https://ai.google.dev/gemini-api/docs/models",
  modelIds: [...SELECTION_MODELS],
});
it("requires explicit live invocation and disables CI", () => {
  expect(() => requireLiveMappingCommand([], {})).toThrow();
  expect(() =>
    requireLiveMappingCommand(["--live"], { CI: "false" }),
  ).toThrow();
});
it("rejects wrong catalogue or provider before transport", async () => {
  const transport = vi.fn();
  await expect(
    runHeldOut(
      models,
      { ...catalogue(), checkedOn: "2000-01-01" },
      "/tmp/unused",
      transport,
    ),
  ).rejects.toThrow();
  await expect(
    runHeldOut(models.slice(1), catalogue(), "/tmp/unused", transport),
  ).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
});
it("writes 180 attempts and hash-bound receipts, including provider failures, without gold or secrets", async () => {
  const directory = mkdtempSync(join(tmpdir(), "held-out-test-"));
  directories.push(directory);
  const transport = vi.fn<typeof fetch>(async (_url, options) => {
    const body = String(options?.body);
    expect(body).not.toContain('"gold"');
    expect(body).not.toContain('"rationale"');
    return new Response("unretained provider diagnostic", { status: 503 });
  });
  const output = await runHeldOut(models, catalogue(), directory, transport);
  expect(transport).toHaveBeenCalledTimes(180);
  const read = (name: string) =>
    JSON.parse(readFileSync(join(output, name), "utf8"));
  const records = read("records.json");
  expect(records).toHaveLength(180);
  for (const file of readdirSync(output).filter((f) =>
    f.endsWith(".receipt.json"),
  )) {
    const receipt = read(file),
      record = read(file.replace(".receipt.json", ".json"));
    expect(receipt.recordHash).toBe(sha256Canonical(record));
    expect(receipt.sessionId).toBe(read("session.json").sessionId);
    expect(record.outcome).toBe("PROVIDER_FAILED");
  }
  for (const file of readdirSync(output)) {
    const bytes = readFileSync(join(output, file), "utf8");
    expect(bytes).not.toContain("synthetic-test-key");
    expect(bytes).not.toContain("unretained provider diagnostic");
  }
});
it("loads only a receipted session whose records match their receipts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "held-out-test-"));
  directories.push(directory);
  const output = await runHeldOut(
    models,
    catalogue(),
    directory,
    vi.fn<typeof fetch>(async () => new Response("", { status: 503 })),
  );
  const session = JSON.parse(
    readFileSync(join(output, "session.json"), "utf8"),
  );
  expect(session.endpoint).toEqual({
    provider: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  });
  const loaded = loadHeldOutSession(output);
  expect(loaded.records).toHaveLength(180);
  expect(loaded.session).toEqual({
    sessionId: session.sessionId,
    sessionHash: sha256Canonical(session),
  });
  const records = JSON.parse(
    readFileSync(join(output, "records.json"), "utf8"),
  );
  writeFileSync(
    join(output, "records.json"),
    JSON.stringify([...records.slice(1), { ...records[0], repeat: 9 }]),
  );
  expect(() => loadHeldOutSession(output)).toThrow("receipted");
  writeFileSync(join(output, "records.json"), JSON.stringify(records));
  const record = readdirSync(output).find(
    (f) => f.endsWith(".json") && !f.endsWith(".receipt.json") && f.length > 40,
  )!;
  writeFileSync(
    join(output, record),
    JSON.stringify({ ...records[0], latencyMs: 1 }),
  );
  expect(() => loadHeldOutSession(output)).toThrow("receipt");
  writeFileSync(join(output, "extra.json"), "{}");
  expect(() => loadHeldOutSession(output)).toThrow("Unreceipted");
});
it("rejects an attempt receipted under another session", async () => {
  const directory = mkdtempSync(join(tmpdir(), "held-out-test-"));
  directories.push(directory);
  const output = await runHeldOut(
    models,
    catalogue(),
    directory,
    vi.fn<typeof fetch>(async () => new Response("", { status: 503 })),
  );
  const name = readdirSync(output).find((f) => f.endsWith(".receipt.json"))!;
  const receipt = JSON.parse(readFileSync(join(output, name), "utf8"));
  writeFileSync(
    join(output, name),
    JSON.stringify({ ...receipt, sessionId: randomUUID() }),
  );
  expect(() => loadHeldOutSession(output)).toThrow("another session");
});
