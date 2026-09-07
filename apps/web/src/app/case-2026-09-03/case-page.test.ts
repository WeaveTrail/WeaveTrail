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
import {
  PUBLISHED_CASE_THRESHOLD_ORIGIN_ID,
  PublishedCaseSurface,
  ThresholdOriginReference,
} from "./case-surface";
import { caseCopy } from "./case-copy";
import {
  INTRADAY_HIGH,
  INTRADAY_LOW,
  INTRADAY_RETRIEVED_AT,
  INTRADAY_SESSION,
} from "./intraday-session";
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
  const { spot, spotArtifactHash, futureArtifactHash } = publishedCaseSeries();
  return decode(
    renderToStaticMarkup(
      createElement(PublishedCaseSurface, {
        columns: publishedCaseColumns(),
        proposal,
        spot,
        spotArtifactHash,
        futureArtifactHash,
        language,
      }),
    ),
  );
}

describe("the 2026-09-03 case surface", () => {
  it("prints the day's committed strings, not a reformatted version", () => {
    const markup = surface("ko");
    const { spot } = publishedCaseSeries();
    const day = spot.at(-1)!;
    // The session chart marks the high, the low and the close; the scope and
    // the observations carry the rest. All of them print the exact string.
    for (const value of [day.high, day.low, day.close])
      expect(markup, value).toContain(value);
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
      "159ffac0",
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
      expect(markup, language).toContain(
        `id="${PUBLISHED_CASE_THRESHOLD_ORIGIN_ID}"`,
      );
      const reference = renderToStaticMarkup(
        createElement(ThresholdOriginReference, {
          label: text.thresholdOriginLink,
        }),
      );
      expect(reference, language).toContain(
        `href="#${PUBLISHED_CASE_THRESHOLD_ORIGIN_ID}"`,
      );
      expect(reference, language).toContain(text.thresholdOriginLink);
      // The point of the disclosure is that the observations were already
      // known when the thresholds were set.
      expect(text.thresholdOrigin, language).toMatch(
        /관측값을 (이미 )?보고 있었습니다|already in view/,
      );
    }
  });

  it("states that the API verifies approval scope but not reviewer identity", () => {
    const limitations = readFileSync(
      resolve(process.cwd(), "docs/LIMITATIONS.md"),
      "utf8",
    );
    expect(limitations).toContain("exact approved scope hash");
    expect(limitations).toContain("does not authenticate the reviewer");
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

  it("teaches both artifacts' column names, kept apart", () => {
    const legs = publishedCaseColumns();
    expect(legs.map(({ legId }) => legId)).toEqual([
      "spot-index",
      "front-future",
    ]);
    // The two artifacts identify their instrument differently, so a reader who
    // saw only one table would read the second leg through the first's mapping.
    const spot = legs[0]!.columns.map(({ sourceColumn }) => sourceColumn);
    const future = legs[1]!.columns.map(({ sourceColumn }) => sourceColumn);
    expect(spot).toContain("idxNm");
    expect(future).toContain("isinCd");
    expect(future).not.toContain("idxNm");
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      const { columnGloss, legTableTitles } = caseCopy[language];
      for (const leg of legs) {
        expect(markup, leg.legId).toContain(legTableTitles[leg.legId]!);
        for (const column of leg.columns) {
          expect(markup, column.sourceColumn).toContain(column.sourceColumn);
          expect(markup, column.targetField).toContain(column.targetField);
        }
      }
      for (const column of ["mkp", "hipr", "lopr", "clpr", "vs", "isinCd"])
        expect(columnGloss[column], `${language} ${column}`).toBeTruthy();
    }
  });

  it("does not attribute the authored published mapping to a model", () => {
    // These proposals are written by hand in the published-data package; no
    // provider is invoked and no model trace is recorded for them.
    for (const language of ["ko", "en"] as const) {
      const chapter = caseCopy[language].chapters[1]!;
      expect(chapter.purpose, language).toMatch(
        /사람이 직접 작성|written and reviewed by a person/,
      );
      expect(chapter.purpose, language).not.toMatch(
        /초안은 AI가 내고|A model drafts the join/,
      );
    }
  });

  it("asks for a run, not another approval, once the scope is approved", () => {
    for (const language of ["ko", "en"] as const) {
      const text = caseCopy[language];
      expect(text.awaitingRun, language).not.toBe(text.runBlocked);
      // Before any approval the page still asks for the approval.
      expect(surface(language), language).toContain(text.runBlocked);
    }
  });

  it("claims a row trace only for the values derived from a row", () => {
    for (const language of ["ko", "en"] as const) {
      const { did } = caseCopy[language];
      const trace = did.find((line) => /원본 행|published row/.test(line));
      expect(trace, language).toBeDefined();
      // Thresholds, versions, the hash and the rank do not come from one row,
      // and the sentence has to say so rather than sweep them in.
      expect(trace!, language).toMatch(/기준값|thresholds/);
      expect(trace!, language).toMatch(/순위|rank/);
    }
  });

  it("states the procedure in the present tense until there is a result", () => {
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      const text = caseCopy[language];
      // Nothing has been decided and no hash has been returned yet.
      expect(markup, language).toContain(text.willDoTitle);
      expect(markup, language).not.toContain(text.didTitle);
      expect(text.did, language).toHaveLength(text.willDo.length);
      expect(text.did[0], language).not.toBe(text.willDo[0]);
    }
  });

  it("draws the session it says it draws, and keeps it out of the checks", () => {
    // Presentation only: the series is never hashed, approved or read by a
    // rule, and the note beside the chart has to say so.
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      const text = caseCopy[language];
      expect(markup, language).toContain(text.intradayCaption);
      expect(markup, language).toContain(text.intradayChartNote);
      expect(text.intradayChartNote, language).toMatch(
        /판단에는 쓰이지 않습니다|takes no part in the checks/,
      );
    }
    // The three values the line reaches are the three the committed daily
    // record carries, which is what lets the picture and the evidence agree.
    const { spot } = publishedCaseSeries();
    const day = spot.at(-1)!;
    expect(INTRADAY_HIGH.value).toBe(day.high);
    expect(INTRADAY_LOW.value).toBe(day.low);
    expect(INTRADAY_SESSION.at(-1)!.close).toBe(day.close);
    expect(INTRADAY_SESSION.length).toBeGreaterThan(300);
  });

  it("records how the intraday series was obtained and on what terms", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "apps/web/src/app/case-2026-09-03/intraday-session.ts",
      ),
      "utf8",
    );
    expect(source).toContain("PRESENTATION ONLY");
    expect(source).toContain("Licence:   NOT GRANTED");
    expect(source).toContain("scripts/retrieve-kpi200-intraday.mjs");
    expect(source).toContain(INTRADAY_RETRIEVED_AT);
  });

  it("points at the intraday chart without taking anything from it", () => {
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      const text = caseCopy[language];
      expect(markup, language).toContain(
        "https://stock.naver.com/domestic/index/KPI200/price",
      );
      expect(markup, language).toContain(text.intradayNote);
      // The note has to say the values stay out of the checks, because the
      // page's whole argument is that nothing unattributed enters one.
      expect(text.intradayNote, language).toMatch(
        /재배포가 허용되지 않아|not redistributable/,
      );
      expect(text.intradayNote, language).toMatch(
        /쓰이지 않습니다|take no part/,
      );
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
  it("serves every chapter but shows one at a time", () => {
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      const chapters = markup.match(/class="case-chapter"/g) ?? [];
      expect(chapters, language).toHaveLength(
        caseCopy[language].chapters.length,
      );
      // Every chapter stays in the served markup. Hiding the rest is what
      // makes it a procedure to step through rather than a page to scroll,
      // and it keeps the whole case readable to anything that reads the
      // markup instead of running the page.
      const hidden = markup.match(/class="case-chapter" hidden/g) ?? [];
      expect(hidden, language).toHaveLength(chapters.length - 1);
      expect(markup.indexOf('class="case-chapter"'), language).toBeLessThan(
        markup.indexOf('class="case-chapter" hidden'),
      );
    }
  });

  it("names every chapter on the rail and marks the one being read", () => {
    for (const language of ["ko", "en"] as const) {
      const text = caseCopy[language];
      const markup = surface(language);
      expect(markup, language).toContain(
        `aria-label="${text.chapterListLabel}"`,
      );
      text.chapters.forEach((chapter, index) => {
        expect(markup, `${language} ${chapter.title}`).toContain(
          `${index + 1}. ${chapter.title}`,
        );
      });
      // Exactly one entry is the reader's position, or the rail says nothing
      // about where they are.
      const current = markup.match(/aria-current="step"/g) ?? [];
      expect(current, language).toHaveLength(1);
      expect(markup, language).toContain(text.chapterCurrentTag);
      expect(markup, language).toContain(
        text.chapterPositionOf(1, text.chapters.length),
      );
      expect(markup, language).toContain(text.previousChapter);
      expect(markup, language).toContain(text.nextChapter);
    }
  });

  it("leaves the day's chart and premise outside the stepped chapters", () => {
    for (const language of ["ko", "en"] as const) {
      const text = caseCopy[language];
      const markup = surface(language);
      // The chart and what the page refuses to claim are the frame the
      // chapters are read inside, so stepping must never hide them.
      const opening = markup.indexOf('class="case-opening"');
      const chapters = markup.indexOf('class="case-chapters"');
      expect(opening, language).toBeGreaterThan(-1);
      expect(chapters, language).toBeGreaterThan(opening);
      expect(markup.indexOf(text.intradayCaption), language).toBeLessThan(
        chapters,
      );
      expect(markup.indexOf(text.notOurJobTitle), language).toBeLessThan(
        chapters,
      );
    }
  });

  it("gives up the stepping rather than the case when scripting is off", () => {
    for (const language of ["ko", "en"] as const) {
      const markup = surface(language);
      expect(markup, language).toContain("<noscript>");
      // Without scripting no control can advance a chapter, so the hiding is
      // undone instead of stranding the reader on chapter one.
      expect(markup, language).toContain(
        ".case-chapter[hidden]{display:block!important}",
      );
      expect(markup, language).toContain(
        caseCopy[language].chaptersWithoutScript,
      );
    }
  });

  it("counts the same chapters in both languages", () => {
    expect(caseCopy.ko.chapters).toHaveLength(caseCopy.en.chapters.length);
    for (const language of ["ko", "en"] as const) {
      const text = caseCopy[language];
      for (const chapter of text.chapters) {
        expect(chapter.title, language).toBeTruthy();
        expect(chapter.purpose, language).toBeTruthy();
      }
      // A position reads differently in the two languages, but it has to name
      // both numbers in each.
      const position = text.chapterPositionOf(3, text.chapters.length);
      expect(position, language).toContain("3");
      expect(position, language).toContain(String(text.chapters.length));
    }
  });
});
