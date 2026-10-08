import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import {
  MappingRunReceiptSchema,
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
        m.provider !== "google" ||
        m.baseUrl !==
          "https://generativelanguage.googleapis.com/v1beta/openai" ||
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
          MappingRunReceiptSchema.parse({
            schemaVersion: "mapping-run-receipt/1",
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
