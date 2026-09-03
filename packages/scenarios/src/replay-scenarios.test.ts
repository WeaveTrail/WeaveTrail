import { describe, expect, it } from "vitest";

import { committedReplayScenarios } from "./replay-scenarios";
import {
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
} from "./source-mappings";

describe("committed replay scenarios", () => {
  it("binds dialect A to its artifact-derived committed event set", () => {
    const scenario = committedReplayScenarios["concentrated-buy-dialect-a.csv"];

    expect(scenario.sourceArtifactHash).toBe(
      concentratedBuyDialectAMapping.sourceArtifactHash,
    );
    expect(scenario.rows).toHaveLength(4);
  });

  it("does not fall back to dialect A events for dialect B", () => {
    const scenario =
      committedReplayScenarios["concentrated-buy-dialect-b.jsonl"];

    expect(scenario.sourceArtifactHash).toBe(
      concentratedBuyDialectBMapping.sourceArtifactHash,
    );
    expect(scenario).not.toHaveProperty("events");
  });

  it.each([
    ["rapid-price-lift-supported.csv", "SUPPORTED", 6],
    ["rapid-price-lift-broad-participation.csv", "NOT_SUPPORTED", 6],
    ["rapid-price-lift-insufficient-evidence.csv", "INCONCLUSIVE", 4],
  ] as const)(
    "declares bounded rows, mapping, and approved manifest for %s",
    (name, expectedResult, rowCount) => {
      const scenario = committedReplayScenarios[name];

      expect(scenario.rows).toHaveLength(rowCount);
      expect(scenario.expectedResult).toBe(expectedResult);
      expect(scenario.mappingProposal.sourceArtifactHash).toBe(
        scenario.sourceArtifactHash,
      );
      expect(scenario.manifest.canonicalDatasetHash).toMatch(/^[a-f0-9]{64}$/);
      expect(scenario.manifest.approval.decision).toBe("APPROVED");
      expect(scenario.manifest.aiTrace.confidence).toBe(1);
    },
  );
});
