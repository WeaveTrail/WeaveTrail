import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  publishedCaseColumns,
  publishedCaseProposal,
  publishedCaseSeries,
} from "../../lib/published-case";
import { PublishedCaseSurface } from "./case-surface";
import { caseCopy } from "./case-copy";
import { scaledPrice, verticalScale } from "./session-chart";

/**
 * React escapes apostrophes and ampersands in text nodes, so assertions that
 * compare against the copy table read the decoded markup.
 */
const decode = (markup: string) =>
  markup
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");

function surface(language: "ko" | "en") {
  const { proposal } = publishedCaseProposal();
  const { spot, future, spotArtifactHash, futureArtifactHash } =
    publishedCaseSeries();
  return decode(
    renderToStaticMarkup(
      createElement(PublishedCaseSurface, {
        columns: publishedCaseColumns(),
        proposal,
        spot,
        future,
        previousClose: spot.at(-2)!.close,
        spotArtifactHash,
        futureArtifactHash,
        language,
      }),
    ),
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

  it("names both legs and every plotted price in the chart's accessible name", () => {
    const markup = surface("ko");
    const { spot, future } = publishedCaseSeries();
    const day = spot.at(-1)!;
    const label = /aria-label="([^"]*코스피 200:[^"]*)"/.exec(markup);
    expect(label).not.toBeNull();
    for (const value of [
      day.open,
      day.high,
      day.low,
      day.close,
      day.netChange,
      future.close,
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

  it("claims no approval while it is still asking for one", () => {
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      const text = caseCopy[language];
      // The control invites an approval; nothing on the page may describe one
      // as already given.
      expect(markup, language).toContain(text.approve);
      expect(markup, language).not.toContain(text.approved);
      for (const line of text.doesNotSay)
        expect(line, line).not.toMatch(/승인한 것입니다|was approved above/);
    }
  });

  it("says where the thresholds came from, beside them", () => {
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      const text = caseCopy[language];
      expect(markup, language).toContain(text.thresholdOrigin);
      // The point of the disclosure is that the observations were already
      // known when the thresholds were set.
      expect(text.thresholdOrigin, language).toMatch(
        /관측값을 (이미 )?보고 있었습니다|already in view/,
      );
    }
  });

  it("keeps the chart caption free of any claim the run would contradict", () => {
    // The caption explains why one stretch of the path is dashed and nothing
    // else, so it stays true before and after the run.
    for (const language of ["ko", "en"] as const) {
      const { pathNote } = caseCopy[language];
      expect(surface(language), language).toContain(pathNote);
      expect(pathNote, language).not.toMatch(/순위|배수|rank|multiple/i);
    }
  });

  it("numbers every chapter and says what it is for before its content", () => {
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      const chapters = caseCopy[language].chapters;
      expect(chapters, language).toHaveLength(6);
      chapters.forEach((chapter, index) => {
        expect(markup, chapter.title).toContain(chapter.title);
        expect(markup, chapter.purpose).toContain(chapter.purpose);
        expect(markup.indexOf(chapter.purpose), chapter.title).toBeGreaterThan(
          markup.indexOf(`id="chapter-${index + 1}"`),
        );
      });
    }
  });

  it("teaches the publisher's own column names before showing a result", () => {
    const columns = publishedCaseColumns();
    expect(columns.length).toBeGreaterThan(0);
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      const { columnGloss } = caseCopy[language];
      for (const column of columns) {
        expect(markup, column.sourceColumn).toContain(column.sourceColumn);
        expect(markup, column.targetField).toContain(column.targetField);
      }
      for (const column of ["mkp", "hipr", "lopr", "clpr", "vs"])
        expect(columnGloss[column], `${language} ${column}`).toBeTruthy();
    }
  });

  it("carries the case into the rollback checklist", () => {
    // A restored deployment that never exercises the approval boundary is a
    // deployment nobody checked.
    const deployment = readFileSync(
      resolve(process.cwd(), "docs/DEPLOYMENT.md"),
      "utf8",
    );
    const rollback = deployment.slice(deployment.indexOf("## Rollback"));
    expect(rollback).toContain("/case-2026-09-03");
    expect(rollback).toContain("eight-route");
  });

  it("reaches the case from the navigation in both languages", () => {
    const navigation = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/site-navigation.tsx"),
      "utf8",
    );
    // Named for what happened rather than for a date, so a reader decides
    // whether to open it from the entry rather than after arriving.
    expect(navigation).toContain(
      '["A fall and a recovery", "/case-2026-09-03"]',
    );
    expect(navigation).toContain(
      '["하루 안의 급락과 회복", "/case-2026-09-03"]',
    );
    expect(navigation).not.toContain("9월 3일 사례");
  });
});
