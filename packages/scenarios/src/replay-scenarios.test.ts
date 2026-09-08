import { describe, expect, it } from "vitest";
import { ReplayScenarioSchema } from "@weavetrail/contracts";

import {
  committedReplayScenarios,
  replayScenarioCatalog,
  reviewerFacingReplayScenarios,
} from "./replay-scenarios";
import {
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
} from "./source-mappings";

describe("committed replay scenarios", () => {
  it("classifies every source without removing regression fixtures from the contract", () => {
    expect(Object.keys(replayScenarioCatalog)).toEqual(
      Object.keys(committedReplayScenarios),
    );
    for (const [name, metadata] of Object.entries(replayScenarioCatalog)) {
      expect(ReplayScenarioSchema.parse(name)).toBe(name);
      expect(metadata.availableMutations).toContain("baseline");
    }
    expect(
      Object.entries(replayScenarioCatalog)
        .filter(([, metadata]) => metadata.availableInCaseReplay)
        .map(([name]) => name),
    ).toEqual(Object.keys(reviewerFacingReplayScenarios));
  });

  it("exports only synthetic sources from the synthetic scenario registry", () => {
    expect(
      Object.values(committedReplayScenarios).map(
        ({ provenance }) => provenance.kind,
      ),
    ).toEqual(Object.values(committedReplayScenarios).map(() => "synthetic"));
  });
  it("binds dialect A to its artifact-derived committed event set", () => {
    const scenario = committedReplayScenarios["concentrated-buy-dialect-a.csv"];

    expect(scenario.sourceArtifactHash).toBe(
      concentratedBuyDialectAMapping.sourceArtifactHash,
    );
    expect(scenario.rows).toHaveLength(4);
  });

  it("registers an actorless source with two declared instruments", () => {
    const scenario =
      committedReplayScenarios["actorless-multi-instrument-quotes.jsonl"];

    expect(scenario.rows.map(({ values }) => values.instrument)).toEqual([
      "WT-MARKET-A",
      "WT-MARKET-B",
    ]);
    expect(scenario.mappingProposal.constants.schemaVersion).toBe("1.2");
    if (scenario.mappingProposal.constants.schemaVersion !== "1.2") {
      throw new Error("Expected the actorless source to use daily constants");
    }
    expect(scenario.mappingProposal.constants.eventType).toBe("DAILY_QUOTE");
    expect(scenario).not.toHaveProperty("manifest");
  });

  it("does not fall back to dialect A events for dialect B", () => {
    const scenario =
      committedReplayScenarios["concentrated-buy-dialect-b.jsonl"];

    expect(scenario.sourceArtifactHash).toBe(
      concentratedBuyDialectBMapping.sourceArtifactHash,
    );
    expect(scenario).not.toHaveProperty("events");
  });

  it("registers both published-schema projections as synthetic sources", () => {
    const fix = committedReplayScenarios["published-execution-fix44.csv"];
    const h0stcnt0 =
      committedReplayScenarios["published-execution-h0stcnt0.jsonl"];

    expect(fix.rows).toHaveLength(6);
    expect(fix.expectedResult).toBe("SUPPORTED");
    expect(fix.label).toContain("Synthetic");
    expect(h0stcnt0.rows).toHaveLength(6);
    expect(h0stcnt0.label).toContain("Synthetic");
    expect(h0stcnt0).not.toHaveProperty("manifest");
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
      expect(scenario.expectedWorkflowState).toBe("REPLAYED");
      expect(scenario.demonstrates).not.toHaveLength(0);
      expect(scenario.mappingProposal.sourceArtifactHash).toBe(
        scenario.sourceArtifactHash,
      );
      expect(scenario.manifest.canonicalDatasetHash).toMatch(/^[a-f0-9]{64}$/);
      expect(scenario.manifest.approval.decision).toBe("APPROVED");
      expect(scenario.manifest.aiTrace.confidence).toBe(1);
    },
  );

  it("states the missing-evidence condition with its expected abstention", () => {
    const scenario =
      committedReplayScenarios["rapid-price-lift-insufficient-evidence.csv"];

    expect(scenario.expectedWorkflowState).toBe("REPLAYED");
    expect(scenario.expectedInconclusiveReason).toBe(
      "INSUFFICIENT_ELIGIBLE_EVENTS",
    );
    expect(scenario.expectedNonComparableEventCount).toBe(4);
    expect(scenario.demonstrates).toContain("lacks Side(54)");
  });

  it("states the conflicting-evidence review outcome with the source", () => {
    const scenario =
      committedReplayScenarios[
        "published-execution-fix44-conflicting-evidence.csv"
      ];

    expect(scenario.expectedWorkflowState).toBe("INPUT_REVIEW_REQUIRED");
    expect(scenario.expectedReviewCode).toBe("CONFLICTING_SOURCE_IDENTITY");
    expect(scenario).not.toHaveProperty("manifest");
    expect(scenario).not.toHaveProperty("expectedResult");
    expect(scenario.demonstrates).toContain("ExecID(17) 120001");
  });
});
