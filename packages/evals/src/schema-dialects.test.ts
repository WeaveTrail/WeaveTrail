import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { format } from "prettier";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  MappedTargetFieldSchema,
  SchemaMappingProposalSchema,
} from "@weavetrail/contracts";
import { generateCorpus, tags, type Corpus } from "./schema-dialects-generator";

// ADR 0068 publishes only these audited outputs, through one binding. Corpus,
// gold, run records and every other evaluation import remain offline.
const publishedOutputs = new Map([
  [
    "packages/evals/results/mapping-held-out-v1/comparison.json",
    "3850fefce368f8efd0941dc2e77e47652f50d5818eab7fa4d6876f11b9c378c0",
  ],
  [
    "packages/evals/results/mapping-held-out-v1/decision.json",
    "74015061dbcb68a4da319a8f84c939126e21ca05160b7cf1f2849775b8ea1316",
  ],
  [
    "packages/evals/results/mapping-held-out-v1/sessions/365e2daf-a833-427d-8921-718890100b59/session.json",
    "ae63e014d166b2722701237f48cd308b513ada10dba0f59f2ce2250e5e824a3f",
  ],
]);

function assertEvaluationImport(name: string, imported: string, root: string) {
  if (!/@weavetrail\/evals|(?:^|\/)evals(?:\/|$)/.test(imported)) return;
  const target = relative(root, resolve(root, name, "..", imported));
  expect(name).toBe("apps/web/src/app/evals/held-out-result.ts");
  expect(publishedOutputs.has(target), target).toBe(true);
  const bytes = readFileSync(resolve(root, target));
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    publishedOutputs.get(target),
  );
  // Even the audited publication may contain only metrics and metadata.
  expect(bytes.toString()).not.toMatch(
    /"(?:gold|dialects|namingFamily|sampleRows|samples|columns|constants|parsedOutput|apiKey)"\s*:/,
  );
}

function assertOfflineBoundary(
  entry: string,
  host: ts.ModuleResolutionHost = ts.sys,
) {
  const visited = new Set<string>();
  function visit(path: string) {
    if (visited.has(path)) return;
    visited.add(path);
    const content = host.readFile(path);
    if (content === undefined) throw new Error(`Cannot read ${path}`);
    expect(path).not.toContain("schema-dialects");
    expect(content, path).not.toContain("schema-dialects");
    for (const imported of ts.preProcessFile(content).importedFiles) {
      if (!imported.fileName.startsWith(".")) continue;
      const resolved = ts.resolveModuleName(
        imported.fileName,
        path,
        {
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          resolveJsonModule: true,
        },
        host,
      ).resolvedModule;
      if (!resolved)
        throw new Error(`Cannot resolve ${imported.fileName} from ${path}`);
      visit(resolved.resolvedFileName);
    }
  }
  visit(entry);
}

const directory = new URL("../fixtures/schema-dialects-v1/", import.meta.url);
const read = (split: string): Corpus =>
  JSON.parse(readFileSync(new URL(`${split}.json`, directory), "utf8"));
function validate(dev: Corpus, held: Corpus) {
  expect(dev.split).toBe("DEV");
  expect(held.split).toBe("HELD_OUT");
  expect(dev.dialects.length).toBeGreaterThanOrEqual(8);
  expect(held.dialects.length).toBeGreaterThanOrEqual(12);
  const families = new Set<string>();
  const ids = new Set<string>();
  for (const corpus of [dev, held]) {
    expect(corpus.version).toBe("schema-dialects/1");
    for (const dialect of corpus.dialects) {
      expect(families.has(dialect.namingFamily)).toBe(false);
      families.add(dialect.namingFamily);
      expect(ids.has(dialect.id)).toBe(false);
      ids.add(dialect.id);
      expect(new Set(dialect.input.columns.map((c) => c.name)).size).toBe(
        dialect.input.columns.length,
      );
      expect(dialect.gold.map((g) => g.sourceColumn)).toEqual(
        dialect.input.columns.map((c) => c.name),
      );
      SchemaMappingProposalSchema.parse({
        mappingVersion: "1.4",
        sourceArtifactHash: "0".repeat(64),
        constants: {
          schemaVersion: "1.1",
          datasetId: dialect.id,
          venueId: "SYNTHETIC",
        },
        fields: dialect.gold.map((g) => ({
          sourceColumn: g.sourceColumn,
          targetField: g.targetField,
          transform: g.transform,
          status: g.status,
          confidence: g.status === "PROPOSED" ? 1 : 0,
          evidence: g.rationale,
        })),
      });
      for (const [index, gold] of dialect.gold.entries()) {
        expect(gold.tags.length).toBeGreaterThan(0);
        for (const tag of gold.tags) expect(tags).toContain(tag);
        if (
          gold.tags.some((tag) => ["AMBIGUOUS", "TRANSFORM_LURE"].includes(tag))
        )
          expect(gold.status).toBe("REVIEW_REQUIRED");
        if (gold.tags.includes("ABSENT_LURE")) {
          expect(gold.targetField).toBeNull();
          expect(dialect.gold.some((g) => g.targetField === "price")).toBe(
            true,
          );
          expect(dialect.gold.some((g) => g.targetField === "actorId")).toBe(
            true,
          );
        }
        if (gold.tags.includes("INJECTION")) {
          MappedTargetFieldSchema.parse(gold.injectedTarget);
          expect(gold.targetField).not.toBe(gold.injectedTarget);
          const injection = gold.injection!;
          const column = dialect.input.columns[index]!;
          const text =
            injection.placement === "HEADER"
              ? column.name
              : injection.placement === "CELL"
                ? column.samples.join(" ")
                : dialect.input.constants[column.name]!;
          expect(text).toContain(injection.payload);
          const decoded =
            injection.encoding === "BASE64"
              ? Buffer.from(injection.payload.slice(7), "base64").toString(
                  "utf8",
                )
              : injection.payload.replaceAll("\u200b", "");
          expect(decoded).toContain(gold.injectedTarget);
        }
      }
    }
  }
  const decisions = held.dialects.flatMap((d) => d.gold);
  expect(decisions.length).toBeGreaterThanOrEqual(150);
  for (const tag of tags)
    expect(
      decisions.filter((g) => g.tags.includes(tag)).length,
    ).toBeGreaterThanOrEqual(15);
  const injections = decisions.flatMap((g) =>
    g.injection ? [g.injection] : [],
  );
  for (const language of ["EN", "KO"])
    for (const encoding of ["PLAIN", "BASE64", "ZERO_WIDTH"])
      for (const placement of ["HEADER", "CELL", "CONSTANT"]) {
        expect(
          injections.some(
            (i) =>
              i.language === language &&
              i.encoding === encoding &&
              i.placement === placement,
          ),
        ).toBe(true);
      }
}

describe("offline schema dialect evaluation input", () => {
  it("satisfies inventory, contract gold, disjoint families and injection coverage", () =>
    validate(read("DEV"), read("HELD_OUT")));
  it("varies semantic positions across and within splits", () => {
    const orders = new Set<string>();
    for (const split of ["DEV", "HELD_OUT"]) {
      const corpus = read(split);
      for (const dialect of corpus.dialects) {
        const order = JSON.stringify(dialect.gold.map((g) => g.rationale));
        expect(orders.has(order)).toBe(false);
        orders.add(order);
      }
      for (const field of corpus.dialects[0]!.gold) {
        const positions = new Set(
          corpus.dialects.map((d) =>
            d.gold.findIndex((g) => g.rationale === field.rationale),
          ),
        );
        expect(positions.size).toBeGreaterThan(1);
      }
    }
  });
  it("holds out decoded injection wording across splits", () => {
    const payloads = (split: string) =>
      read(split).dialects.flatMap((d) =>
        d.gold.flatMap((g) =>
          g.injection
            ? [
                g.injection.encoding === "BASE64"
                  ? Buffer.from(
                      g.injection.payload.slice(7),
                      "base64",
                    ).toString("utf8")
                  : g.injection.payload.replaceAll("\u200b", ""),
              ]
            : [],
        ),
      );
    const dev = new Set(payloads("DEV"));
    for (const payload of payloads("HELD_OUT"))
      expect(dev.has(payload)).toBe(false);
  });
  it.each([
    'export * from "./offline-fixtures";',
    'export { generateCorpus as fixtures } from "./offline-fixtures";',
    'import { generateCorpus } from "./offline-fixtures"; export const fixtures = generateCorpus;',
  ])("traces indirect exports and imports: %s", (entry) => {
    const files: Record<string, string> = {
      "/virtual/index.ts": entry,
      "/virtual/offline-fixtures.ts": 'export * from "./bridge";',
      "/virtual/bridge.ts":
        'export { generateCorpus } from "./schema-dialects-generator";',
    };
    const host = {
      fileExists: (path: string) => path in files,
      readFile: (path: string) => files[path],
    };
    expect(entry).not.toContain("schema-dialects");
    expect(() => assertOfflineBoundary("/virtual/index.ts", host)).toThrow(
      /schema-dialects/,
    );
    files["/virtual/bridge.ts"] =
      'export * from "./index"; export const generateCorpus = 1;';
    expect(() =>
      assertOfflineBoundary("/virtual/index.ts", host),
    ).not.toThrow();
  });
  it.each(["DEV", "HELD_OUT"] as const)(
    "regenerates %s bytes and verifies its seal",
    async (split) => {
      const bytes = readFileSync(new URL(`${split}.json`, directory), "utf8");
      expect(
        await format(JSON.stringify(generateCorpus(split)), { parser: "json" }),
      ).toBe(bytes);
      expect(readFileSync(new URL(`${split}.sha256`, directory), "utf8")).toBe(
        `${createHash("sha256").update(bytes).digest("hex")}  ${split}.json\n`,
      );
    },
  );
  it.each([
    "size",
    "tag",
    "family",
    "target",
    "transform",
    "status",
    "injectedTarget",
  ])("rejects %s corruption", (kind) => {
    const dev = read("DEV");
    const held = read("HELD_OUT");
    const gold = held.dialects[0]!.gold[0]!;
    if (kind === "size") held.dialects.pop();
    if (kind === "tag")
      for (const dialect of held.dialects)
        for (const field of dialect.gold)
          field.tags = field.tags.map((t) =>
            t === "CLEAR" ? "ABBREVIATED" : t,
          );
    if (kind === "family")
      held.dialects[0]!.namingFamily = dev.dialects[0]!.namingFamily;
    if (kind === "target") gold.targetField = "invented";
    if (kind === "transform") gold.transform = "DIVIDE_100";
    if (kind === "status") Object.assign(gold, { status: "APPROVED" });
    if (kind === "injectedTarget")
      held.dialects[0]!.gold.find((g) => g.injection)!.injectedTarget =
        "invented";
    expect(() => validate(dev, held)).toThrow();
  });
  it("keeps the offline corpus outside production imports and public assets", () => {
    const root = resolve(import.meta.dirname, "../../..");
    // Ban references from every production package, including transitive web dependencies.
    for (const folder of ["apps/web/src", "apps/web/public", "packages"]) {
      for (const file of readdirSync(resolve(root, folder), {
        recursive: true,
        withFileTypes: true,
      })) {
        if (!file.isFile()) continue;
        const path = resolve(file.parentPath, file.name);
        const name = relative(root, path);
        if (
          name.includes("node_modules") ||
          name.includes("packages/evals/") ||
          /\.(test|spec)\./.test(name)
        )
          continue;
        if (!/\.(ts|tsx|js|mjs|json|html)$/.test(name)) continue;
        const content = readFileSync(path, "utf8");
        expect(content, name).not.toContain("schema-dialects");
        for (const imported of ts.preProcessFile(content).importedFiles)
          assertEvaluationImport(name, imported.fileName, root);
      }
    }
    assertOfflineBoundary(resolve(import.meta.dirname, "index.ts"));
  });
  it("rejects corpus, gold, run-record and non-binding publication imports", () => {
    const root = resolve(import.meta.dirname, "../../..");
    const binding = "apps/web/src/app/evals/held-out-result.ts";
    for (const imported of [
      "../../../../../packages/evals/fixtures/schema-dialects-v2/HELD_OUT.json",
      "../../../../../packages/evals/fixtures/schema-dialects-v2/DEV.json",
      "../../../../../packages/evals/results/mapping-held-out-v1/sessions/365e2daf-a833-427d-8921-718890100b59/records.json",
      "../../../../../packages/evals/src/mapping-selection",
      "@weavetrail/evals",
    ])
      expect(() => assertEvaluationImport(binding, imported, root)).toThrow();
    for (const name of [
      "apps/web/src/app/evals/page.tsx",
      "packages/contracts/src/index.ts",
    ])
      expect(() =>
        assertEvaluationImport(
          name,
          "../../../../../packages/evals/results/mapping-held-out-v1/comparison.json",
          root,
        ),
      ).toThrow();
    for (const target of publishedOutputs.keys())
      expect(() =>
        assertEvaluationImport(binding, `../../../../../${target}`, root),
      ).not.toThrow();
  });
});
