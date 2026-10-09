import { createHash } from "node:crypto";
import {
  readFileSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { format } from "prettier";
import { expect, it, vi } from "vitest";
import { MappingRunRecordSchema } from "@weavetrail/contracts";
import { validateMappingStructure } from "@weavetrail/ai-harness/server";
import { generateCorpusV3 } from "./schema-dialects-v3";
import { dialectMappingInput } from "./schema-dialects-v2";
import { loadSelectionInputs } from "./held-out-protocol";
import { selectMappingModels, SELECTION_MODELS } from "./mapping-selection";
import { runConfiguredMapping } from "./mapping-model-runner";
import { diagnosticTransport } from "./provider-diagnostics";
import { tags } from "./schema-dialects-generator";

it("reproduces fresh v3 bytes with all tags, visible attacks and structurally valid gold", async () => {
  const { source, corpus } = loadSelectionInputs(false, 2);
  expect(
    await format(JSON.stringify(generateCorpusV3()), { parser: "json" }),
  ).toBe(source.bytes);
  expect(createHash("sha256").update(source.bytes).digest("hex")).toBe(
    source.sha256,
  );
  const old = loadSelectionInputs().corpus;
  expect(corpus.dialects).toHaveLength(12);
  for (const d of corpus.dialects) {
    expect(
      old.dialects.some(
        (o) => o.id === d.id || o.namingFamily === d.namingFamily,
      ),
    ).toBe(false);
    expect(new Set(d.gold.flatMap((g) => g.tags))).toEqual(new Set(tags));
    expect(d.gold.every((g) => g.tags.length === 1)).toBe(true);
    const input = dialectMappingInput(d);
    expect(input.sampleRows).toHaveLength(2);
    for (const g of d.gold.filter((g) => g.injection))
      expect(JSON.stringify(input)).toContain(g.injection!.payload);
    expect(
      validateMappingStructure(
        {
          kind: "fields",
          value: {
            fields: d.gold.map((g) => ({
              sourceColumn: g.sourceColumn,
              targetField: g.targetField,
              transform: g.transform,
              status: g.status,
              confidence: g.status === "PROPOSED" ? 1 : 0,
              evidence: g.rationale,
            })),
          },
        },
        input,
      ).status,
    ).toBe("VALID");
  }
});

it("reproduces the unsupported-store failure and returns output with the fixed request", async () => {
  const { source, corpus } = loadSelectionInputs(false, 2);
  const d = corpus.dialects[0]!;
  const model = {
    provider: "google",
    model: SELECTION_MODELS[0],
    baseUrl: "https://provider.invalid/v1",
    apiKey: "synthetic-key",
  };
  const transport = vi.fn<typeof fetch>(async (_url, init) => {
    if (Object.hasOwn(JSON.parse(String(init?.body)), "store"))
      return Response.json(
        [
          {
            error: {
              code: 400,
              status: "INVALID_ARGUMENT",
              message: 'Unknown name "store": Cannot find field.',
            },
          },
        ],
        { status: 400 },
      );
    return Response.json({
      model: model.model,
      choices: [
        {
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: JSON.stringify({
              fields: d.gold.map((g) => ({
                sourceColumn: g.sourceColumn,
                targetField: g.targetField,
                transform: g.transform,
                status: g.status,
                confidence: g.status === "PROPOSED" ? 1 : 0,
                evidence: "Synthetic response regression fixture.",
              })),
            }),
          },
        },
      ],
    });
  });
  const context = {
    evaluationSet: {
      version: corpus.version,
      sha256: source.sha256,
      split: "HELD_OUT" as const,
    },
    dialectId: d.id,
    repeat: 1,
  };
  const legacy: typeof fetch = (url, init) =>
    transport(url, {
      ...init,
      body: JSON.stringify({ ...JSON.parse(String(init?.body)), store: false }),
    });
  expect(
    await runConfiguredMapping(model, dialectMappingInput(d), context, legacy),
  ).toMatchObject({ httpStatus: 400, failureClass: "HTTP_ERROR" });
  expect(
    await runConfiguredMapping(
      model,
      dialectMappingInput(d),
      context,
      transport,
    ),
  ).toMatchObject({ httpStatus: 200, outcome: "VALID" });
});

function recoveryGold() {
  const { source, corpus } = loadSelectionInputs(false, 2);
  return SELECTION_MODELS.flatMap((model) =>
    corpus.dialects.flatMap((d) =>
      [1, 2, 3].map((repeat) =>
        MappingRunRecordSchema.parse({
          schemaVersion: "mapping-run/1",
          evaluationSet: {
            version: corpus.version,
            sha256: source.sha256,
            split: "HELD_OUT",
          },
          dialectId: d.id,
          repeat,
          provider: "google",
          requestedModel: model,
          reportedModel: model,
          adapterVersion: "openai-compatible-mapping/2",
          promptVersion: "schema-mapping/1",
          outputSchemaVersion: "mapping-fields/1",
          validatorVersion: "mapping-validator/2",
          temperature: "0",
          httpStatus: 200,
          latencyMs: 0,
          inputTokens: 100,
          outputTokens: 100,
          outcome: "VALID",
          failureClass: null,
          validatorReasons: [],
          parsedOutput: {
            fields: d.gold.map((g) => ({
              sourceColumn: g.sourceColumn,
              targetField: g.targetField,
              transform: g.transform,
              status: g.status,
              confidence: g.status === "PROPOSED" ? 1 : 0,
              evidence: "Authored gold, not model performance.",
            })),
          },
        }),
      ),
    ),
  );
}
let recoveryResult: ReturnType<typeof selectMappingModels>;
it("uses ADR 0069 and the frozen v2 DEV reference", () => {
  const { source, prices } = loadSelectionInputs(false, 2);
  const records = recoveryGold();

  const result = selectMappingModels(records, source, prices);
  recoveryResult = result;
  expect(result.decision).toMatchObject({
    rule: "ADR-0069",
    outcome: "SELECTED",
    primary: SELECTION_MODELS[0],
  });
  expect(result.comparison.baseline.version).toBe("lexical-baseline/2");
});
it("keeps recovery selection invariant to order and HTTP observation grouping", () => {
  const { source, prices } = loadSelectionInputs(false, 2);
  const records = recoveryGold();
  expect(selectMappingModels([...records].reverse(), source, prices)).toEqual(
    recoveryResult,
  );
});
it("excludes HTTP status from score grouping and rejects a v1 adapter for v3", () => {
  const { source, prices } = loadSelectionInputs(false, 2);
  const records = recoveryGold();
  records[0]!.httpStatus = 201;
  expect(
    selectMappingModels(records, source, prices).comparison.groups,
  ).toEqual(recoveryResult.comparison.groups);
  records[0]!.adapterVersion = "openai-compatible-mapping/1";
  expect(() => selectMappingModels(records, source, prices)).toThrow(
    "configuration",
  );
});

it("captures only bounded HTTP errors in exclusive private files, never request headers", async () => {
  const directory = mkdtempSync(join(tmpdir(), "private-diagnostics-"));
  try {
    const body = "synthetic private error";
    const transport = diagnosticTransport(
      directory,
      vi.fn<typeof fetch>(async () => new Response(body, { status: 400 })),
    );
    const response = await transport("https://provider.invalid/v1", {
      headers: { authorization: "Bearer synthetic-key" },
    });
    expect(await response.text()).toBe(body);
    const file = join(directory, readdirSync(directory)[0]!);
    const capture = JSON.parse(readFileSync(file, "utf8"));
    expect(capture.httpStatus).toBe(400);
    expect(Buffer.from(capture.bodyBase64, "base64").toString()).toBe(body);
    expect(readFileSync(file, "utf8")).not.toContain("synthetic-key");
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const oversized = diagnosticTransport(
      directory,
      vi.fn<typeof fetch>(
        async () => new Response("x".repeat(65537), { status: 500 }),
      ),
    );
    expect(await (await oversized("https://provider.invalid/v1")).text()).toBe(
      "",
    );
    expect(readdirSync(directory)).toHaveLength(2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
