import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  RapidPriceLiftResultSchema,
  type ApprovalRecord,
  type SchemaMappingProposal,
  type SourceTrace,
} from "@weavetrail/contracts";
import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import {
  buildFindingSourceTrace,
  replayApproved,
  sha256Canonical,
} from "@weavetrail/replay-engine";
import {
  committedReplayScenarios,
  rapidPriceLiftScenarios,
} from "@weavetrail/scenarios";

import {
  ApprovalReceipt,
  mappingApprovalCoverage,
  RapidPriceLiftEvaluation,
  type ReplayScenarioOption,
} from "./case-replay";
import { GATE_READINGS, GATE_READINGS_KO } from "./machine-values";
import {
  ApprovedMappingTrace,
  checksForLine,
  checksForRow,
  EvidenceLines,
  mappingRowId,
  mappingTraceRows,
} from "./mapping-trace";
import { ReplayLanguageContext } from "./replay-language";

function approvalOf(
  proposal: SchemaMappingProposal,
  overrides: ApprovalRecord["overrides"] = [],
): ApprovalRecord {
  return {
    approvedArtifactHash: sha256Canonical(proposal),
    reviewerRef: "reviewer:test",
    decision: "APPROVED",
    overrides,
    approvedAt: "2026-09-01T00:00:00Z",
  };
}

function inLanguage(
  language: "en" | "ko",
  element: ReturnType<typeof createElement>,
) {
  return renderToStaticMarkup(
    createElement(ReplayLanguageContext.Provider, { value: language }, element),
  );
}

const evaluated = Object.entries(rapidPriceLiftScenarios).flatMap(
  ([scenario, fixture]) => {
    const approval = approvalOf(fixture.mappingProposal);
    const replay = replayApproved(
      fixture.rows,
      fixture.rows,
      fixture.mappingProposal,
      approval,
      fixture.manifest,
      "baseline",
    );
    if (!("canonicalResultHash" in replay) || !("evaluation" in replay))
      return [];
    const evaluation = RapidPriceLiftResultSchema.parse(replay.evaluation);
    if (evaluation.result === "INCONCLUSIVE") return [];
    const sourceTrace = buildFindingSourceTrace(
      replay.events,
      evaluation.findings,
      fixture.rows,
    );
    return [
      {
        scenario: scenario as ReplayScenarioOption["value"],
        proposal: fixture.mappingProposal,
        approval,
        evaluation,
        sourceTrace,
      },
    ];
  },
);

describe("finding evidence traced through the approved mapping", () => {
  it("has evaluated scenarios to trace", () => {
    expect(evaluated.length).toBeGreaterThan(0);
  });

  it.each(evaluated.map((entry) => [entry.scenario, entry] as const))(
    "links every evidence line of %s to its approved mapping row and back",
    (scenario, { proposal, approval, evaluation, sourceTrace }) => {
      const rows = mappingTraceRows(proposal, approval);
      // One row per field the proposal maps or declares absent, read as
      // proposed: nothing added, dropped or renamed.
      expect(rows.filter(({ key }) => key.startsWith("fields-"))).toEqual(
        proposal.fields.map((field, index) =>
          expect.objectContaining({
            key: `fields-${index}`,
            sourceColumns: [field.sourceColumn],
            targetField: field.targetField,
            transform: field.transform,
            evidence: field.evidence,
          }),
        ),
      );
      const markup = inLanguage(
        "en",
        createElement(RapidPriceLiftEvaluation, {
          evaluation,
          sourceTrace,
          scenario,
          mapping: { proposal, approval },
        }),
      );
      for (const row of rows) {
        const id = mappingRowId(row.key);
        expect(markup.split(`id="${id}"`)).toHaveLength(2);
        expect(markup).toContain(
          `data-target-field="${row.targetField ?? ""}" data-transform="${row.transform ?? ""}" id="${id}"`,
        );
      }
      const lines = [...markup.matchAll(/data-mapping-row="([^"]+)"/g)].map(
        ([, key]) => key,
      );
      const referenced = evaluation.findings.reduce(
        (count, finding) => count + finding.referencedEventIds.length,
        0,
      );
      expect(lines).toHaveLength(rows.length * referenced);
      expect(new Set(lines)).toEqual(new Set(rows.map(({ key }) => key)));
      for (const key of lines)
        expect(markup).toContain(`href="#${mappingRowId(key!)}"`);

      for (const row of rows)
        for (const entry of sourceTrace.entries) {
          const checks = checksForLine(row, entry, evaluation.findings);
          // A line names exactly the checks that counted its event, read
          // from the server's references.
          expect(checks.map(({ gate }) => gate)).toEqual(
            row.targetField === null
              ? []
              : evaluation.findings
                  .filter(({ referencedEventIds }) =>
                    referencedEventIds.includes(entry.event.eventId),
                  )
                  .map(({ gate }) => gate),
          );
          // Each check a line names is reachable from the line's mapping row.
          const rowChecks = checksForRow(row, sourceTrace, evaluation.findings);
          for (const check of checks) expect(rowChecks).toContain(check);
        }
      for (const finding of evaluation.findings)
        expect(markup).toContain(`id="gate-${finding.gate}" tabindex="-1"`);
      for (const [, gate] of markup.matchAll(/href="#gate-([A-Z_]+)"/g))
        expect(markup).toContain(`id="gate-${gate}"`);
    },
  );

  it("shows the source value, approved target and the canonical value as returned", () => {
    const { proposal, approval, evaluation, sourceTrace } = evaluated[0]!;
    const rows = mappingTraceRows(proposal, approval);
    const entry = sourceTrace.entries[0]!;
    const markup = inLanguage(
      "en",
      createElement(EvidenceLines, {
        rows,
        entry,
        findings: evaluation.findings,
      }),
    );
    for (const row of rows.filter(({ targetField }) => targetField !== null)) {
      const line = markup
        .split(`data-mapping-row="${row.key}"`)[1]!
        .split("</li>")[0]!;
      const column = row.sourceColumns![0]!;
      expect(line).toContain(
        `<code>${column}</code> = <code>${entry.sourceRow.values[column]}</code>`,
      );
      expect(line).toContain(`<code>${row.targetField}</code>`);
      expect(line).toContain(`<code>${row.transform}</code>`);
      const value = (entry.event as Record<string, unknown>)[row.targetField!];
      if (typeof value === "string")
        expect(line).toContain(
          `<span class="trace-canonical"><code>${value}</code></span>`,
        );
    }
  });

  it("shows a reviewer reason verbatim on the evidence line and the mapping row", async () => {
    const scenario =
      committedReplayScenarios["concentrated-buy-dialect-b.jsonl"];
    const proposal = await new FixtureSchemaMappingProvider().propose({
      sourceArtifactHash: scenario.sourceArtifactHash,
      constants: scenario.constants,
      columns: [...scenario.columns],
      sampleRows: [],
    });
    const index = proposal.fields.findIndex(
      ({ sourceColumn }) => sourceColumn === "source_note",
    );
    const reason = 'Kept <unmapped> on purpose: "note" & free text';
    const approval = approvalOf(proposal, [
      { fieldPath: `fields.${index}`, reason },
    ]);
    const rows = mappingTraceRows(proposal, approval);
    expect(rows.find(({ key }) => key === `fields-${index}`)?.reason).toBe(
      reason,
    );
    expect(rows.filter(({ reason }) => reason !== null)).toHaveLength(1);

    const row = scenario.rows[0]!;
    const entry: SourceTrace["entries"][number] = {
      event: {
        schemaVersion: "1.1",
        eventId: "event-1",
        sourceEventId: "1",
        datasetId: "dataset",
        venueId: "venue",
        eventTime: "2026-09-01T00:00:00Z",
        sequence: "1",
        instrumentId: "ZZ",
        eventType: "TRADE",
        side: "BUY",
        price: "1",
        quantity: "1",
        rawRowHash: "a".repeat(64),
      } as SourceTrace["entries"][number]["event"],
      sourceRow: {
        coordinate: {
          sourceArtifactHash: scenario.sourceArtifactHash,
          rowNumber: row.coordinate.rowNumber,
        },
        values: row.values,
      },
    };
    const escaped =
      "<q>Kept &lt;unmapped&gt; on purpose: &quot;note&quot; &amp; free text</q>";
    const lines = inLanguage(
      "en",
      createElement(EvidenceLines, { rows, entry, findings: [] }),
    );
    const mapping = inLanguage(
      "en",
      createElement(ApprovedMappingTrace, {
        rows,
        sourceTrace: { traceVersion: "1.0", entries: [entry] },
        findings: [],
      }),
    );
    expect(lines).toContain(`Reviewer reason: ${escaped}`);
    expect(mapping).toContain(`Reviewer reason: ${escaped}`);
    // An unmapped column produces no canonical value and no check used it.
    const line = lines.split(`data-mapping-row="fields-${index}"`)[1]!;
    expect(line.split("</li>")[0]).toContain("no canonical value");
    expect(line.split("</li>")[0]).toContain(
      'Checks that used it: <span class="trace-none">none</span>',
    );
    // Proposal evidence stays the proposal's own text.
    for (const { evidence } of proposal.fields)
      expect(mapping).toContain(
        renderToStaticMarkup(createElement("span", null, evidence)).slice(
          6,
          -7,
        ),
      );
  });

  it("names every part of the trace in Korean without English labels", () => {
    const { scenario, proposal, approval, evaluation, sourceTrace } =
      evaluated[0]!;
    const render = (language: "en" | "ko") =>
      inLanguage(
        language,
        createElement(RapidPriceLiftEvaluation, {
          evaluation,
          sourceTrace,
          scenario,
          mapping: { proposal, approval },
        }),
      );
    const en = render("en");
    const ko = render("ko");
    const english = [
      "Approved mapping behind these findings",
      "Read from the mapping the approval is bound to.",
      "Checks that used it",
      "Go to its mapping row",
      "Proposal evidence, as proposed",
      "Machine values: the canonical event and its committed source row",
    ];
    const korean = [
      "이 판단 근거에 쓰인 데이터 항목 연결",
      "승인이 묶인 연결 제안을 그대로 보여 줍니다.",
      "이 값을 쓴 판단 항목",
      "이 행을 쓴 판단 항목",
      "연결 행으로 이동",
      "제안 원문 근거",
      "기계 값: 정리된 거래 기록과 커밋된 원본 행",
    ];
    for (const text of english) {
      expect(en).toContain(text);
      expect(ko).not.toContain(text);
    }
    for (const text of korean) expect(ko).toContain(text);
    for (const finding of evaluation.findings) {
      const gate = finding.gate as keyof typeof GATE_READINGS;
      expect(en).toContain(`>${GATE_READINGS[gate].label}</a>`);
      expect(ko).toContain(`>${GATE_READINGS_KO[gate].label}</a>`);
    }
    // The same links in both languages: only the words differ.
    const hrefs = (markup: string) =>
      [...markup.matchAll(/href="(#[^"]+)"/g)].map(([, href]) => href);
    expect(hrefs(ko)).toEqual(hrefs(en));
  });

  it("states what a mapping approval covers above its hash, in both languages", () => {
    const { proposal, approval } = evaluated[0]!;
    for (const language of ["en", "ko"] as const) {
      const markup = inLanguage(
        language,
        createElement(ApprovalReceipt, {
          approval,
          coverage: mappingApprovalCoverage[language],
        }),
      );
      const sentence = markup.indexOf(mappingApprovalCoverage[language]);
      expect(sentence).toBeGreaterThan(-1);
      expect(markup.indexOf(approval.approvedArtifactHash)).toBeGreaterThan(
        sentence,
      );
    }
    expect(approval.approvedArtifactHash).toBe(sha256Canonical(proposal));
    expect(mappingApprovalCoverage.en).toMatch(
      /new approval before anything runs/,
    );
    expect(mappingApprovalCoverage.ko).toMatch(
      /다시 승인해야 실행할 수 있습니다/,
    );
  });
});
