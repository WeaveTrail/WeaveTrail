import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import ArchitecturePage from "./page";
import { LANGUAGES } from "../i18n/language";
import { howItWorksSvg } from "./how-it-works-diagram";

const read = (path: string) => readFileSync(resolve(process.cwd(), path));

const DIAGRAM_SOURCE = "docs/assets/how-it-works.svg";
const DIAGRAM_SERVED = "apps/web/public/diagrams/how-it-works.svg";

describe("architecture layer diagram", () => {
  it("serves the diagram the repository documentation commits, byte for byte", () => {
    expect(read(DIAGRAM_SERVED).equals(read(DIAGRAM_SOURCE))).toBe(true);
  });

  it("keeps both committed files equal to what the diagram module renders", () => {
    // The words on the figure and the words the page draws come from one
    // module. A copy change that reaches only one of them is the drift this
    // catches; `pnpm diagram:build` is the fix.
    const english = howItWorksSvg("en");
    for (const file of [DIAGRAM_SOURCE, DIAGRAM_SERVED])
      expect(read(file).toString("utf8"), file).toBe(english);
  });

  it("draws the diagram inline so its words follow the reader's language", () => {
    const markup = renderToStaticMarkup(createElement(ArchitecturePage));
    expect(markup).not.toContain('src="/diagrams/how-it-works.svg"');
    expect(markup).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    // The figure names and describes itself, which is what replaces the alt
    // text the committed image used to carry.
    expect(markup).toContain('aria-labelledby="flowTitle flowDesc"');
    expect(/<desc id="flowDesc">[^<]{40,}<\/desc>/.test(markup)).toBe(true);
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

  it("marks the trust boundary, the hash coverage and the end of a model's authority", () => {
    const markup = renderToStaticMarkup(createElement(ArchitecturePage));
    for (const mark of [
      "Where a model&#x27;s authority ends.",
      "The trust boundary.",
      "What the canonical hash covers.",
    ])
      expect(markup).toContain(mark);
    expect(markup).toContain('href="#canonical-hash"');
    expect(markup).toContain('id="canonical-hash"');
  });

  it("keeps unimplemented components labelled as planned", () => {
    const markup = renderToStaticMarkup(createElement(ArchitecturePage));
    const planned = markup.indexOf("Bounded case proposer");
    expect(planned).toBeGreaterThan(-1);
    expect(markup.slice(planned, planned + 200)).toContain("Planned");

    const implemented = markup.indexOf("Evidence Bundle");
    expect(implemented).toBeGreaterThan(-1);
    expect(markup.slice(implemented, implemented + 200)).toContain(
      "byte-backed verification",
    );
  });

  it("groups the primary navigation by investigation stage", () => {
    const navigation = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/site-navigation.tsx"),
      "utf8",
    );
    const order = [
      "Start here",
      "/",
      "/replay",
      "About this project",
      "/architecture",
    ];
    let cursor = -1;
    for (const token of order) {
      const next = navigation.indexOf(`"${token}"`, cursor + 1);
      expect(next, token).toBeGreaterThan(cursor);
      cursor = next;
    }
  });
});
