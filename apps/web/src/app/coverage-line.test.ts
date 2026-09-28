import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { publishedCoverageManifest } from "@weavetrail/published-data";
import { coverageSummary } from "../lib/coverage-copy";
import { CoverageLine } from "./coverage-line";
import PublishedCasePage from "./case-2026-09-03/page";
import { CaseBoundary } from "./case-2026-09-03/case-boundary";
import { CaseReplay } from "./replay/case-replay";
import { prepareReplayScenarios } from "./replay/prepare-scenarios";

describe("coverage visible before results", () => {
  it("shows the recorded windows, partial stock limit, resolution and latest retrieval in both languages", () => {
    const summary = coverageSummary(publishedCoverageManifest);
    for (const language of ["ko", "en"] as const) {
      const html = renderToStaticMarkup(
        createElement(CoverageLine, { summary, language }),
      );
      for (const value of [
        "2026-07-01",
        "2026-09-03",
        "40",
        publishedCoverageManifest.asOf,
      ])
        expect(html).toContain(value);
      expect(html).toContain(language === "ko" ? "일별" : "daily");
      expect(html).toContain(
        language === "ko" ? "실제 관측일만" : "observed dates only",
      );
      expect(html).toContain('href="/api/coverage"');
    }
  });

  it("places coverage before the event's interactive case, so it is visible before approval or a run", () => {
    const page = PublishedCasePage();
    const children = page.props.children as ReactNode[];
    const coverageIndex = children.findIndex(
      (child) => isValidElement(child) && child.type === CoverageLine,
    );
    const caseIndex = children.findIndex(
      (child) => isValidElement(child) && child.type === CaseBoundary,
    );
    expect(coverageIndex).toBeGreaterThanOrEqual(0);
    expect(coverageIndex).toBeLessThan(caseIndex);
  });

  it("renders coverage above the empty result panel in both replay languages", async () => {
    const props = await prepareReplayScenarios();
    for (const language of ["ko", "en"] as const) {
      const html = renderToStaticMarkup(
        createElement(CaseReplay, { ...props, language }),
      );
      const panel = html.slice(html.indexOf('class="panel result-panel"'));
      expect(
        panel.indexOf('data-coverage="published-coverage-v1"'),
      ).toBeGreaterThan(0);
      expect(
        panel.indexOf('data-coverage="published-coverage-v1"'),
      ).toBeLessThan(panel.indexOf('class="empty-result"'));
      expect(panel).toContain(
        language === "ko" ? "조회 범위:" : "Check coverage:",
      );
    }
  });
});
