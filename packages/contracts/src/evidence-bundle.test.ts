import { describe, expect, it } from "vitest";

import migrationVectors from "../../../test-fixtures/evidence-bundle-migration.json";

import { EvidenceBundleSchema } from "./evidence-bundle";

const HASH = "a".repeat(64);

const bundle = {
  bundleVersion: "1.2",
  caseId: "synthetic-case",
  canonicalDatasetHash: HASH,
  sourceArtifacts: [{ sourceArtifactHash: HASH }],
  manifestHash: HASH,
  engineVersion: "0.7.0-canonical-decimal",
  ruleVersion: "1.1",
  result: "SUPPORTED",
  findings: [],
  sensitivity: {
    comparison: "MECHANICAL_METRIC_COMPARISON",
    priceChangeBps: "125.0000",
    priceChangeBpsWithoutApprovedActors: "25.0000",
    removalSensitivityBps: "-100.0000",
  },
  canonicalResultHash: HASH,
} as const;

describe("Evidence Bundle 1.2 migration", () => {
  it.each(["SUPPORTED", "NOT_SUPPORTED"] as const)(
    "accepts the shared sensitivity shape for %s results",
    (result) => {
      const input = { ...bundle, result };

      expect(EvidenceBundleSchema.parse(input)).toEqual(input);
    },
  );

  it.each(migrationVectors.candidates)(
    "rejects $name",
    ({ input, expectedPath }) => {
      const parsed = EvidenceBundleSchema.safeParse(input);

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map((issue) => issue.path)).toContainEqual(
          expectedPath,
        );
      }
    },
  );

  it.each(migrationVectors.removedNestedMembers)(
    "rejects a removed nested member %s",
    (member) => {
      const parsed = EvidenceBundleSchema.safeParse({
        ...bundle,
        sensitivity: { ...bundle.sensitivity, [member]: "0" },
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map((issue) => issue.path)).toContainEqual([
          "sensitivity",
        ]);
      }
    },
  );

  it.each([
    [undefined, ["sensitivity", "comparison"]],
    ["METRIC_COMPARISON", ["sensitivity", "comparison"]],
    ["MECHANICAL_METRIC_COMPARISON", []],
  ])("requires the comparison marker %s", (comparison, expectedPath) => {
    const sensitivity = { ...bundle.sensitivity, comparison };
    if (comparison === undefined) {
      delete (sensitivity as { comparison?: string }).comparison;
    }

    const parsed = EvidenceBundleSchema.safeParse({ ...bundle, sensitivity });

    expect(parsed.success).toBe(expectedPath.length === 0);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path)).toContainEqual(
        expectedPath,
      );
    }
  });

  it.each([
    ["0", true],
    ["-100.25", true],
    [1, false],
    ["1e2", false],
    ["01", false],
    ["-", false],
  ])(
    "uses the shared signed decimal validation for metric values: %s",
    (metric, expected) => {
      const parsed = EvidenceBundleSchema.safeParse({
        ...bundle,
        sensitivity: { ...bundle.sensitivity, removalSensitivityBps: metric },
      });

      expect(parsed.success).toBe(expected);
    },
  );

  it("rejects unrelated unknown top-level and nested keys", () => {
    expect(
      EvidenceBundleSchema.safeParse({ ...bundle, unexpected: true }).success,
    ).toBe(false);
    expect(
      EvidenceBundleSchema.safeParse({
        ...bundle,
        sourceArtifacts: [{ sourceArtifactHash: HASH, unexpected: true }],
      }).success,
    ).toBe(false);
  });
});
