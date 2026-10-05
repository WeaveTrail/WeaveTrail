import { describe, expect, it, vi } from "vitest";
import {
  ConfiguredSchemaMappingProvider,
  MAPPING_VALIDATOR_VERSION,
  PROVIDER_REVIEW_MESSAGE,
  validateConfiguredProposal,
  validateMappingOutput,
} from "@weavetrail/ai-harness/server";
import {
  HostileMappingFixtureProvider,
  adversarialMappingInput,
  adversarialMappingProbes,
  validMappingFields,
} from "./adversarial-mapping-fixtures";

const provider = new HostileMappingFixtureProvider();
const configuration = {
  baseUrl: "https://hostile.invalid",
  apiKey: "synthetic-offline-secret",
  model: "synthetic-offline-model",
};

describe("offline adversarial mapping validator", () => {
  it.each(adversarialMappingProbes)(
    "rejects $id with $expected in evaluation and live mode",
    async (probe) => {
      const input = structuredClone(adversarialMappingInput);
      const output = provider.provide(probe);
      const before = structuredClone({ input, output });
      const result = validateMappingOutput(output, input);
      expect(result.status).toBe("REVIEW_REQUIRED");
      expect(result.reasons.map(({ code }) => code)).toEqual([probe.expected]);
      expect(result).not.toHaveProperty("proposal");
      expect(validateMappingOutput(output, input)).toEqual(result);
      const transport = vi
        .fn<typeof fetch>()
        .mockImplementation(
          async () => new Response(new Uint8Array(output.body)),
        );
      await expect(
        new ConfiguredSchemaMappingProvider(configuration, transport).propose(
          input,
        ),
      ).rejects.toThrow(PROVIDER_REVIEW_MESSAGE);
      expect(transport).toHaveBeenCalledTimes(1);
      expect({ input, output }).toEqual(before);
    },
  );

  it("accepts the valid control and re-validates sealed proposals with the same gate", async () => {
    expect(MAPPING_VALIDATOR_VERSION).toBe("mapping-validator/1");
    const output = provider.provide();
    const result = validateMappingOutput(output, adversarialMappingInput);
    expect(result.status).toBe("VALID");
    if (result.status !== "VALID") throw new Error("Expected valid control");
    expect(
      validateConfiguredProposal(result.proposal, adversarialMappingInput),
    ).toEqual(result.proposal);
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(new Uint8Array(output.body)),
      );
    expect(
      await new ConfiguredSchemaMappingProvider(
        configuration,
        transport,
      ).propose(adversarialMappingInput),
    ).toEqual(result.proposal);
    const changed = { ...result.proposal, sourceArtifactHash: "b".repeat(64) };
    expect(
      validateMappingOutput(
        { kind: "proposal", value: changed },
        adversarialMappingInput,
      ).reasons,
    ).toEqual([{ code: "INPUT_BINDING_MISMATCH", path: [] }]);
    expect(() =>
      validateConfiguredProposal(changed, adversarialMappingInput),
    ).toThrow(PROVIDER_REVIEW_MESSAGE);
  });

  it("leaves a well-formed swap of same-shaped price and quantity columns to human review", () => {
    const value = validMappingFields();
    [value.fields[4]!.targetField, value.fields[5]!.targetField] = [
      value.fields[5]!.targetField,
      value.fields[4]!.targetField,
    ];
    expect(
      validateMappingOutput({ kind: "fields", value }, adversarialMappingInput)
        .status,
    ).toBe("VALID");
  });

  it("dry-runs every sample row, including rows beyond the prompt's eight-row limit", async () => {
    const input = structuredClone(adversarialMappingInput);
    input.sampleRows = Array.from({ length: 10 }, (_, index) => ({
      ...input.sampleRows[0]!,
      id: `s${index}`,
      price: index === 9 ? "not-decimal" : "12.5",
    }));
    const before = structuredClone(input);
    expect(validateMappingOutput(provider.provide(), input).reasons).toEqual([
      { code: "TRANSFORM_FAILED", path: ["sampleRows", 9] },
    ]);
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(new Uint8Array(provider.provide().body)),
      );
    await expect(
      new ConfiguredSchemaMappingProvider(configuration, transport).propose(
        input,
      ),
    ).rejects.toThrow(PROVIDER_REVIEW_MESSAGE);
    expect(input).toEqual(before);
  });

  it.each(["sourceEventId", "eventTime", "instrumentId", "eventType"])(
    "requires %s exactly once",
    (target) => {
      const missing = validMappingFields();
      const field = missing.fields.find(
        (candidate) => candidate.targetField === target,
      )!;
      field.targetField = field.transform = null;
      expect(
        validateMappingOutput(
          { kind: "fields", value: missing },
          adversarialMappingInput,
        ).reasons[0]?.code,
      ).toBe("MISSING_REQUIRED_TARGET");
      const duplicate = validMappingFields();
      duplicate.fields[7]!.targetField = target;
      duplicate.fields[7]!.transform = "IDENTITY";
      expect(
        validateMappingOutput(
          { kind: "fields", value: duplicate },
          adversarialMappingInput,
        ).reasons[0]?.code,
      ).toBe("DUPLICATE_TARGET");
    },
  );

  it("pins validation stage precedence and stable reason coordinates", () => {
    const value = validMappingFields();
    value.fields[0]!.confidence = 0.5;
    value.fields[0]!.transform = "DECIMAL_STRING";
    value.fields[6]!.targetField = "sourceEventId";
    value.fields[1]!.sourceColumn = "invented";
    value.fields[0]!.extra = true;
    const validate = () =>
      validateMappingOutput({ kind: "fields", value }, adversarialMappingInput)
        .reasons;
    expect(validate()).toEqual([{ code: "OUTPUT_CONTRACT", path: [] }]);
    delete value.fields[0]!.extra;
    expect(validate()).toEqual([
      { code: "INVENTED_COLUMN", path: ["fields", 1, "sourceColumn"] },
    ]);
    value.fields[1]!.sourceColumn = "time";
    expect(validate()).toEqual([
      { code: "DUPLICATE_TARGET", path: ["fields", 6, "targetField"] },
    ]);
    value.fields[6]!.targetField = "actorId";
    expect(validate()).toEqual([
      { code: "TARGET_TRANSFORM_MISMATCH", path: ["fields", 0, "transform"] },
    ]);
    value.fields[0]!.transform = "IDENTITY";
    const input = structuredClone(adversarialMappingInput);
    input.sampleRows[1]!.price = "invalid";
    expect(
      validateMappingOutput({ kind: "fields", value }, input).reasons,
    ).toEqual([{ code: "TRANSFORM_FAILED", path: ["sampleRows", 1] }]);
    expect(validate()).toEqual([
      { code: "REVIEW_STATUS", path: ["fields", 0] },
    ]);
    const body = JSON.stringify({
      choices: [
        {
          finish_reason: "length",
          message: {
            role: "assistant",
            content: JSON.stringify(value),
            tool_calls: [],
          },
        },
      ],
    });
    expect(
      validateMappingOutput(
        { kind: "envelope", body: new TextEncoder().encode(body) },
        adversarialMappingInput,
      ).reasons,
    ).toEqual([{ code: "TOOL_CALL", path: ["choices", 0, "message"] }]);
  });

  it.each([
    { sampleRows: [] },
    { sampleRows: [{ ...adversarialMappingInput.sampleRows[0], price: 12.5 }] },
    {
      sampleRows: [
        { ...adversarialMappingInput.sampleRows[0], time: "not-iso" },
      ],
    },
    {
      sampleRows: [
        { ...adversarialMappingInput.sampleRows[0], kind: "UNKNOWN" },
      ],
    },
  ])(
    "rejects missing samples or invalid transformed row values",
    ({ sampleRows }) => {
      const result = validateMappingOutput(provider.provide(), {
        ...adversarialMappingInput,
        sampleRows,
      });
      expect(result.reasons[0]?.code).toBe(
        sampleRows.length === 0 ? "NO_SAMPLE_ROWS" : "TRANSFORM_FAILED",
      );
    },
  );
});
