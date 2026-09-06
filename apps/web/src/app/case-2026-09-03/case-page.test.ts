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

  it("reaches the case from the navigation in both languages", () => {
    const navigation = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/site-navigation.tsx"),
      "utf8",
    );
    expect(navigation).toContain('["The 2026-09-03 case", "/case-2026-09-03"]');
    expect(navigation).toContain('["9월 3일 사례", "/case-2026-09-03"]');
  });
});
