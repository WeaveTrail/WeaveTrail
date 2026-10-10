import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sha256Canonical } from "@weavetrail/replay-engine";
import { evaluateDevGate, loadDevGateCorpus, runDevGate } from "./dev-gate";
import { RETRY_SELECTION_MODELS } from "./mapping-selection";
import { dialectMappingInput } from "./schema-dialects-v2";

// Exercise orchestration without a clean checkout or a real provider.
vi.mock("node:child_process", async () => {
  const fs = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    execFileSync: (_cmd: string, args: string[]) => {
      if (args[0] === "diff") return Buffer.from("");
      if (args[0] === "rev-parse") return "synthetic-test-commit\n";
      return fs.readFileSync(args[1]!.slice("HEAD:".length));
    },
  };
});

const directories: string[] = [];
afterEach(() => {
  for (const d of directories.splice(0))
    rmSync(d, { recursive: true, force: true });
});
const models = RETRY_SELECTION_MODELS.map((model) => ({
  provider: "google",
  model,
  apiKey: "synthetic-test-key",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
}));
const { corpus } = loadDevGateCorpus();
const byHash = new Map(
  corpus.dialects.map((d) => [dialectMappingInput(d).sourceArtifactHash, d]),
);

type Behaviour = (
  model: string,
  form: "header" | "id",
  gold: (typeof corpus.dialects)[number]["gold"][number],
  field: Record<string, unknown>,
) => void;
/** Authored synthetic responses from gold; `edit` injects a failure mode. */
function transport(edit: Behaviour = () => {}) {
  return vi.fn<typeof fetch>(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const data = JSON.parse(body.messages[1].content);
    const dialect = byHash.get(data.sourceArtifactHash)!;
    const form = typeof data.columns[0] === "string" ? "header" : "id";
    const headers: string[] =
      form === "header"
        ? data.columns
        : data.columns.map((c: { header: string }) => c.header);
    const fields = headers.map((header, index) => {
      const g = dialect.gold.find((g) => g.sourceColumn === header)!;
      const field: Record<string, unknown> = {
        ...(form === "header"
          ? { sourceColumn: header }
          : { columnId: data.columns[index].id }),
        targetField: g.targetField,
        transform: g.transform,
        confidence: g.status === "PROPOSED" ? 1 : 0,
        evidence: "Authored synthetic response, not model output.",
        status: g.status,
      };
      edit(body.model, form, g, field);
      return field;
    });
    return Response.json({
      model: body.model,
      usage: { prompt_tokens: 10, completion_tokens: 10 },
      choices: [
        {
          finish_reason: "stop",
          message: { role: "assistant", content: JSON.stringify({ fields }) },
        },
      ],
    });
  });
}
async function run(edit?: Behaviour) {
  const output = mkdtempSync(join(tmpdir(), "dev-gate-test-"));
  directories.push(output);
  const provider = transport(edit);
  const dirs = await runDevGate(models, output, provider);
  expect(provider).toHaveBeenCalledTimes(2 * 4 * 12 * 3);
  return dirs;
}

describe("ADR 0075 gate 2 on v4 DEV", () => {
  it("rejects HELD_OUT, an undeclared candidate list and a fifth candidate before transport", async () => {
    const provider = vi.fn<typeof fetch>();
    await expect(
      runDevGate(models.slice(1), "/tmp/unused", provider),
    ).rejects.toThrow("four");
    await expect(
      runDevGate(
        [...models.slice(1), { ...models[0]!, model: "gemini-2.5-pro" }],
        "/tmp/unused",
        provider,
      ),
    ).rejects.toThrow("four");
    expect(provider).not.toHaveBeenCalled();
    expect(corpus).toMatchObject({
      version: "schema-dialects/4",
      split: "DEV",
    });
  });

  it("writes two receipted sessions without gold or secrets and passes when nothing rises", async () => {
    const dirs = await run();
    for (const directory of Object.values(dirs)) {
      const records = JSON.parse(
        readFileSync(join(directory, "records.json"), "utf8"),
      );
      expect(records).toHaveLength(144);
      for (const file of readdirSync(directory)) {
        const bytes = readFileSync(join(directory, file), "utf8");
        expect(bytes).not.toContain("synthetic-test-key");
        expect(bytes).not.toContain('"rationale"');
      }
    }
    const before = JSON.parse(
      readFileSync(join(dirs.before, "records.json"), "utf8"),
    );
    const after = JSON.parse(
      readFileSync(join(dirs.after, "records.json"), "utf8"),
    );
    expect(before[0]).toMatchObject({
      schemaVersion: "mapping-run/1",
      promptVersion: "schema-mapping/1",
    });
    expect(after[0]).toMatchObject({
      schemaVersion: "mapping-run/2",
      promptVersion: "schema-mapping/3",
    });
    const gate = evaluateDevGate(dirs.before, dirs.after);
    expect(gate.passed).toBe(true);
    for (const c of gate.candidates) {
      expect(c.pairs).toHaveLength(36);
      expect(c).toMatchObject({ noIncrease: true, opensHeldOut: true });
    }
    expect(() => evaluateDevGate(dirs.after, dirs.before)).toThrow("compares");
  });

  it("fails when any candidate's count rises under the after stack, even if another opens HELD_OUT", async () => {
    const dirs = await run((model, form, g, field) => {
      if (
        model === "gemini-3.8-flash" &&
        form === "id" &&
        g.tags[0] === "AMBIGUOUS"
      )
        Object.assign(field, { status: "PROPOSED", confidence: 1 });
    });
    const gate = evaluateDevGate(dirs.before, dirs.after);
    const flash = gate.candidates.find((c) => c.model === "gemini-3.8-flash")!;
    expect(flash.paired.after.unflaggedNoTarget.numerator).toBe(
      String(12 * 3 * 2),
    );
    expect(flash.paired.before.unflaggedNoTarget.numerator).toBe("0");
    expect(flash.noIncrease).toBe(false);
    expect(gate.candidates.some((c) => c.opensHeldOut)).toBe(true);
    expect(gate.passed).toBe(false);
  });

  it("does not let retained but rejected output open HELD_OUT", async () => {
    // Every candidate maps the annotation attack's target under both stacks,
    // which the validator rejects as a duplicate actor target.
    const dirs = await run((_model, _form, g, field) => {
      if (g.injectedTarget === "actorId")
        Object.assign(field, {
          targetField: "actorId",
          transform: "IDENTITY",
          status: "PROPOSED",
          confidence: 1,
        });
    });
    const gate = evaluateDevGate(dirs.before, dirs.after);
    for (const c of gate.candidates) {
      expect(c.after.retainedAll).toBe(true);
      expect(c.after.validOutput.numerator).toBe("0");
      expect(c.after.injectionFollowed.numerator).not.toBe("0");
      expect(c.noIncrease).toBe(true);
      expect(c.opensHeldOut).toBe(false);
    }
    expect(gate.passed).toBe(false);
  });

  it("rejects a re-receipted tampered projection, a changed record and an unreceipted file", async () => {
    const dirs = await run();
    const directory = dirs.after;
    const records = JSON.parse(
      readFileSync(join(directory, "records.json"), "utf8"),
    );
    expect(() => evaluateDevGate(dirs.before, directory)).not.toThrow();
    writeFileSync(
      join(directory, "records.json"),
      JSON.stringify([...records.slice(1), { ...records[0], repeat: 9 }]),
    );
    expect(() => evaluateDevGate(dirs.before, directory)).toThrow("receipted");
    // Rewrite one record, its receipt and records.json consistently: only the
    // offline projection check can catch a header that is not the ID's.
    const receiptName = readdirSync(directory).find((f) =>
      f.endsWith(".receipt.json"),
    )!;
    const receipt = JSON.parse(
      readFileSync(join(directory, receiptName), "utf8"),
    );
    const recordName = `${receipt.runId}.json`;
    const record = JSON.parse(
      readFileSync(join(directory, recordName), "utf8"),
    );
    const original = sha256Canonical(record);
    record.parsedOutput.fields[0].sourceColumn = "invented header";
    writeFileSync(join(directory, recordName), JSON.stringify(record));
    writeFileSync(
      join(directory, receiptName),
      JSON.stringify({ ...receipt, recordHash: sha256Canonical(record) }),
    );
    writeFileSync(
      join(directory, "records.json"),
      JSON.stringify(
        records.map((r: unknown) =>
          sha256Canonical(r as never) === original ? record : r,
        ),
      ),
    );
    expect(() => evaluateDevGate(dirs.before, directory)).toThrow("projection");
    writeFileSync(join(directory, "extra.json"), "{}");
    expect(() => evaluateDevGate(dirs.before, directory)).toThrow(
      "Unreceipted",
    );
  });
});
