import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import {
  MappingRunReceiptSchema,
  MappingRunRecordSchema,
  type MappingRunRecord,
} from "@weavetrail/contracts";
import { sha256Canonical } from "@weavetrail/replay-engine";
import { CorpusSchema, MappingPriceTableSchema } from "./mapping-scorer";
import { SELECTION_MODELS } from "./mapping-selection";
import { dialectMappingInput } from "./schema-dialects-v2";
import {
  runConfiguredMapping,
  type EvaluationModel,
} from "./mapping-model-runner";
import protocol from "../fixtures/mapping-selection-v1/protocol.json";

export const root = resolve(import.meta.dirname, "../../..");
export const HELD_OUT_ENDPOINT = {
  provider: "google",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
} as const;
/** A run receipt that also names its enclosing held-out session. */
const HeldOutReceiptSchema = MappingRunReceiptSchema.extend({
  schemaVersion: z.literal("mapping-held-out-receipt/1"),
  sessionId: z.uuid(),
}).strict();
export function loadSelectionInputs(requireCommitted = false) {
  for (const [path, expected] of Object.entries(protocol.files)) {
    const bytes = readFileSync(resolve(root, path));
    if (createHash("sha256").update(bytes).digest("hex") !== expected)
      throw new Error("Pre-run file seal mismatch");
    if (
      requireCommitted &&
      !execFileSync("git", ["show", `HEAD:${path}`], { cwd: root }).equals(
        bytes,
      )
    )
      throw new Error("Pre-run files must be committed before running");
  }
  if (requireCommitted) {
    execFileSync(
      "git",
      [
        "diff",
        "--quiet",
        "HEAD",
        "--",
        "packages",
        "scripts",
        "package.json",
        "pnpm-lock.yaml",
      ],
      { cwd: root },
    );
    const path = "packages/evals/fixtures/mapping-selection-v1/protocol.json";
    if (
      !execFileSync("git", ["show", `HEAD:${path}`], { cwd: root }).equals(
        readFileSync(resolve(root, path)),
      )
    )
      throw new Error("Protocol must be committed");
    const adr =
      "docs/adr/0067-separate-mapping-validity-from-approval-before-selection.md";
    const bytes = readFileSync(resolve(root, adr));
    if (
      !execFileSync("git", ["show", `HEAD:${adr}`], { cwd: root }).equals(
        bytes,
      ) ||
      !bytes.toString().includes("- Status: Accepted")
    )
      throw new Error("Accepted pre-run ADR must be committed");
  }
  const corpusPath = "packages/evals/fixtures/schema-dialects-v2/HELD_OUT.json";
  const source = {
    bytes: readFileSync(resolve(root, corpusPath), "utf8"),
    sha256: protocol.files[corpusPath],
  };
  const corpus = CorpusSchema.parse(JSON.parse(source.bytes));
  const seal = readFileSync(
    resolve(root, "packages/evals/fixtures/schema-dialects-v2/HELD_OUT.sha256"),
    "utf8",
  );
  if (seal !== `${source.sha256}  HELD_OUT.json\n`)
    throw new Error("HELD_OUT seal mismatch");
  const prices = MappingPriceTableSchema.parse(
    JSON.parse(
      readFileSync(
        resolve(
          root,
          "packages/evals/fixtures/mapping-selection-v1/prices.json",
        ),
        "utf8",
      ),
    ),
  );
  return { source, corpus, prices };
}

const CatalogueSchema = z
  .object({
    checkedOn: z.iso.date(),
    sourceUrl: z.literal("https://ai.google.dev/gemini-api/docs/models"),
    modelIds: z.array(z.enum(SELECTION_MODELS)).length(5),
  })
  .strict();
/** Persist each attempt before continuing; interrupted grids cannot be selected. */
export async function runHeldOut(
  models: EvaluationModel[],
  catalogueInput: unknown,
  output: string,
  transport?: typeof fetch,
) {
  const { source, corpus } = loadSelectionInputs(true);
  const catalogue = CatalogueSchema.parse(catalogueInput);
  if (
    catalogue.checkedOn !== new Date().toISOString().slice(0, 10) ||
    new Set(catalogue.modelIds).size !== 5
  )
    throw new Error("Run-date catalogue attestation required");
  if (
    models.length !== 5 ||
    new Set(models.map((m) => m.model)).size !== 5 ||
    models.some(
      (m) =>
        m.provider !== HELD_OUT_ENDPOINT.provider ||
        m.baseUrl !== HELD_OUT_ENDPOINT.baseUrl ||
        !(SELECTION_MODELS as readonly string[]).includes(m.model),
    )
  )
    throw new Error("Declared single-provider grid required");
  const sessionId = randomUUID();
  const directory = resolve(output, sessionId);
  mkdirSync(directory, { recursive: true });
  const write = (name: string, value: unknown) =>
    writeFileSync(
      resolve(directory, name),
      JSON.stringify(value, null, 2) + "\n",
      { flag: "wx" },
    );
  write("session.json", {
    version: "mapping-held-out-session/1",
    sessionId,
    startedAt: new Date().toISOString(),
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    endpoint: HELD_OUT_ENDPOINT,
    catalogue,
    protocolHash: sha256Canonical(protocol),
  });
  const records: MappingRunRecord[] = [];
  for (const model of models)
    for (const dialect of corpus.dialects)
      for (const repeat of [1, 2, 3]) {
        const runId = randomUUID(),
          startedAt = new Date().toISOString();
        const record = await runConfiguredMapping(
          model,
          dialectMappingInput(dialect),
          {
            evaluationSet: {
              version: corpus.version,
              sha256: source.sha256,
              split: "HELD_OUT",
            },
            dialectId: dialect.id,
            repeat,
          },
          transport,
        );
        write(`${runId}.json`, record);
        write(
          `${runId}.receipt.json`,
          HeldOutReceiptSchema.parse({
            schemaVersion: "mapping-held-out-receipt/1",
            sessionId,
            runId,
            startedAt,
            recordHash: sha256Canonical(record),
          }),
        );
        records.push(record);
      }
  write("records.json", records);
  return directory;
}

const SessionSchema = z
  .object({
    version: z.literal("mapping-held-out-session/1"),
    sessionId: z.uuid(),
    startedAt: z.iso.datetime(),
    commit: z.string().min(1),
    environment: z
      .object({ node: z.string(), platform: z.string(), arch: z.string() })
      .strict(),
    endpoint: z
      .object({
        provider: z.literal(HELD_OUT_ENDPOINT.provider),
        baseUrl: z.literal(HELD_OUT_ENDPOINT.baseUrl),
      })
      .strict(),
    catalogue: CatalogueSchema,
    protocolHash: z.string(),
  })
  .strict();
/**
 * Read one held-out session directory: every record must match a receipt that
 * names this session, belong to this session and protocol, and equal the session's records.json.
 */
export function loadHeldOutSession(directory: string) {
  const read = (name: string): unknown =>
    JSON.parse(readFileSync(resolve(directory, name), "utf8"));
  const session = SessionSchema.parse(read("session.json"));
  if (session.protocolHash !== sha256Canonical(protocol))
    throw new Error("Session was run under another protocol");
  const names = readdirSync(directory);
  const receipts = names.filter((n) => n.endsWith(".receipt.json"));
  const expected = new Set([
    "session.json",
    "records.json",
    ...receipts,
    ...receipts.map((n) => n.replace(".receipt.json", ".json")),
  ]);
  if (names.some((n) => !expected.has(n)))
    throw new Error("Unreceipted file in session");
  const records = receipts.map((name) => {
    const receipt = HeldOutReceiptSchema.parse(read(name));
    if (name !== `${receipt.runId}.receipt.json`)
      throw new Error("Receipt name mismatch");
    if (receipt.sessionId !== session.sessionId)
      throw new Error("Receipt belongs to another session");
    const record = MappingRunRecordSchema.parse(read(`${receipt.runId}.json`));
    if (sha256Canonical(record) !== receipt.recordHash)
      throw new Error("Record does not match its receipt");
    return record;
  });
  const sorted = (rs: MappingRunRecord[]) =>
    rs.map((r) => sha256Canonical(r)).sort();
  if (
    sorted(
      z.array(MappingRunRecordSchema).parse(read("records.json")),
    ).join() !== sorted(records).join()
  )
    throw new Error("records.json differs from the receipted attempts");
  return {
    records,
    session: {
      sessionId: session.sessionId,
      sessionHash: sha256Canonical(session),
    },
  };
}
