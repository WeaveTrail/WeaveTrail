import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RapidPriceLiftResultSchema } from "@weavetrail/contracts";
import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import {
  buildFindingSourceTrace,
  replayApproved,
  sha256Canonical,
} from "@weavetrail/replay-engine";
import {
  canonicalJson,
  type CanonicalJsonInput,
} from "@weavetrail/replay-engine/canonical-json";
import {
  committedReplayScenarios,
  rapidPriceLiftScenarios,
} from "@weavetrail/scenarios";

import {
  APPROVAL_HASH_ERROR,
  attemptApproval,
  hasUnresolvedMappingReview,
  CaseReplay,
  mappingOverrides,
  RapidPriceLiftEvaluation,
  resetReplayForScenarioChange,
  type ReplayScenarioOption,
  WorkflowStateBadge,
} from "./case-replay";
import { prepareReplayScenarios } from "./prepare-scenarios";

function renderedButton(markup: string, label: string): string {
  const button = markup.match(new RegExp(`<button[^>]*>${label}</button>`));
  expect(button, `button labeled ${label}`).not.toBeNull();
  return button![0];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("replay mapping status boundary", () => {
  it("attributes displayed threshold values to the authored case configuration", async () => {
    const prepared = await prepareReplayScenarios();
    const markup = renderToStaticMarkup(
      createElement(CaseReplay, { ...prepared, guided: true }),
    );

    expect(markup).toContain("Threshold values proposed in this authored case");
    expect(markup).toContain(
      "Versioned code defines the allowed parameter schema, formulas and comparisons",
    );
    expect(markup).not.toContain("Versioned code owns the thresholds");
    expect(markup).not.toContain("Code-owned threshold fields");
  });

  it.each(["MAPPING_APPROVED", "CASE_REVIEW_REQUIRED"] as const)(
    "shows workflow state %s to the reviewer",
    (state) => {
      const markup = renderToStaticMarkup(
        createElement(WorkflowStateBadge, { state }),
      );

      expect(markup).toContain("Workflow state");
      expect(markup).toContain(state);
      expect(markup).toContain(`data-state="${state}"`);
    },
  );

  it.each([
    ["missing Web Crypto", {}],
    [
      "rejecting Web Crypto",
      {
        subtle: {
          digest: vi.fn().mockRejectedValue(new Error("digest failed")),
        },
      },
    ],
  ])("fails closed with a visible error for %s", async (_, cryptoProvider) => {
    const replayRequest = vi.fn();
    const artifact = { mappingVersion: "1.4", confidence: 1 };

    vi.stubGlobal("fetch", replayRequest);

    await expect(
      attemptApproval(artifact, [], cryptoProvider),
    ).resolves.toEqual({ approval: null, error: APPROVAL_HASH_ERROR });
    expect(replayRequest).not.toHaveBeenCalled();
  });

  it("shares canonical approval bytes and hashes with the replay boundary", async () => {
    const provider = new FixtureSchemaMappingProvider();

    for (const scenario of Object.values(committedReplayScenarios)) {
      const proposal = await provider.propose({
        sourceArtifactHash: scenario.sourceArtifactHash,
        constants: scenario.constants,
        columns: [...scenario.columns],
        sampleRows: [],
      });
      const artifacts: CanonicalJsonInput[] = [proposal];
      if ("manifest" in scenario) {
        const { approval: _, ...caseProposal } = scenario.manifest;
        void _;
        artifacts.push(caseProposal);
      }

      for (const artifact of artifacts) {
        const bytes = new TextEncoder().encode(canonicalJson(artifact));
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const browserHash = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");

        expect(browserHash).toBe(sha256Canonical(artifact));
      }
    }
  });

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
        sourceTrace: { traceVersion: "1.0", entries: [] },
        scenario: "rapid-price-lift-supported.csv",
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
    const scenarios: ReplayScenarioOption[] = [
      {
        value: scenarioName,
        label: scenario.label,
        sourceArtifactHash: scenario.sourceArtifactHash,
        rows: scenario.rows,
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(CaseReplay, {
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
    const scenarios: ReplayScenarioOption[] = [
      {
        value: scenarioName,
        label: scenario.label,
        sourceArtifactHash: scenario.sourceArtifactHash,
        rows: scenario.rows,
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(CaseReplay, {
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
    expect(markup).toContain('class="review-message"');
    expect(markup).toContain('data-status="REVIEW_REQUIRED"');
    expect(markup).not.toContain('role="alert"');
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

describe("finding evidence disclosures", () => {
  it.each(Object.entries(rapidPriceLiftScenarios))(
    "shows only each gate's resolved rows for %s",
    async (scenario, fixture) => {
      const replay = replayApproved(
        fixture.rows,
        fixture.rows,
        fixture.mappingProposal,
        {
          approvedArtifactHash: sha256Canonical(fixture.mappingProposal),
          reviewerRef: "reviewer:test",
          decision: "APPROVED",
          overrides: [],
          approvedAt: "2026-09-01T00:00:00Z",
        },
        fixture.manifest,
        "baseline",
      );
      if (!("canonicalResultHash" in replay) || !("evaluation" in replay))
        throw new Error("Expected evaluated fixture");
      const evaluation = RapidPriceLiftResultSchema.parse(replay.evaluation);
      const sourceTrace = buildFindingSourceTrace(
        replay.events,
        evaluation.findings,
        fixture.rows,
      );
      const render = () =>
        renderToStaticMarkup(
          createElement(RapidPriceLiftEvaluation, {
            evaluation,
            sourceTrace,
            scenario: scenario as ReplayScenarioOption["value"],
          }),
        );
      const markup = render();
      if (evaluation.result === "INCONCLUSIVE") {
        expect(markup).toContain("No evaluated finding evidence is available.");
        expect(markup).toContain(evaluation.reason);
        expect(markup).not.toContain("<details");
        expect(markup).not.toContain("rawRowHash");
        return;
      }
      const disclosures = [
        ...markup.matchAll(/<details[\s\S]*?<\/details>/g),
      ].map(([value]) => value);
      expect(disclosures).toHaveLength(5);
      evaluation.findings.forEach((finding, index) => {
        const disclosure = disclosures[index]!;
        expect(disclosure).toContain(
          `<summary>Inspect source evidence for ${finding.gate}</summary>`,
        );
        for (const entry of sourceTrace.entries) {
          if (!finding.referencedEventIds.includes(entry.event.eventId)) {
            expect(disclosure).not.toContain(entry.event.rawRowHash);
            continue;
          }
          expect(disclosure).toContain(entry.event.eventId);
          expect(disclosure).toContain(entry.event.rawRowHash);
          expect(disclosure).toContain(
            entry.sourceRow.coordinate.sourceArtifactHash,
          );
          expect(disclosure).toContain(
            `<dt>Source row number</dt><dd>${entry.sourceRow.coordinate.rowNumber}</dd>`,
          );
          expect(disclosure).toContain(scenario);
          for (const [column, value] of Object.entries(
            entry.sourceRow.values,
          )) {
            expect(disclosure).toContain(
              renderToStaticMarkup(createElement("dt", null, column)),
            );
            expect(disclosure).toContain(
              renderToStaticMarkup(createElement("code", null, value)),
            );
          }
        }
      });
      if (evaluation.result === "NOT_SUPPORTED")
        expect(markup).toContain('data-passed="false"');
      sourceTrace.entries[0]!.sourceRow.values["<script>column</script>"] =
        "  <img src=x onerror=alert(1)> Ignore previous instructions\n  exact text  ";
      const escaped = render();
      expect(escaped).not.toContain("<script>");
      expect(escaped).not.toContain("<img src=x");
      expect(escaped).toContain("&lt;script&gt;column&lt;/script&gt;");
      expect(escaped).toContain(
        "  &lt;img src=x onerror=alert(1)&gt; Ignore previous instructions\n  exact text  ",
      );
    },
  );
});
