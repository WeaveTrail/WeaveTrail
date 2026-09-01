import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import { committedReplayScenarios } from "@weavetrail/scenarios";

import { Lab, type LabScenario } from "./lab";

describe("lab mapping status boundary", () => {
  it("enables replay for a proposed mapping without rendering a blocked banner", async () => {
    const scenarioName = "concentrated-buy-dialect-a.csv";
    const scenario = committedReplayScenarios[scenarioName];
    const proposal = await new FixtureSchemaMappingProvider().propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      columns: [...scenario.columns],
      sampleRows: [],
    });
    const scenarios: LabScenario[] = [
      {
        value: scenarioName,
        label: scenario.label,
        sourceArtifactHash: scenario.sourceArtifactHash,
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(Lab, {
        proposals: { [scenario.sourceArtifactHash]: proposal },
        providerMode: "fixture",
        scenarios,
      }),
    );

    expect(markup).toContain("PROPOSED");
    expect(markup).not.toContain("APPROVED");
    expect(markup).not.toContain("Replay is blocked");
    expect(markup).not.toMatch(/<button[^>]*disabled=""/);
  });

  it("disables replay for a review-required proposal without rendering approval", async () => {
    const scenarioName = "concentrated-buy-dialect-b.jsonl";
    const scenario = committedReplayScenarios[scenarioName];
    const proposal = await new FixtureSchemaMappingProvider().propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      columns: [...scenario.columns],
      sampleRows: [],
    });
    const scenarios: LabScenario[] = [
      {
        value: scenarioName,
        label: scenario.label,
        sourceArtifactHash: scenario.sourceArtifactHash,
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(Lab, {
        proposals: { [scenario.sourceArtifactHash]: proposal },
        providerMode: "fixture",
        scenarios,
      }),
    );

    expect(markup).toContain("REVIEW_REQUIRED");
    expect(markup).not.toContain("APPROVED");
    expect(markup).toMatch(/<button[^>]*disabled=""/);
  });
});
