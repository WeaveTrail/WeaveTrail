import { describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ConfiguredSchemaMappingProvider,
  MAPPING_TIMEOUT_MS,
  PROVIDER_REVIEW_MESSAGE,
} from "@weavetrail/ai-harness/server";
import {
  MappingRunRecordSchema,
  MAPPING_RUN_OUTPUT_MAX_BYTES,
} from "@weavetrail/contracts";
import {
  adversarialMappingInput as input,
  validMappingFields,
} from "./adversarial-mapping-fixtures";
import {
  readEvaluationModels,
  requireLiveMappingCommand,
  runConfiguredMapping,
} from "./mapping-model-runner";

const model = {
  provider: "synthetic-provider",
  baseUrl: "https://provider.invalid/v1beta/openai",
  apiKey: "synthetic-offline-key",
  model: "synthetic-model-2026-10-01",
};
const context = {
  evaluationSet: {
    version: "synthetic-recorded-responses/1",
    sha256: "a".repeat(64),
    split: "DEV" as const,
  },
  dialectId: "synthetic-success",
  repeat: 1,
};
// Authored, recorded response shapes. No real provider or credential is used.
function envelope(overrides: Record<string, unknown> = {}) {
  return {
    model: "synthetic-reported-2026-10-01",
    usage: { prompt_tokens: 120, completion_tokens: 80 },
    choices: [
      {
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: JSON.stringify(validMappingFields()),
        },
      },
    ],
    ...overrides,
  };
}
function completion(message: unknown, finish_reason = "stop") {
  return envelope({ choices: [{ finish_reason, message }] });
}

describe("OpenAI-compatible recorded mapping responses", () => {
  it("preserves a path-bearing base URL and records usage, model and temperature", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(envelope()));
    const record = await runConfiguredMapping(model, input, context, transport);
    expect(record).toMatchObject({
      outcome: "VALID",
      temperature: "0",
      requestedModel: model.model,
      reportedModel: "synthetic-reported-2026-10-01",
      inputTokens: 120,
      outputTokens: 80,
      adapterVersion: "openai-compatible-mapping/1",
      validatorVersion: "mapping-validator/1",
    });
    expect(record.parsedOutput).toEqual(validMappingFields());
    expect(MappingRunRecordSchema.safeParse(record).success).toBe(true);
    expect(transport.mock.calls[0]![0]).toBe(
      `${model.baseUrl}/chat/completions`,
    );
    expect(JSON.stringify(record)).not.toContain(model.apiKey);
    expect(record).not.toHaveProperty("proposal");
  });

  it("changes only model and authorization when configuration changes", async () => {
    const calls = [];
    for (const configuration of [
      model,
      {
        ...model,
        baseUrl: "https://other.invalid/v1/",
        model: "other-model-2026-10-02",
        apiKey: "other-synthetic-key",
      },
    ]) {
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(envelope()));
      await runConfiguredMapping(configuration, input, context, transport);
      const init = transport.mock.calls[0]![1]!;
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe(configuration.model);
      expect(body.temperature).toBe(0);
      expect(body.store).toBe(false);
      expect(body.response_format).toMatchObject({
        type: "json_schema",
        json_schema: { strict: true },
      });
      expect(body).not.toHaveProperty("tools");
      expect(init.redirect).toBe("error");
      expect(init.signal).toBeInstanceOf(AbortSignal);
      delete body.model;
      calls.push(body);
    }
    expect(calls[0]).toEqual(calls[1]);
  });

  it.each([
    [
      "refusal",
      () =>
        Response.json(
          completion({ role: "assistant", refusal: "declined", content: null }),
        ),
      "INVALID_RESPONSE",
    ],
    [
      "truncation",
      () =>
        Response.json(
          completion({ role: "assistant", content: "{" }, "length"),
        ),
      "INVALID_RESPONSE",
    ],
    [
      "tools",
      () =>
        Response.json(
          completion({ role: "assistant", content: "{}", tool_calls: [] }),
        ),
      "INVALID_RESPONSE",
    ],
    ["oversize", () => new Response("é".repeat(32_769)), "INVALID_RESPONSE"],
    [
      "HTTP failure",
      () => new Response("synthetic-private-error", { status: 500 }),
      "HTTP_ERROR",
    ],
    [
      "authentication",
      () => new Response(null, { status: 401 }),
      "AUTHENTICATION",
    ],
    ["rate limit", () => new Response(null, { status: 429 }), "RATE_LIMITED"],
    [
      "strict rejection",
      () =>
        Response.json(
          {
            error: {
              code: "unsupported_parameter",
              param: "response_format.json_schema.strict",
              message: "private error",
            },
          },
          { status: 400 },
        ),
      "STRICT_MODE_UNSUPPORTED",
    ],
    [
      "invalid schema",
      () =>
        Response.json(
          {
            error: {
              code: "invalid_json_schema",
              param: "response_format",
              message: "Invalid schema",
            },
          },
          { status: 400 },
        ),
      "HTTP_ERROR",
    ],
    ["invalid JSON", () => new Response("{"), "INVALID_RESPONSE"],
    [
      "missing choices",
      () => Response.json({ model: "synthetic-model" }),
      "INVALID_RESPONSE",
    ],
    ["no body", () => new Response(null), "INVALID_RESPONSE"],
  ] as const)(
    "records %s as a provider failure without retry or raw text",
    async (_name, makeResponse, failureClass) => {
      const transport = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => makeResponse());
      const record = await runConfiguredMapping(
        model,
        input,
        context,
        transport,
      );
      expect(record).toMatchObject({
        outcome: "PROVIDER_FAILED",
        failureClass,
        parsedOutput: null,
        validatorReasons: [],
      });
      expect(transport).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(record)).not.toContain("private");
      await expect(
        new ConfiguredSchemaMappingProvider(model, transport).propose(input),
      ).rejects.toThrow(PROVIDER_REVIEW_MESSAGE);
    },
  );

  it("accepts exactly 64 KiB and cancels a stream at the first overflowing chunk", async () => {
    const json = JSON.stringify(envelope());
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(json.padEnd(MAPPING_RUN_OUTPUT_MAX_BYTES, " ")),
      );
    expect(
      (await runConfiguredMapping(model, input, context, transport)).outcome,
    ).toBe("VALID");
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAPPING_RUN_OUTPUT_MAX_BYTES));
        controller.enqueue(new Uint8Array(1));
      },
      cancel,
    });
    const overflowing = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(stream));
    expect(
      (await runConfiguredMapping(model, input, context, overflowing))
        .failureClass,
    ).toBe("INVALID_RESPONSE");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    { model: undefined, usage: undefined },
    { model: "", usage: { prompt_tokens: 0, completion_tokens: -1 } },
    { model: 123, usage: { prompt_tokens: "123", completion_tokens: 1.5 } },
  ])("keeps unavailable observations null: %j", async (metadata) => {
    const record = await runConfiguredMapping(
      model,
      input,
      context,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(envelope(metadata))),
    );
    expect(record).toMatchObject({
      outcome: "VALID",
      reportedModel: null,
      inputTokens: null,
      outputTokens: null,
    });
  });

  it("distinguishes validator rejection and retains only a closed field output", async () => {
    const fields = validMappingFields();
    fields.fields[0]!.sourceColumn = "invented";
    const record = await runConfiguredMapping(
      model,
      input,
      context,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            completion({ role: "assistant", content: JSON.stringify(fields) }),
          ),
        ),
    );
    expect(record).toMatchObject({
      outcome: "CONTRACT_REJECTED",
      failureClass: "OUTPUT_CONTRACT",
      parsedOutput: fields,
      validatorReasons: [
        { code: "INVENTED_COLUMN", path: ["fields", 0, "sourceColumn"] },
      ],
    });
    for (const content of [
      "{",
      JSON.stringify({ ...fields, requestId: "private" }),
      JSON.stringify({ fields: [{ evidence: model.apiKey }] }),
    ]) {
      const rejected = await runConfiguredMapping(
        model,
        input,
        context,
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            Response.json(completion({ role: "assistant", content })),
          ),
      );
      expect(rejected.outcome).toBe("CONTRACT_REJECTED");
      expect(rejected.parsedOutput).toBeNull();
      expect(JSON.stringify(rejected)).not.toContain(model.apiKey);
    }
  });

  it("sanitizes transport exceptions", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error(model.apiKey, { cause: "private" }));
    const record = await runConfiguredMapping(model, input, context, transport);
    expect(record.failureClass).toBe("TRANSPORT");
    expect(JSON.stringify(record)).not.toContain(model.apiKey);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each(["transport", "body"])(
    "enforces 30 seconds through a stalled %s",
    async (stage) => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const timeout = vi
        .spyOn(AbortSignal, "timeout")
        .mockImplementation((ms) => {
          setTimeout(
            () => controller.abort(new DOMException("Timeout", "TimeoutError")),
            ms,
          );
          return controller.signal;
        });
      try {
        const transport = vi
          .fn<typeof fetch>()
          .mockImplementation(() =>
            stage === "transport"
              ? new Promise(() => {})
              : Promise.resolve(new Response(new ReadableStream())),
          );
        const pending = runConfiguredMapping(model, input, context, transport);
        await vi.advanceTimersByTimeAsync(MAPPING_TIMEOUT_MS);
        expect((await pending).failureClass).toBe("TIMEOUT");
        expect(timeout).toHaveBeenCalledWith(30_000);
        expect(transport).toHaveBeenCalledTimes(1);
      } finally {
        timeout.mockRestore();
        vi.useRealTimers();
      }
    },
  );
});

describe("explicit evaluation configuration", () => {
  const env = {
    AI_EVALUATION_MODELS: JSON.stringify([
      {
        provider: model.provider,
        baseUrl: model.baseUrl,
        model: model.model,
        apiKeyEnv: "TEST_KEY",
      },
    ]),
    TEST_KEY: model.apiKey,
  };
  it("reads any list of endpoints without a code-owned model list", () => {
    expect(readEvaluationModels(env)).toEqual([model]);
    const list = JSON.parse(env.AI_EVALUATION_MODELS);
    list.push({
      ...list[0],
      provider: "other",
      model: "other-model-2026-10-02",
      baseUrl: "https://other.invalid/custom/v2",
    });
    expect(
      readEvaluationModels({
        ...env,
        AI_EVALUATION_MODELS: JSON.stringify(list),
      }),
    ).toHaveLength(2);
  });
  it.each([
    {},
    { ...env, TEST_KEY: undefined },
    { ...env, AI_EVALUATION_MODELS: "[]" },
  ])("rejects missing explicit keys or models", (configuration) => {
    expect(() => readEvaluationModels(configuration)).toThrow(
      PROVIDER_REVIEW_MESSAGE,
    );
  });
  it.each(["model-latest", "model-LATEST", "default", "auto"])(
    "rejects rolling model %s before a call",
    async (alias) => {
      const transport = vi.fn<typeof fetch>();
      await expect(
        runConfiguredMapping(
          { ...model, model: alias },
          input,
          context,
          transport,
        ),
      ).rejects.toThrow(PROVIDER_REVIEW_MESSAGE);
      expect(transport).not.toHaveBeenCalled();
    },
  );
  it("requires an explicit live command and rejects CI even with keys", () => {
    expect(() => requireLiveMappingCommand([], env)).toThrow("requires --live");
    expect(() =>
      requireLiveMappingCommand(["--live"], { ...env, CI: "true" }),
    ).toThrow("disabled in CI");
    expect(() => requireLiveMappingCommand(["--live"], env)).not.toThrow();
  });

  it.each([
    { args: [] },
    { args: ["--live", "--scenario", "concentrated-buy-dialect-a.csv"] },
  ])(
    "loads the real CLI and refuses default or CI execution: $args",
    ({ args }) => {
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "packages/evals/src/run-mapping-models.ts",
          ...args,
        ],
        {
          cwd: fileURLToPath(new URL("../../../", import.meta.url)),
          env: { ...process.env, ...env, CI: "true" },
          encoding: "utf8",
        },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Mapping command failed.");
      expect(result.stderr).not.toContain(model.apiKey);
      expect(result.stdout).toBe("");
    },
  );
});
