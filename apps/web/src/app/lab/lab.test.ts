import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import { committedReplayScenarios } from "@weavetrail/scenarios";

import {
  Lab,
  mappingOverrides,
  resetReplayForScenarioChange,
  type LabScenario,
} from "./lab";

function renderedButton(markup: string, label: string): string {
  const button = markup.match(new RegExp(`<button[^>]*>${label}</button>`));
  expect(button, `button labeled ${label}`).not.toBeNull();
  return button![0];
}

describe("lab mapping status boundary", () => {
  it("clears a failed replay error when switching scenarios", () => {
    const failedReplay = { error: "Dialect B replay failed" };

    const reset = {
      ...failedReplay,
      ...resetReplayForScenarioChange("concentrated-buy-dialect-a.csv"),
    };

    expect(reset).toMatchObject({
      scenario: "concentrated-buy-dialect-a.csv",
      approval: null,
      result: null,
      error: null,
    });
    expect(reset.error).toBeNull();
  });

  it("offers mapping approval for dialect A without a blocked banner", async () => {
    const scenarioName = "concentrated-buy-dialect-a.csv";
    const scenario = committedReplayScenarios[scenarioName];
    const proposal = await new FixtureSchemaMappingProvider().propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      constants: scenario.constants,
      columns: [...scenario.columns],
      sampleRows: [],
    });
    const scenarios: LabScenario[] = [
      {
        value: scenarioName,
        label: scenario.label,
        sourceArtifactHash: scenario.sourceArtifactHash,
        rows: scenario.rows,
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
    expect(markup).toContain("Approve executed mapping");
    expect(renderedButton(markup, "Approve executed mapping")).not.toContain(
      "disabled",
    );
    expect(renderedButton(markup, "Run deterministic replay")).toContain(
      "disabled",
    );
  });

  it("requires a reviewer reason before offering mapping approval for dialect B", async () => {
    const scenarioName = "concentrated-buy-dialect-b.jsonl";
    const scenario = committedReplayScenarios[scenarioName];
    const proposal = await new FixtureSchemaMappingProvider().propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      constants: scenario.constants,
      columns: [...scenario.columns],
      sampleRows: [],
    });
    const scenarios: LabScenario[] = [
      {
        value: scenarioName,
        label: scenario.label,
        sourceArtifactHash: scenario.sourceArtifactHash,
        rows: scenario.rows,
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
    expect(markup).toContain("Reviewer reason for source_note");
    expect(markup).toContain(
      "Replay is blocked until every flagged field has a reviewer reason.",
    );
    expect(renderedButton(markup, "Approve executed mapping")).toContain(
      "disabled",
    );
    expect(renderedButton(markup, "Run deterministic replay")).toContain(
      "disabled",
    );
  });

  it("records the reviewer's source_note reason in the dialect B override", async () => {
    const scenario =
      committedReplayScenarios["concentrated-buy-dialect-b.jsonl"];
    const proposal = await new FixtureSchemaMappingProvider().propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      constants: scenario.constants,
      columns: [...scenario.columns],
      sampleRows: [],
    });

    expect(
      mappingOverrides(proposal, {
        "fields.12": "  Source note reviewed as intentionally unmapped.  ",
      }),
    ).toEqual([
      {
        fieldPath: "fields.12",
        reason: "Source note reviewed as intentionally unmapped.",
      },
    ]);
    expect(mappingOverrides(proposal, { "fields.12": "   " })).toEqual([]);
  });
});
