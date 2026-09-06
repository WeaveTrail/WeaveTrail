import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import ArchitecturePage from "./page";

const read = (path: string) => readFileSync(resolve(process.cwd(), path));

const DIAGRAM_SOURCE = "docs/assets/how-it-works.svg";
const DIAGRAM_SERVED = "apps/web/public/diagrams/how-it-works.svg";

describe("architecture layer diagram", () => {
  it("serves the diagram the repository documentation commits, byte for byte", () => {
    expect(read(DIAGRAM_SERVED).equals(read(DIAGRAM_SOURCE))).toBe(true);
  });

  it("renders the committed diagram with a text alternative", () => {
    const markup = renderToStaticMarkup(createElement(ArchitecturePage));
    expect(markup).toContain('src="/diagrams/how-it-works.svg"');
    const alt = /<img[^>]*src="\/diagrams\/how-it-works\.svg"[^>]*>/.exec(
      markup,
    )?.[0];
    expect(alt).toBeDefined();
    expect(/alt="[^"]{40,}"/.test(alt!)).toBe(true);
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
    for (const planned of [
      "Bounded case proposer",
      "Evidence Bundle assembly",
    ]) {
      const index = markup.indexOf(planned);
      expect(index).toBeGreaterThan(-1);
      expect(markup.slice(index, index + 200)).toContain("Planned");
    }
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
