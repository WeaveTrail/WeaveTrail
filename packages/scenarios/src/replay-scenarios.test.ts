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
    expect(scenario.events).toHaveLength(4);
  });

  it("does not fall back to dialect A events for dialect B", () => {
    const scenario =
      committedReplayScenarios["concentrated-buy-dialect-b.jsonl"];

    expect(scenario.sourceArtifactHash).toBe(
      concentratedBuyDialectBMapping.sourceArtifactHash,
    );
    expect(scenario).not.toHaveProperty("events");
  });
});
