import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import {
  MappingRunReceiptSchema,
  MappingRunRecordSchema,
  MappingRunRecordV2Schema,
  type AnyMappingRunRecord,
} from "@weavetrail/contracts";
import { sha256Canonical } from "@weavetrail/replay-engine";
import { CorpusSchema, MappingPriceTableSchema } from "./mapping-scorer";
import { RETRY_SELECTION_MODELS, SELECTION_MODELS } from "./mapping-selection";
import { dialectMappingInput } from "./schema-dialects-v2";
import {
  runConfiguredMapping,
  type EvaluationModel,
} from "./mapping-model-runner";
import protocolV1 from "../fixtures/mapping-selection-v1/protocol.json";
import protocolV2 from "../fixtures/mapping-selection-v2/protocol.json";
import protocolV3 from "../fixtures/mapping-selection-v3/protocol.json";
export type SelectionProtocol = 1 | 2 | 3;
const protocols = { 1: protocolV1, 2: protocolV2, 3: protocolV3 };
/** The pre-run ADR, sealed HELD_OUT, price table and stack of each protocol. */
const PROTOCOL_INPUTS = {
  1: {
    adr: "docs/adr/0067-separate-mapping-validity-from-approval-before-selection.md",
    corpus: "packages/evals/fixtures/schema-dialects-v2/HELD_OUT.json",
    prices: "packages/evals/fixtures/mapping-selection-v1/prices.json",
    candidates: SELECTION_MODELS as readonly string[],
    stack: "adr-0069",
  },
  2: {
    adr: "docs/adr/0069-recover-mapping-transport-with-a-fresh-held-out-set.md",
    corpus: "packages/evals/fixtures/schema-dialects-v3/HELD_OUT.json",
    prices: "packages/evals/fixtures/mapping-selection-v1/prices.json",
    candidates: SELECTION_MODELS as readonly string[],
    stack: "adr-0069",
  },
  3: {
    adr: "docs/adr/0075-retry-mapping-selection-with-column-ids-and-a-fresh-corpus.md",
    corpus: "packages/evals/fixtures/schema-dialects-v4/HELD_OUT.json",
    prices: "packages/evals/fixtures/mapping-selection-v3/prices.json",
    candidates: protocolV3.candidates as readonly string[],
    stack: "adr-0075-r1",
  },
} as const;
/** The candidate list a protocol's pre-run ADR or amendment fixed. */
export function declaredCandidates(version: SelectionProtocol) {
  const candidates = PROTOCOL_INPUTS[version].candidates;
  if (
    version === 3 &&
    (candidates.length === 0 ||
      candidates.some(
        (m) => !(RETRY_SELECTION_MODELS as readonly string[]).includes(m),
      ))
  )
    throw new Error("Undeclared candidate list");
  return candidates;
}

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
export function loadSelectionInputs(
  requireCommitted = false,
  version: SelectionProtocol = 1,
) {
  const protocol = protocols[version];
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
    const path = `packages/evals/fixtures/mapping-selection-v${version}/protocol.json`;
    if (
      !execFileSync("git", ["show", `HEAD:${path}`], { cwd: root }).equals(
        readFileSync(resolve(root, path)),
      )
    )
      throw new Error("Protocol must be committed");
    const adr = PROTOCOL_INPUTS[version].adr;
    const bytes = readFileSync(resolve(root, adr));
    if (
      !execFileSync("git", ["show", `HEAD:${adr}`], { cwd: root }).equals(
        bytes,
      ) ||
      !bytes.toString().includes("- Status: Accepted")
    )
      throw new Error("Accepted pre-run ADR must be committed");
  }
  const { corpus: corpusPath, prices: pricesPath } = PROTOCOL_INPUTS[version];
  const sealed = protocol.files as Record<string, string>;
  const source = {
    bytes: readFileSync(resolve(root, corpusPath), "utf8"),
    sha256: sealed[corpusPath]!,
  };
  const corpus = CorpusSchema.parse(JSON.parse(source.bytes));
  const seal = readFileSync(
    resolve(root, corpusPath.replace(/\.json$/, ".sha256")),
    "utf8",
  );
  if (seal !== `${source.sha256}  HELD_OUT.json\n`)
    throw new Error("HELD_OUT seal mismatch");
  if (sealed[pricesPath] === undefined && version === 3)
    throw new Error("Price table must be sealed by the pre-run amendment");
  const prices = MappingPriceTableSchema.parse(
    JSON.parse(readFileSync(resolve(root, pricesPath), "utf8")),
  );
  return { source, corpus, prices };
}

// Older sessions attest exactly SELECTION_MODELS; the loader checks the list
// against the protocol each session was run under.
const CatalogueSchema = z
  .object({
    checkedOn: z.iso.date(),
    sourceUrl: z.literal("https://ai.google.dev/gemini-api/docs/models"),
    modelIds: z.array(z.string().min(1)).min(1),
  })
  .strict();
const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && new Set([...a, ...b]).size === a.length;
/** Persist each attempt before continuing; interrupted grids cannot be selected. */
export async function runHeldOut(
  models: EvaluationModel[],
  catalogueInput: unknown,
  output: string,
  transport?: typeof fetch,
  version: 2 | 3 = 3,
) {
  const protocol = protocols[version];
  const { source, corpus } = loadSelectionInputs(true, version);
  const candidates = declaredCandidates(version);
  const { stack } = PROTOCOL_INPUTS[version];
  const catalogue = CatalogueSchema.parse(catalogueInput);
  if (
    catalogue.checkedOn !== new Date().toISOString().slice(0, 10) ||
    !sameList(catalogue.modelIds, candidates)
  )
    throw new Error("Run-date catalogue attestation required");
  if (
    !sameList(
      models.map((m) => m.model),
      candidates,
    ) ||
    models.some(
      (m) =>
        m.provider !== HELD_OUT_ENDPOINT.provider ||
        m.baseUrl !== HELD_OUT_ENDPOINT.baseUrl,
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
  const records: AnyMappingRunRecord[] = [];
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
          stack,
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
 * Every record must match a receipt that names this session, and the
 * receipted attempts must equal the session's records.json.
 */
export function readReceiptedRecords<R extends z.ZodType<AnyMappingRunRecord>>(
  directory: string,
  sessionId: string,
  receiptSchema: z.ZodType<{
    runId: string;
    sessionId: string;
    recordHash: string;
  }>,
  recordSchema: R,
): z.infer<R>[] {
  const read = (name: string): unknown =>
    JSON.parse(readFileSync(resolve(directory, name), "utf8"));
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
    const receipt = receiptSchema.parse(read(name));
    if (name !== `${receipt.runId}.receipt.json`)
      throw new Error("Receipt name mismatch");
    if (receipt.sessionId !== sessionId)
      throw new Error("Receipt belongs to another session");
    const record = recordSchema.parse(read(`${receipt.runId}.json`));
    if (sha256Canonical(record) !== receipt.recordHash)
      throw new Error("Record does not match its receipt");
    return record;
  });
  const sorted = (rs: AnyMappingRunRecord[]) =>
    rs.map((r) => sha256Canonical(r)).sort();
  if (
    sorted(z.array(recordSchema).parse(read("records.json"))).join() !==
    sorted(records).join()
  )
    throw new Error("records.json differs from the receipted attempts");
  return records;
}

/**
 * Read one held-out session directory: every record must match a receipt that
 * names this session, belong to this session and protocol, and equal the session's records.json.
 */
export function loadHeldOutSession(directory: string) {
  const session = SessionSchema.parse(
    JSON.parse(readFileSync(resolve(directory, "session.json"), "utf8")),
  );
  const version = ([1, 2, 3] as const).find(
    (v) => session.protocolHash === sha256Canonical(protocols[v]),
  );
  if (!version) throw new Error("Session was run under another protocol");
  if (!sameList(session.catalogue.modelIds, declaredCandidates(version)))
    throw new Error("Catalogue differs from the declared candidates");
  const records = readReceiptedRecords(
    directory,
    session.sessionId,
    HeldOutReceiptSchema,
    version === 3 ? MappingRunRecordV2Schema : MappingRunRecordSchema,
  );
  return {
    records,
    protocolVersion: version,
    session: {
      sessionId: session.sessionId,
      sessionHash: sha256Canonical(session),
    },
  };
}
