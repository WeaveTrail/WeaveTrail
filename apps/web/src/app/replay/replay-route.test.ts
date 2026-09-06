import { existsSync, readFileSync } from "node:fs";
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
import ReplayPage, { metadata } from "./page";
import { CaseReplay, SourceRows } from "./case-replay";
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
      const renderedTerms = new Set(markup.match(/<dt>.*?<\/dt>/g) ?? []);
      const renderedValues = new Set(markup.match(/<code>.*?<\/code>/g) ?? []);
      const renderedRows = new Set(
        [...markup.matchAll(/Source row ([^<]+)/g)].map((match) => match[1]),
      );
      const escapedTerms = new Map(
        committed.columns.map((column) => [
          column,
          renderToStaticMarkup(createElement("dt", null, column)),
        ]),
      );
      const escapedValues = new Map<string, string>();
      for (const row of committed.rows) {
        expect(renderedRows).toContain(row.coordinate.rowNumber);
        for (const [column, value] of Object.entries(row.values)) {
          expect(renderedTerms).toContain(escapedTerms.get(column));
          let escapedValue = escapedValues.get(value);
          if (escapedValue === undefined) {
            escapedValue = renderToStaticMarkup(
              createElement("code", null, value),
            );
            escapedValues.set(value, escapedValue);
          }
          expect(renderedValues).toContain(escapedValue);
        }
      }
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
        'value="rapid-price-lift-supported.csv" selected=""',
      );
      expect(markup).not.toContain('class="approval-receipt"');
      expect(markup).not.toContain("data-result=");
    },
  );

  it("removes the former route and points entry, metadata and navigation at Case Replay", () => {
    expect(metadata.title).toBe("Case Replay");
    expect(metadata.alternates?.canonical).toBe("/replay");
    expect(existsSync(resolve("apps/web/src/app/lab/page.tsx"))).toBe(false);
    const home = readFileSync(resolve("apps/web/src/app/page.tsx"), "utf8");
    const nav = readFileSync(
      resolve("apps/web/src/app/site-navigation.tsx"),
      "utf8",
    );
    expect(home).toContain('href="/replay?mode=guided"');
    // The entry's secondary action now carries the argument, which links on to
    // the architecture in turn.
    expect(home).toContain('href="/why"');
    expect(nav).toContain('["Walk through a case", "/replay"]');
    // One entry: the guided and working modes are chosen inside the surface.
    expect(nav).not.toContain("mode=");
    expect(nav).toContain('"Start here"');
    expect(home + nav).not.toContain('"/lab"');
  });
});
