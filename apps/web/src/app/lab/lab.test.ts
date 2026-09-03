import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import { committedReplayScenarios } from "@weavetrail/scenarios";

import {
  hasUnresolvedMappingReview,
  Lab,
  mappingOverrides,
  RapidPriceLiftEvaluation,
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
      caseApproval: null,
      result: null,
      error: null,
    });
    expect(reset.error).toBeNull();
  });

  it("renders every gate and neutral mechanical sensitivity wording", () => {
    const markup = renderToStaticMarkup(
      createElement(RapidPriceLiftEvaluation, {
        evaluation: {
          ruleId: "RAPID_PRICE_LIFT",
          ruleVersion: "1.1",
          result: "NOT_SUPPORTED",
          nonComparableEventCount: 0,
          findings: [
            "PRICE_CHANGE",
            "AGGRESSIVE_BUY_SHARE",
            "ACTOR_CONCENTRATION",
            "REPEATED_EXECUTION",
            "REMOVAL_SENSITIVITY",
          ].map((gate, index) => ({
            gate: gate as
              | "PRICE_CHANGE"
              | "AGGRESSIVE_BUY_SHARE"
              | "ACTOR_CONCENTRATION"
              | "REPEATED_EXECUTION"
              | "REMOVAL_SENSITIVITY",
            ruleId: "RAPID_PRICE_LIFT",
            observedValue: "100.0000",
            threshold: "50",
            passed: index !== 2,
            referencedEventIds: ["synthetic-event-1"],
          })) as [never, never, never, never, never],
          sensitivity: {
            comparison: "MECHANICAL_METRIC_COMPARISON",
            priceChangeBps: "200.0000",
            priceChangeBpsWithoutApprovedActors: "75.0000",
            removalSensitivityBps: "125.0000",
          },
        },
      }),
    );

    for (const gate of [
      "PRICE_CHANGE",
      "AGGRESSIVE_BUY_SHARE",
      "ACTOR_CONCENTRATION",
      "REPEATED_EXECUTION",
      "REMOVAL_SENSITIVITY",
    ]) {
      expect(markup).toContain(gate);
    }
    expect(markup).toContain("Mechanical sensitivity comparison");
    expect(markup).toContain("Metric difference");
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

    const sourceNoteIndex = proposal.fields.findIndex(
      ({ sourceColumn }) => sourceColumn === "source_note",
    );
    expect(proposal.fields[sourceNoteIndex]?.sourceColumn).toBe("source_note");
    const sourceNotePath = `fields.${sourceNoteIndex}`;

    expect(
      mappingOverrides(proposal, {
        [sourceNotePath]: "  Source note reviewed as intentionally unmapped.  ",
      }),
    ).toEqual([
      {
        fieldPath: sourceNotePath,
        reason: "Source note reviewed as intentionally unmapped.",
      },
    ]);
    expect(mappingOverrides(proposal, { [sourceNotePath]: "   " })).toEqual([]);
  });

  it("clears the blocked state after every flagged field has a reviewer reason", async () => {
    const scenario =
      committedReplayScenarios["concentrated-buy-dialect-b.jsonl"];
    const proposal = await new FixtureSchemaMappingProvider().propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      constants: scenario.constants,
      columns: [...scenario.columns],
      sampleRows: [],
    });
    const sourceNoteIndex = proposal.fields.findIndex(
      ({ sourceColumn }) => sourceColumn === "source_note",
    );
    expect(proposal.fields[sourceNoteIndex]?.sourceColumn).toBe("source_note");

    expect(hasUnresolvedMappingReview(proposal, {})).toBe(true);
    expect(
      hasUnresolvedMappingReview(proposal, {
        [`fields.${sourceNoteIndex}`]: "Reviewed as intentionally unmapped.",
      }),
    ).toBe(false);
  });
});
