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
  flaggedMappingFields,
  hasUnresolvedMappingReview,
  CaseReplay,
  mappingOverrides,
  unresolvedMappingFields,
  RapidPriceLiftEvaluation,
  resetReplayForScenarioChange,
  type ReplayScenarioOption,
  WorkflowStateBadge,
} from "./case-replay";
import { prepareReplayScenarios } from "./prepare-scenarios";
import { ReplayLanguageContext } from "./replay-language";
import { scenarioOptionLabel } from "./scenario-labels";

function renderedButton(markup: string, label: string): string {
  const button = markup.match(new RegExp(`<button[^>]*>${label}</button>`));
  expect(button, `button labeled ${label}`).not.toBeNull();
  return button![0];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("replay mapping status boundary", () => {
  it("renders the guided control surface in Korean when requested", async () => {
    const prepared = await prepareReplayScenarios();
    const markup = renderToStaticMarkup(
      createElement(CaseReplay, { ...prepared, guided: true, language: "ko" }),
    );
    // The Korean surface names each thing the way the product's own screens
    // name it, so a Korean reader never meets a step in one vocabulary and the
    // control that performs it in another.
    expect(markup).toContain("커밋된 원본 거래자료");
    expect(markup).toContain("데이터 항목 연결 제안");
    expect(markup).toContain("연결 제안 승인");
    expect(markup).toContain("분석 실행");
    expect(markup).toContain("조사 범위 승인");
    expect(markup).toContain("판단 근거 확인");
    // The rail leads with where the visitor is and what to do here.
    expect(markup).toContain("7단계 중 1단계");
    expect(markup).toContain(
      '<p class="step-instruction">아래 원본 거래자료의 열 이름과 값을 훑어본 뒤 계속하세요.</p>',
    );
  });

  it("names every committed source in Korean in the source list", async () => {
    // The visitor is told which source to pick. A source that keeps its
    // English committed label in the Korean list is one they cannot find.
    const { scenarios } = await prepareReplayScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
    for (const { value, label, provenance } of scenarios) {
      const korean = scenarioOptionLabel(
        value,
        label,
        provenance?.kind ?? "synthetic",
        "ko",
      );
      expect(/[가-힣]/.test(korean), value).toBe(true);
      expect(korean, value).not.toContain(label);
      expect(
        scenarioOptionLabel(
          value,
          label,
          provenance?.kind ?? "synthetic",
          "en",
        ),
        value,
      ).toContain(label);
    }
  });

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

  it("explains every workflow state it can render, in both languages", async () => {
    const { WorkflowStateSchema } = await import("@weavetrail/contracts");
    // The badge prints the contract's own code. A partial table left the
    // refusal states — CASE_REVIEW_REQUIRED among them — showing a bare code
    // with nothing saying what it is.
    for (const language of ["en", "ko"] as const)
      for (const state of WorkflowStateSchema.options) {
        const markup = renderToStaticMarkup(
          createElement(
            ReplayLanguageContext.Provider,
            { value: language },
            createElement(WorkflowStateBadge, { state }),
          ),
        );
        expect(markup, `${language} ${state}`).toContain(
          `<code>${state}</code>`,
        );
        const meaning = markup.slice(markup.indexOf("<small>"));
        expect(meaning, `${language} ${state}`).toMatch(/<small>.+<\/small>/);
      }
  });

  it("does not call a refused proposal a flagged field", async () => {
    // MAPPING_REVIEW_REQUIRED is also set when a proposal is rejected or never
    // obtained, which produces no fields at all, so the sentence cannot send
    // the reader looking for review work that does not exist.
    for (const [language, pattern] of [
      ["en", /no validated proposal/],
      ["ko", /검증을 통과한 제안/],
    ] as const) {
      const markup = renderToStaticMarkup(
        createElement(
          ReplayLanguageContext.Provider,
          { value: language },
          createElement(WorkflowStateBadge, {
            state: "MAPPING_REVIEW_REQUIRED" as const,
          }),
        ),
      );
      expect(markup, language).toMatch(pattern);
    }
  });

  it("names the fields that block approval, in the order their rows appear", async () => {
    const scenario =
      committedReplayScenarios["published-execution-h0stcnt0.jsonl"];
    const proposal = await new FixtureSchemaMappingProvider().propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      constants: scenario.constants,
      columns: [...scenario.columns],
      sampleRows: [],
    });

    const flagged = flaggedMappingFields(proposal);
    expect(flagged.length).toBeGreaterThan(0);
    // The summary, the blocked check and the overrides an approval carries all
    // read this one list, so a field cannot be named in one and missed by
    // another. Mapped fields come before absent ones, matching the rows.
    expect(flagged.map(({ fieldPath }) => fieldPath)).toEqual(
      mappingOverrides(
        proposal,
        Object.fromEntries(flagged.map(({ fieldPath }) => [fieldPath, "why"])),
      ).map(({ fieldPath }) => fieldPath),
    );
    for (const { label } of flagged) expect(label).toBeTruthy();

    // Answering one field removes it from what is still waiting, and nothing
    // else moves.
    const first = flagged[0]!;
    const remaining = unresolvedMappingFields(proposal, {
      [first.fieldPath]: "reviewed",
    });
    expect(remaining.map(({ fieldPath }) => fieldPath)).toEqual(
      flagged.slice(1).map(({ fieldPath }) => fieldPath),
    );
    expect(unresolvedMappingFields(proposal, {})).toEqual(flagged);
  });

  it("puts the blocking fields above the proposal and points at their inputs", async () => {
    const scenario =
      committedReplayScenarios["published-execution-h0stcnt0.jsonl"];
    const proposal = await new FixtureSchemaMappingProvider().propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      constants: scenario.constants,
      columns: [...scenario.columns],
      sampleRows: [],
    });
    const markup = renderToStaticMarkup(
      createElement(CaseReplay, {
        providerMode: "fixture",
        proposals: { [scenario.sourceArtifactHash]: proposal },
        scenarios: [
          {
            value: "published-execution-h0stcnt0.jsonl",
            label: scenario.label,
            sourceArtifactHash: scenario.sourceArtifactHash,
            rows: scenario.rows,
          },
        ],
      }),
    );

    // The summary comes before the rows it names, so the work is reachable
    // without scrolling the whole proposal first.
    const summary = markup.indexOf('class="review-summary"');
    const firstRow = markup.indexOf('class="mapping-row"');
    expect(summary).toBeGreaterThan(-1);
    expect(firstRow).toBeGreaterThan(summary);
    // Every proposed field is still rendered: the blocking ones are named,
    // not the rest hidden.
    expect(markup).toContain("mapping-row");
    for (const { fieldPath } of flaggedMappingFields(proposal))
      expect(markup).toContain(
        `id="mapping-review-case-${fieldPath.replace(".", "-")}"`,
      );
    // An input that still blocks the step says so where it sits.
    expect(markup).toContain('data-review-unresolved="true"');
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

  it("records and renders a review reason for an absent published actor field", async () => {
    const scenario =
      committedReplayScenarios["published-execution-h0stcnt0.jsonl"];
    const proposal = await new FixtureSchemaMappingProvider().propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      constants: scenario.constants,
      columns: [...scenario.columns],
      sampleRows: [],
    });
    const path = "unmappedFields.0";

    expect(hasUnresolvedMappingReview(proposal, {})).toBe(true);
    expect(
      mappingOverrides(proposal, {
        [path]: "  Source schema has no participant field.  ",
      }),
    ).toEqual([
      {
        fieldPath: path,
        reason: "Source schema has no participant field.",
      },
    ]);
    expect(
      hasUnresolvedMappingReview(proposal, {
        [path]: "Source schema has no participant field.",
      }),
    ).toBe(false);

    const markup = renderToStaticMarkup(
      createElement(CaseReplay, {
        providerMode: "fixture",
        proposals: { [scenario.sourceArtifactHash]: proposal },
        scenarios: [
          {
            value: "published-execution-h0stcnt0.jsonl",
            label: scenario.label,
            sourceArtifactHash: scenario.sourceArtifactHash,
            rows: scenario.rows,
          },
        ],
      }),
    );
    expect(markup).toContain("Composite execution time");
    expect(markup).toContain("source field absent");
    expect(markup).toContain('aria-label="Reviewer reason for actorId"');
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
      // Each gate row carries one evidence disclosure, which itself nests one
      // full-value disclosure per displayed hash, so slice by gate row rather
      // than by the first closing tag.
      const disclosures = markup
        .split('<div class="gate-row"')
        .slice(1)
        .map((chunk) => chunk);
      expect(disclosures).toHaveLength(5);
      for (const disclosure of disclosures)
        expect([
          ...disclosure.matchAll(/<details class="source-evidence"/g),
        ]).toHaveLength(1);
      evaluation.findings.forEach((finding, index) => {
        const disclosure = disclosures[index]!;
        // The first disclosure carries the id the step rail sends a visitor
        // to; the rest carry none. The summary also says what opening it
        // shows, so the name is asserted rather than the whole element.
        expect(disclosure).toContain(
          index === 0
            ? `<summary id="guide-target-evidence">Inspect source evidence for ${finding.gate}`
            : `<summary>Inspect source evidence for ${finding.gate}`,
        );
        expect(disclosure).toContain(
          "The canonical events this check counted, and the committed source row behind each one.",
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
