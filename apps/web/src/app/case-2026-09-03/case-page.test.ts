import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  publishedCaseProposal,
  publishedCaseSeries,
} from "../../lib/published-case";
import { PublishedCaseSurface } from "./case-surface";
import { caseCopy } from "./case-copy";
import { scaledPrice, verticalScale } from "./session-chart";

function surface(language: "ko" | "en") {
  const { proposal } = publishedCaseProposal();
  const { spot, future, spotArtifactHash, futureArtifactHash } =
    publishedCaseSeries();
  return renderToStaticMarkup(
    createElement(PublishedCaseSurface, {
      proposal,
      spot,
      future,
      previousClose: spot.at(-2)!.close,
      spotArtifactHash,
      futureArtifactHash,
      language,
    }),
  );
}

describe("the 2026-09-03 case surface", () => {
  it("draws the analysed day from the committed published strings", () => {
    const markup = surface("ko");
    const { spot, future } = publishedCaseSeries();
    const day = spot.at(-1)!;
    // Every figure on the chart is the artifact's own string, not a rounded or
    // reformatted version of it.
    for (const value of [day.open, day.high, day.low, day.close, day.netChange])
      expect(markup, value).toContain(value);
    for (const value of [future.open, future.high, future.low, future.close])
      expect(markup, value).toContain(value);
    expect(markup).toContain(spot.at(-2)!.close);
  });

  it("computes no rank and no multiple before the rule has run", () => {
    // The recorded failure of an earlier attempt was a home-made score sitting
    // in the largest type beside evidence about provenance. Nothing the rule
    // produces may appear until the rule has produced it.
    const markup = surface("ko");
    for (const ruleOutput of [
      "13.9147",
      "25.4705",
      "17.95",
      "21.65",
      "SUPPORTED",
      "ffd7110a",
    ])
      expect(markup, ruleOutput).not.toContain(ruleOutput);
  });

  it("withholds what the result says until there is a result", () => {
    // A numeric absence check missed this once: the conclusion was prose, and
    // prose about a rank is still rule output.
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      const text = caseCopy[language];
      expect(markup, language).not.toContain(text.saysTitle);
      for (const line of text.says("1", "45"))
        expect(markup, line).not.toContain(line);
      // The disclosures about the data stay, because they are not a result.
      expect(markup, language).toContain(text.doesNotSayTitle);
    }
  });

  it("names the reversal and the net change in the chart's accessible name", () => {
    const markup = surface("ko");
    const { spot } = publishedCaseSeries();
    const day = spot.at(-1)!;
    const label = /aria-label="([^"]*코스피 200 · 2026-09-03[^"]*)"/.exec(
      markup,
    );
    expect(label).not.toBeNull();
    for (const value of [
      day.high,
      day.close,
      day.netChange,
      spot.at(-2)!.close,
    ])
      expect(label![1], value).toContain(value);
  });

  it("places every chart mark without floating point arithmetic on a price", () => {
    // Prices reach the geometry as scaled integers, so finely spaced values
    // stay distinct instead of collapsing onto one coordinate.
    expect(scaledPrice("1009.7")).toBe(1009700000n);
    expect(scaledPrice(".85")).toBe(850000n);
    expect(scaledPrice("-2.58")).toBe(-2580000n);
    expect(scaledPrice("1030")).toBe(1030000000n);
    const y = verticalScale(["1000.0001", "1000.0002", "1000.0003"], 0, 100);
    expect(y("1000.0001")).not.toBe(y("1000.0002"));
    expect(y("1000.0002")).not.toBe(y("1000.0003"));
    expect(y("1000.0003")).toBeLessThan(y("1000.0001"));
  });

  it("holds the visitor's approval before anything runs, in both languages", () => {
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      const text = caseCopy[language];
      expect(markup, language).toContain(text.approve);
      expect(markup, language).toContain(text.runBlocked);
      expect(markup, language).toContain("STATED_DATE_ONLY_NO_CANDIDATE_SCAN");
    }
  });

  it("states what the result will not say, before it is run", () => {
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      for (const line of caseCopy[language].doesNotSay)
        expect(markup, line).toContain(line);
    }
  });

  it("keeps every case grid inside a narrow viewport", () => {
    // A track floor wider than the shell overflows the page horizontally, and
    // the narrow shell is 288px at a 320px viewport.
    const styles = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/styles.css"),
      "utf8",
    );
    for (const selector of [
      ".case-day-pair",
      ".case-legs",
      ".case-observations",
      ".case-stop-grid",
    ]) {
      const rule = new RegExp(
        `\\${selector} \\{[^}]*grid-template-columns: repeat\\(auto-fit, minmax\\(min\\(`,
      );
      expect(rule.test(styles), selector).toBe(true);
    }
  });

  it("reaches the case from the navigation in both languages", () => {
    const navigation = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/site-navigation.tsx"),
      "utf8",
    );
    expect(navigation).toContain('["The 2026-09-03 case", "/case-2026-09-03"]');
    expect(navigation).toContain('["9월 3일 사례", "/case-2026-09-03"]');
  });
});
