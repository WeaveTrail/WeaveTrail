import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import ArchitecturePage from "./page";
import { LANGUAGES } from "../i18n/language";
import { architectureCopy } from "./copy";
import { howItWorksSvg } from "./how-it-works-diagram";
import { shellCopy } from "../shell/copy";

const read = (path: string) => readFileSync(resolve(process.cwd(), path));

const DIAGRAM_SOURCE = "docs/assets/how-it-works.svg";
const DIAGRAM_SERVED = "apps/web/public/diagrams/how-it-works.svg";
const KOREAN_DIAGRAM_SOURCE = "docs/assets/how-it-works.ko.svg";
const KOREAN_DIAGRAM_SERVED = "apps/web/public/diagrams/how-it-works.ko.svg";

describe("architecture layer diagram", () => {
  it("serves the diagram the repository documentation commits, byte for byte", () => {
    expect(read(DIAGRAM_SERVED).equals(read(DIAGRAM_SOURCE))).toBe(true);
    expect(
      read(KOREAN_DIAGRAM_SERVED).equals(read(KOREAN_DIAGRAM_SOURCE)),
    ).toBe(true);
  });

  it("keeps both committed files equal to what the diagram module renders", () => {
    // The words on the figure and the words the page draws come from one
    // module. A copy change that reaches only one of them is the drift this
    // catches; `pnpm diagram:build` is the fix.
    const english = howItWorksSvg("en");
    for (const file of [DIAGRAM_SOURCE, DIAGRAM_SERVED])
      expect(read(file).toString("utf8"), file).toBe(english);

    const korean = howItWorksSvg("ko");
    for (const file of [KOREAN_DIAGRAM_SOURCE, KOREAN_DIAGRAM_SERVED])
      expect(read(file).toString("utf8"), file).toBe(korean);
  });

  it("draws every language from the same geometry", () => {
    for (const language of LANGUAGES) {
      const svg = howItWorksSvg(language);
      expect(svg, language).toContain('viewBox="0 0 1200 520"');
      // Contract vocabulary carries one spelling in both languages.
      for (const identifier of [
        "SUPPORTED",
        "NOT_SUPPORTED",
        "INCONCLUSIVE",
        "INPUT_REVIEW_REQUIRED",
        "MAPPING_REVIEW_REQUIRED",
        "CASE_REVIEW_REQUIRED",
        "approvedArtifactHash",
        "eventId",
        "rawRowHash",
      ])
        expect(svg, `${language} ${identifier}`).toContain(identifier);
      expect(svg, language).toContain("<title");
      expect(svg, language).toContain("<desc");
    }
  });

  it("says who does what, and keeps the review stop apart from the three results", () => {
    const markup = renderToStaticMarkup(createElement(ArchitecturePage));
    for (const [role] of architectureCopy.en.roles)
      expect(markup).toContain(role);
    for (const result of ["SUPPORTED", "NOT_SUPPORTED", "INCONCLUSIVE"])
      expect(markup).toContain(`data-result="${result}"`);
    // REVIEW_REQUIRED is named only as what it is: a stop, never a result.
    expect(markup).not.toContain('data-result="REVIEW_REQUIRED"');
    expect(markup).toContain("REVIEW_REQUIRED is not a result.");
  });

  it("keeps the planned scope proposal labelled as planned", () => {
    for (const language of LANGUAGES) {
      const [, ai] = architectureCopy[language].roles[0]!;
      expect(ai, language).toMatch(language === "en" ? /planned/ : /계획/);
    }
  });

  it("groups the primary navigation by what a visitor does, then how it works", () => {
    for (const { navigation } of Object.values(shellCopy)) {
      const [[, explore], [, howItWorks]] = navigation;
      expect(explore.map(([, href]) => href)).toEqual([
        "/replay",
        "/",
        "/evals",
      ]);
      expect(howItWorks.map(([, href]) => href)).toContain("/architecture");
    }
    expect(shellCopy.en.navigation.map(([group]) => group)).toEqual([
      "Explore",
      "How it works",
    ]);
  });
});
