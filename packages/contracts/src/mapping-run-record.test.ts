import { describe, expect, it } from "vitest";
import {
  MAPPING_RUN_OUTPUT_MAX_BYTES,
  MappingRunReceiptSchema,
  MappingRunRecordSchema,
  MappingRunStructuredOutputSchema,
} from "./mapping-run-record";

// Synthetic records, not captured model runs or approved mapping proposals.
const base = {
  schemaVersion: "mapping-run/1",
  evaluationSet: {
    version: "schema-dialects/1",
    sha256: "a".repeat(64),
    split: "DEV",
  },
  dialectId: "DEV-snake",
  repeat: 1,
  provider: "synthetic-provider",
  requestedModel: "synthetic-model-2026-10-01",
  reportedModel: null,
  adapterVersion: "synthetic-adapter/1",
  promptVersion: "schema-mapping/1",
  outputSchemaVersion: "mapping-fields/1",
  validatorVersion: "mapping-validator/1",
  temperature: "0",
  latencyMs: 23,
  inputTokens: null,
  outputTokens: null,
};
const field = {
  sourceColumn: "price",
  targetField: "price",
  transform: "DECIMAL_STRING",
  confidence: 1,
  evidence: "Synthetic price column.",
  status: "PROPOSED",
};
const valid = {
  ...base,
  outcome: "VALID",
  validatorReasons: [],
  failureClass: null,
  parsedOutput: { fields: [field] },
};
const rejected = {
  ...base,
  outcome: "CONTRACT_REJECTED",
  validatorReasons: [
    { code: "UNKNOWN_TARGET", path: ["fields", 0, "targetField"] },
  ],
  failureClass: "OUTPUT_CONTRACT",
  parsedOutput: { fields: [{ ...field, targetField: "inventedTarget" }] },
};
const failed = {
  ...base,
  outcome: "PROVIDER_FAILED",
  validatorReasons: [],
  failureClass: "TIMEOUT",
  parsedOutput: null,
};

describe("versioned mapping run records", () => {
  it.each([valid, rejected, failed])("accepts $outcome", (record) => {
    expect(MappingRunRecordSchema.parse(record)).toEqual(record);
  });

  it("retains invalid scalars and missing mapping fields for re-validation", () => {
    const parsedOutput = {
      fields: [{ sourceColumn: "price", confidence: "certain", status: false }],
    };
    expect(
      MappingRunRecordSchema.parse({ ...rejected, parsedOutput }).parsedOutput,
    ).toEqual(parsedOutput);
    expect(
      MappingRunRecordSchema.safeParse({ ...valid, parsedOutput }).success,
    ).toBe(false);
  });

  it("allows null for unparseable, unsafe or oversized rejected output", () => {
    for (const failureClass of [
      "UNPARSEABLE_OUTPUT",
      "OUTPUT_NOT_RETAINABLE",
    ]) {
      expect(
        MappingRunRecordSchema.safeParse({
          ...rejected,
          failureClass,
          parsedOutput: null,
        }).success,
      ).toBe(true);
    }
  });

  it("records reported identity and provided usage without inventing missing usage", () => {
    const record = MappingRunRecordSchema.parse({
      ...valid,
      reportedModel: "synthetic-reported-model",
      inputTokens: 71,
      outputTokens: 42,
    });
    expect(record.reportedModel).toBe("synthetic-reported-model");
    expect(record.inputTokens).toBe(71);
    expect(record.outputTokens).toBe(42);
    expect(MappingRunRecordSchema.parse(valid).inputTokens).toBeNull();
    expect(MappingRunRecordSchema.parse(valid).outputTokens).toBeNull();
  });

  it.each(["inputTokens", "outputTokens"])(
    "rejects zero, fractional, negative and unsafe %s",
    (key) => {
      for (const value of [
        0,
        -1,
        1.5,
        Number.MAX_SAFE_INTEGER + 1,
        NaN,
        Infinity,
      ]) {
        expect(
          MappingRunRecordSchema.safeParse({ ...valid, [key]: value }).success,
        ).toBe(false);
      }
    },
  );

  it("requires every audit field and rejects invalid version, hash and numeric metadata", () => {
    for (const key of Object.keys(valid)) {
      const incomplete: Record<string, unknown> = { ...valid };
      delete incomplete[key];
      expect(MappingRunRecordSchema.safeParse(incomplete).success, key).toBe(
        false,
      );
    }
    for (const mutation of [
      { schemaVersion: "mapping-run/2" },
      { evaluationSet: { ...base.evaluationSet, sha256: "not-a-hash" } },
      { evaluationSet: { ...base.evaluationSet, split: "TEST" } },
      { requestedModel: " " },
      { reportedModel: "" },
      { repeat: 0 },
      { repeat: 1.5 },
      { latencyMs: -1 },
      { latencyMs: 2.5 },
      { latencyMs: Number.MAX_SAFE_INTEGER + 1 },
      { temperature: 0 },
      { temperature: "-0.1" },
      { temperature: "NaN" },
    ]) {
      expect(
        MappingRunRecordSchema.safeParse({ ...valid, ...mutation }).success,
      ).toBe(false);
    }
    expect(
      MappingRunRecordSchema.parse({
        ...valid,
        temperature: "0.00",
        latencyMs: 0,
      }).temperature,
    ).toBe("0");
  });

  it("rejects contradictory outcomes and unsanitized validator reasons", () => {
    for (const record of [
      { ...valid, parsedOutput: null },
      { ...valid, failureClass: "TIMEOUT" },
      { ...valid, validatorReasons: rejected.validatorReasons },
      { ...rejected, validatorReasons: [] },
      { ...rejected, failureClass: "TIMEOUT" },
      { ...rejected, failureClass: "UNPARSEABLE_OUTPUT" },
      { ...rejected, failureClass: "OUTPUT_NOT_RETAINABLE" },
      { ...failed, failureClass: null },
      { ...failed, parsedOutput: valid.parsedOutput },
      { ...failed, validatorReasons: rejected.validatorReasons },
      {
        ...rejected,
        validatorReasons: [{ code: "error: Bearer secret", path: [] }],
      },
      {
        ...rejected,
        validatorReasons: [{ code: "UNKNOWN_TARGET", path: [-1] }],
      },
      {
        ...rejected,
        validatorReasons: [
          { ...rejected.validatorReasons[0], message: "raw provider error" },
        ],
      },
    ]) {
      expect(MappingRunRecordSchema.safeParse(record).success).toBe(false);
    }
  });

  const forbidden = [
    "requestBody",
    "responseEnvelope",
    "headers",
    "requestHeaders",
    "responseHeaders",
    "providerRequestId",
    "requestId",
    "credentials",
    "apiKey",
    "authorization",
    "raw",
    "body",
    "messages",
    "choices",
    "usage",
    "error",
    "runId",
    "startedAt",
  ];
  it.each(forbidden)("rejects %s at all object boundaries", (key) => {
    for (const record of [valid, rejected, failed]) {
      expect(
        MappingRunRecordSchema.safeParse({ ...record, [key]: "private" })
          .success,
      ).toBe(false);
      expect(
        MappingRunRecordSchema.safeParse({
          ...record,
          evaluationSet: { ...base.evaluationSet, [key]: "private" },
        }).success,
      ).toBe(false);
    }
    for (const record of [valid, rejected]) {
      expect(
        MappingRunRecordSchema.safeParse({
          ...record,
          parsedOutput: { ...record.parsedOutput, [key]: "private" },
        }).success,
      ).toBe(false);
      expect(
        MappingRunRecordSchema.safeParse({
          ...record,
          parsedOutput: { fields: [{ ...field, [key]: "private" }] },
        }).success,
      ).toBe(false);
    }
    expect(
      MappingRunRecordSchema.safeParse({
        ...rejected,
        validatorReasons: [
          { ...rejected.validatorReasons[0], [key]: "private" },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects envelopes hidden in declared output fields or supplied as the output", () => {
    const envelope = {
      id: "private-provider-request",
      choices: [{ message: { content: JSON.stringify(valid.parsedOutput) } }],
      headers: { authorization: "Bearer private" },
    };
    for (const record of [valid, rejected]) {
      expect(
        MappingRunRecordSchema.safeParse({ ...record, parsedOutput: envelope })
          .success,
      ).toBe(false);
      for (const key of Object.keys(field)) {
        expect(
          MappingRunRecordSchema.safeParse({
            ...record,
            parsedOutput: { fields: [{ ...field, [key]: envelope }] },
          }).success,
        ).toBe(false);
      }
    }
  });

  it.each(["x", "한", "😀"])(
    "enforces exactly 64 KiB of UTF-8 JSON (%s)",
    (character) => {
      const overhead = new TextEncoder().encode(
        JSON.stringify({ fields: [{ evidence: "" }] }),
      ).byteLength;
      const byteWidth = new TextEncoder().encode(character).byteLength;
      const remaining = MAPPING_RUN_OUTPUT_MAX_BYTES - overhead;
      const evidence =
        character.repeat(Math.floor(remaining / byteWidth)) +
        "x".repeat(remaining % byteWidth);
      const atLimit = { fields: [{ evidence }] };
      expect(new TextEncoder().encode(JSON.stringify(atLimit)).byteLength).toBe(
        MAPPING_RUN_OUTPUT_MAX_BYTES,
      );
      expect(MappingRunStructuredOutputSchema.safeParse(atLimit).success).toBe(
        true,
      );
      expect(
        MappingRunRecordSchema.safeParse({ ...rejected, parsedOutput: atLimit })
          .success,
      ).toBe(true);
      expect(
        MappingRunStructuredOutputSchema.safeParse({
          fields: [{ evidence: evidence + "x" }],
        }).success,
      ).toBe(false);
    },
  );

  it("bounds VALID output too", () => {
    expect(
      MappingRunRecordSchema.safeParse({
        ...valid,
        parsedOutput: {
          fields: [
            { ...field, evidence: "x".repeat(MAPPING_RUN_OUTPUT_MAX_BYTES) },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it("validates a separate strict receipt", () => {
    const receipt = {
      schemaVersion: "mapping-run-receipt/1",
      runId: "synthetic-run-1",
      startedAt: "2026-10-06T00:00:00Z",
      recordHash: "b".repeat(64),
    };
    expect(MappingRunReceiptSchema.parse(receipt)).toEqual(receipt);
    for (const mutation of [
      { recordHash: "bad" },
      { startedAt: "yesterday" },
      { runId: "" },
      { headers: {} },
      { providerRequestId: "private" },
    ]) {
      expect(
        MappingRunReceiptSchema.safeParse({ ...receipt, ...mutation }).success,
      ).toBe(false);
    }
  });
});
