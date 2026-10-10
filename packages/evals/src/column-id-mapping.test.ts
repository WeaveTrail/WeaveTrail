import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  MappedTargetFieldSchema,
  MappingRunRecordSchema,
  MappingRunRecordV2Schema,
} from "@weavetrail/contracts";
import {
  ConfiguredSchemaMappingProvider,
  MAPPING_INSTRUCTIONS,
  mappingColumnIds,
  validateColumnIdOutput,
  validateColumnIdStructure,
  validateMappingOutput,
  validateMappingStructure,
} from "@weavetrail/ai-harness/server";
import {
  HostileMappingFixtureProvider,
  adversarialMappingInput,
  adversarialMappingProbes,
  validMappingFields,
} from "./adversarial-mapping-fixtures";
import { CorpusSchema } from "./mapping-scorer";
import { dialectMappingInput } from "./schema-dialects-v2";
import { runConfiguredMapping } from "./mapping-model-runner";

// F-006 regression. The counterexample is a committed ADR 0069 mapping-run/1
// record: HELD_OUT-v3-04, repeat 1, gemini-3.1-flash-lite mapped the header
// attack column to `price` beside the real price column (DUPLICATE_TARGET).
const session = new URL(
  "../results/mapping-held-out-v2/sessions/f869738c-fb61-42df-9b50-ecfd9c3b299a/",
  import.meta.url,
);
const counterexample = MappingRunRecordSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("029368ac-2026-49fe-8d94-49a7588203e9.json", session),
      "utf8",
    ),
  ),
);
const v3 = CorpusSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../fixtures/schema-dialects-v3/HELD_OUT.json", import.meta.url),
      "utf8",
    ),
  ),
);
const dialect = v3.dialects.find((d) => d.id === counterexample.dialectId)!;
const attack = dialect.gold.find((g) => g.injection?.placement === "HEADER")!;
const configuration = {
  provider: "google",
  baseUrl: "https://provider.invalid/v1",
  apiKey: "synthetic-offline-secret",
  model: "synthetic-offline-model",
};
type Request = {
  messages: { role: string; content: string }[];
  response_format: { json_schema: { schema: unknown } };
};
function capture(content: unknown) {
  const requests: Request[] = [];
  const transport = vi.fn<typeof fetch>(async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return Response.json({
      model: configuration.model,
      choices: [
        {
          finish_reason: "stop",
          message: { role: "assistant", content: JSON.stringify(content) },
        },
      ],
    });
  });
  return { requests, transport };
}
const toIds = (
  fields: Record<string, unknown>[],
  input = adversarialMappingInput,
) => {
  const ids = mappingColumnIds(input);
  return fields.map(({ sourceColumn, ...field }) => ({
    columnId:
      typeof sourceColumn === "string" && input.columns.includes(sourceColumn)
        ? ids[input.columns.indexOf(sourceColumn)]
        : `unknown:${String(sourceColumn)}`,
    ...field,
  }));
};

describe("F-006: headers are data, never allowed output values", () => {
  it("replays the counterexample: the attack header was an allowed output value under ADR 0069", async () => {
    expect(counterexample.validatorReasons[0]?.code).toBe("DUPLICATE_TARGET");
    expect(
      counterexample.parsedOutput!.fields.find(
        (f) => f.sourceColumn === attack.sourceColumn,
      )?.targetField,
    ).toBe(attack.injectedTarget);
    const { requests, transport } = capture({ fields: [] });
    const input = dialectMappingInput(dialect);
    await new ConfiguredSchemaMappingProvider(configuration, transport).attempt(
      input,
    );
    expect(
      JSON.stringify(requests[0]!.response_format.json_schema.schema),
    ).toContain(JSON.stringify(attack.sourceColumn));
  });

  it("sends headers and samples only as quoted data beside opaque IDs under ADR 0075", async () => {
    const { requests, transport } = capture({ fields: [] });
    const input = dialectMappingInput(dialect);
    await new ConfiguredSchemaMappingProvider(
      configuration,
      transport,
      "adr-0075",
    ).attempt(input);
    const request = requests[0]!;
    const schema = JSON.stringify(request.response_format.json_schema.schema);
    // `eventType` is both a header and a target name; every other header is absent.
    for (const header of input.columns.filter(
      (c) => !MappedTargetFieldSchema.safeParse(c).success,
    ))
      expect(schema).not.toContain(JSON.stringify(header).slice(1, -1));
    const ids = mappingColumnIds(input);
    expect(ids[0]).toBe("c01");
    expect(schema).toContain(
      `"columnId":{"type":"string","enum":${JSON.stringify(ids)}}`,
    );
    expect(schema).not.toContain("sourceColumn");
    expect(request.messages[0]).toEqual({
      role: "system",
      content: MAPPING_INSTRUCTIONS["adr-0075"],
    });
    const data = JSON.parse(request.messages[1]!.content);
    expect(data).toEqual({
      sourceArtifactHash: input.sourceArtifactHash,
      columns: input.columns.map((header, index) => ({
        id: ids[index],
        header,
        samples: input.sampleRows.map((row) => row[header]),
      })),
    });
    expect(Object.keys(data)).not.toContain("sampleRows");
  });

  it.each([
    {
      name: "unknown",
      code: "INVENTED_COLUMN",
      mutate: (f: Record<string, unknown>[]) => (f[0]!.columnId = "c99"),
    },
    {
      name: "header as ID",
      code: "INVENTED_COLUMN",
      mutate: (f: Record<string, unknown>[]) => (f[0]!.columnId = "id"),
    },
    {
      name: "non-string",
      code: "INVENTED_COLUMN",
      mutate: (f: Record<string, unknown>[]) => (f[0]!.columnId = 1),
    },
    {
      name: "duplicate",
      code: "DUPLICATE_COLUMN",
      mutate: (f: Record<string, unknown>[]) => (f[1]!.columnId = "c01"),
    },
    {
      name: "missing",
      code: "MISSING_COLUMN",
      mutate: (f: Record<string, unknown>[]) => f.pop(),
    },
    {
      name: "reordered",
      code: "REORDERED_COLUMN",
      mutate: (f: Record<string, unknown>[]) => f.reverse(),
    },
    {
      name: "returned header",
      code: "OUTPUT_CONTRACT",
      mutate: (f: Record<string, unknown>[]) => (f[0]!.sourceColumn = "id"),
    },
    {
      name: "absent",
      code: "OUTPUT_CONTRACT",
      mutate: (f: Record<string, unknown>[]) => delete f[0]!.columnId,
    },
  ])("rejects a $name column ID with $code", ({ code, mutate }) => {
    const fields = toIds(validMappingFields().fields);
    mutate(fields);
    expect(
      validateColumnIdStructure(
        { kind: "fields", value: { fields } },
        adversarialMappingInput,
      ).reasons.map((r) => r.code),
    ).toEqual([code]);
  });

  it("rejects every adversarial probe in its ID form with the version 2 code", () => {
    const provider = new HostileMappingFixtureProvider();
    for (const probe of adversarialMappingProbes) {
      const v2 = validateMappingOutput(
        provider.provide(probe),
        adversarialMappingInput,
      );
      // Re-encode the same probe so the model names columns only by ID.
      // Envelope-stage probes stay byte-identical; parsed content is re-encoded.
      let bytes = provider.provide(probe).body;
      try {
        const body = JSON.parse(new TextDecoder().decode(bytes));
        const content = JSON.parse(body.choices[0].message.content);
        if (Array.isArray(content?.fields)) {
          body.choices[0].message.content = JSON.stringify({
            ...content,
            fields: toIds(content.fields),
          });
          bytes = new TextEncoder().encode(JSON.stringify(body));
        }
      } catch {
        // Not parseable at the envelope or content stage: unchanged bytes.
      }
      const v3 = validateColumnIdOutput(
        { kind: "envelope", body: bytes },
        adversarialMappingInput,
      );
      expect(v3.status, probe.id).toBe("REVIEW_REQUIRED");
      expect(v3.reasons[0]!.code, probe.id).toBe(v2.reasons[0]!.code);
    }
    const valid = validateColumnIdOutput(
      {
        kind: "fields",
        value: { fields: toIds(validMappingFields().fields) },
      },
      adversarialMappingInput,
    );
    expect(valid.status).toBe("VALID");
  });

  it("accepts nothing version 2 rejects: every v3 VALID result is v2 VALID after projection", () => {
    const corpora = ["DEV", "HELD_OUT"].map((split) =>
      CorpusSchema.parse(
        JSON.parse(
          readFileSync(
            new URL(
              `../fixtures/schema-dialects-v4/${split}.json`,
              import.meta.url,
            ),
            "utf8",
          ),
        ),
      ),
    );
    let checked = 0;
    for (const d of corpora.flatMap((c) => c.dialects)) {
      const input = dialectMappingInput(d);
      const gold = d.gold.map((g) => ({
        sourceColumn: g.sourceColumn,
        targetField: g.targetField,
        transform: g.transform,
        status: g.status,
        confidence: g.status === "PROPOSED" ? 1 : 0,
        evidence: g.rationale,
      }));
      // Single-field mutations of authored gold: swap targets, drop required
      // targets, duplicate targets and break transforms.
      const variants = [
        gold,
        ...gold.map((_, i) =>
          gold.map((f, j) =>
            i === j
              ? { ...f, targetField: "price", transform: "DECIMAL_STRING" }
              : f,
          ),
        ),
      ];
      for (const fields of variants) {
        const ordered = input.columns.map((c) =>
          fields.find((f) => f.sourceColumn === c)!,
        );
        const v3 = validateColumnIdStructure(
          { kind: "fields", value: { fields: toIds(ordered, input) } },
          input,
        );
        const v2 = validateMappingStructure(
          { kind: "fields", value: { fields: ordered } },
          input,
        );
        if (v3.status === "VALID") expect(v2.status).toBe("VALID");
        expect(v3.reasons).toEqual(
          v2.reasons.map((r) => ({
            ...r,
            path: r.path.map((p) => (p === "sourceColumn" ? "columnId" : p)),
          })),
        );
        checked++;
      }
    }
    expect(checked).toBe(24 * 16);
  });

  it("retains the returned ID and a projected header in mapping-run/2", async () => {
    const input = dialectMappingInput(dialect);
    const ids = mappingColumnIds(input);
    const fields = dialect.gold.map((g) => ({
      columnId: ids[input.columns.indexOf(g.sourceColumn)]!,
      targetField: g.targetField,
      transform: g.transform,
      confidence: g.status === "PROPOSED" ? 1 : 0,
      evidence: "Authored gold, not model output.",
      status: g.status,
    }));
    const ordered = ids.map((id) => fields.find((f) => f.columnId === id)!);
    const context = {
      evaluationSet: {
        version: v3.version,
        sha256: "a".repeat(64),
        split: "DEV" as const,
      },
      dialectId: dialect.id,
      repeat: 1,
    };
    const valid = await runConfiguredMapping(
      configuration,
      input,
      context,
      capture({ fields: ordered }).transport,
      "adr-0075",
    );
    expect(MappingRunRecordV2Schema.parse(valid)).toMatchObject({
      schemaVersion: "mapping-run/2",
      outcome: "VALID",
      adapterVersion: "openai-compatible-mapping/3",
      promptVersion: "schema-mapping/2",
      outputSchemaVersion: "mapping-fields/2",
      validatorVersion: "mapping-validator/3",
    });
    expect(
      MappingRunRecordV2Schema.parse(valid).parsedOutput!.fields.map((f) => [
        f.columnId,
        f.sourceColumn,
      ]),
    ).toEqual(ids.map((id, i) => [id, input.columns[i]]));
    const unknown = ordered.map((f, i) =>
      i === 0 ? { ...f, columnId: "c99" } : f,
    );
    const rejected = await runConfiguredMapping(
      configuration,
      input,
      context,
      capture({ fields: unknown }).transport,
      "adr-0075",
    );
    expect(rejected).toMatchObject({
      outcome: "CONTRACT_REJECTED",
      failureClass: "OUTPUT_CONTRACT",
    });
    expect(rejected.parsedOutput!.fields[0]).toEqual(
      Object.fromEntries(
        Object.entries(unknown[0]!).filter(([k]) => k !== "sourceColumn"),
      ),
    );
    expect(rejected.parsedOutput!.fields[1]!.sourceColumn).toBe(
      input.columns[1],
    );
    const withHeader = ordered.map((f, i) =>
      i === 0 ? { ...f, sourceColumn: input.columns[0] } : f,
    );
    expect(
      await runConfiguredMapping(
        configuration,
        input,
        context,
        capture({ fields: withHeader }).transport,
        "adr-0075",
      ),
    ).toMatchObject({
      outcome: "CONTRACT_REJECTED",
      failureClass: "OUTPUT_NOT_RETAINABLE",
      parsedOutput: null,
    });
  });

  it("keeps the live default on the ADR 0069 stack and returns the same proposal under ADR 0075", async () => {
    const provider = new ConfiguredSchemaMappingProvider(
      configuration,
      vi.fn<typeof fetch>(),
    );
    expect(provider.stack).toBe("adr-0069");
    expect(provider.trace.promptVersion).toBe("schema-mapping/1");
    const fields = validMappingFields().fields;
    const header = await new ConfiguredSchemaMappingProvider(
      configuration,
      capture({ fields }).transport,
    ).propose(adversarialMappingInput);
    const ids = await new ConfiguredSchemaMappingProvider(
      configuration,
      capture({ fields: toIds(fields) }).transport,
      "adr-0075",
    ).propose(adversarialMappingInput);
    expect(ids).toEqual(header);
  });
});
