import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  createElement,
  isValidElement,
  type ComponentProps,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { committedReplaySources } from "../../lib/replay-sources";
import HomePage from "../page";
import { shellCopy } from "../shell/copy";
import ReplayPage, { metadata } from "./page";
import { CaseReplay } from "./case-replay";
import { SourceRows } from "./source-rows";
import { prepareReplayScenarios } from "./prepare-scenarios";
import { ReplayModeBoundary } from "./replay-mode-boundary";

function replayProps(
  node: ReactNode,
): ComponentProps<typeof ReplayModeBoundary> | undefined {
  if (Array.isArray(node)) return node.map(replayProps).find(Boolean);
  if (!isValidElement<{ children?: ReactNode }>(node)) return;
  if (node.type === ReplayModeBoundary)
    return node.props as ComponentProps<typeof ReplayModeBoundary>;
  return replayProps(node.props.children);
}

describe("Case Replay entry contract", () => {
  it("prepares real scenarios and proposals without borrowing committed case approvals", async () => {
    const prepared = await prepareReplayScenarios();
    expect(prepared.providerMode).toBe("fixture");
    for (const scenario of prepared.scenarios) {
      const committed = committedReplaySources[scenario.value];
      expect(scenario.rows).toEqual(committed.rows);
      const proposal = prepared.proposals[scenario.sourceArtifactHash]!;
      expect(proposal.sourceArtifactHash).toBe(committed.sourceArtifactHash);
      expect(proposal.fields.map((field) => field.sourceColumn)).toEqual(
        committed.columns,
      );
      if ("mappingProposal" in committed)
        expect(proposal).toEqual(committed.mappingProposal);
      if ("manifest" in committed) {
        const { approval: _, ...manifest } = committed.manifest;
        void _;
        expect(scenario.manifest).toEqual(manifest);
        expect(scenario.manifest).not.toHaveProperty("approval");
      } else expect(scenario.manifest).toBeUndefined();
      const markup = renderToStaticMarkup(
        createElement(SourceRows, { scenario }),
      );
      expect(markup).toContain(scenario.sourceArtifactHash);
      expect(markup).toContain(scenario.value);
      // One table: a header cell per column, a row header per source row.
      const renderedTerms = new Set(
        [...markup.matchAll(/<th scope="col">(.*?)<\/th>/g)].map(
          (match) => match[1],
        ),
      );
      const renderedValues = new Set(markup.match(/<code>.*?<\/code>/g) ?? []);
      const renderedRows = new Set(
        [...markup.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map(
          (match) => match[1],
        ),
      );
      const escapedTerms = new Map(
        committed.columns.map((column) => [
          column,
          renderToStaticMarkup(createElement("span", null, column)).slice(
            "<span>".length,
            -"</span>".length,
          ),
        ]),
      );
      const escapedValues = new Map<string, string>();
      const missingRows: string[] = [];
      const missingTerms = new Set<string>();
      const missingValues = new Set<string>();
      for (const row of committed.rows) {
        if (!renderedRows.has(row.coordinate.rowNumber))
          missingRows.push(row.coordinate.rowNumber);
        for (const [column, value] of Object.entries(row.values)) {
          const escapedTerm = escapedTerms.get(column)!;
          if (!renderedTerms.has(escapedTerm)) missingTerms.add(escapedTerm);
          let escapedValue = escapedValues.get(value);
          if (escapedValue === undefined) {
            escapedValue = renderToStaticMarkup(
              createElement("code", null, value),
            );
            escapedValues.set(value, escapedValue);
          }
          if (!renderedValues.has(escapedValue))
            missingValues.add(escapedValue);
        }
      }
      expect(missingRows).toEqual([]);
      expect([...missingTerms]).toEqual([]);
      expect([...missingValues]).toEqual([]);
    }
  });

  it.each([undefined, "guided", "working", "APPROVED", ["guided", "guided"]])(
    "treats query mode %j only as a closed presentation choice",
    async (mode) => {
      const page = await ReplayPage({
        searchParams: Promise.resolve({
          mode,
          approval: "APPROVED",
          result: "SUPPORTED",
          scenario: "concentrated-buy-dialect-b.jsonl",
        }),
      });
      const props = replayProps(page)!;
      expect(props.guided).toBe(mode !== "working");
      expect(props).not.toHaveProperty("approval");
      expect(props).not.toHaveProperty("result");
      const markup = renderToStaticMarkup(createElement(CaseReplay, props));
      expect(markup).toContain(
        'value="published-execution-fix44.csv" selected=""',
      );
      expect(markup).not.toContain('class="approval-receipt"');
      expect(markup).not.toContain("data-result=");
    },
  );

  it("removes the former route and points entry, metadata and navigation at Case Replay", () => {
    expect(metadata.title).toBe("Walk through a case");
    expect(metadata.alternates?.canonical).toBe("/replay");
    expect(existsSync(resolve("apps/web/src/app/lab/page.tsx"))).toBe(false);
    const home = renderToStaticMarkup(createElement(HomePage));
    expect(home).toContain('href="/replay?mode=guided"');
    expect(home).toContain('href="/why"');
    for (const { navigation } of Object.values(shellCopy)) {
      const [explore] = navigation;
      // One entry: the guided and working modes are chosen inside the surface.
      expect(explore[1].map(([, href]) => href)).toContain("/replay");
      for (const [, items] of navigation)
        for (const [, href] of items) {
          expect(href).not.toContain("mode=");
          expect(href).not.toBe("/lab");
        }
    }
    expect(shellCopy.en.navigation[0][1][0]).toEqual([
      "Walk through a case",
      "/replay",
      "One case, proposal to source row",
    ]);
  });
});
