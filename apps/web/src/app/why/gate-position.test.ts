import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import HomePage from "../page";
import WhyPage from "./page";
import {
  CONCLUSION_NOT_METHOD,
  NON_AFFILIATION,
  OWN_REASONING_MARK,
  gateInputs,
  handoverStatements,
  layerAuthorities,
  notClaimed,
  sources,
  upstreamStatements,
} from "./why-content";

const read = (path: string) => readFileSync(resolve(process.cwd(), path));

const DIAGRAM_SOURCE = "docs/assets/where-the-gate-sits.svg";
const DIAGRAM_SERVED = "apps/web/public/diagrams/where-the-gate-sits.svg";

/** React escapes text nodes; compare against the same escaping. */
const escaped = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

const markup = () => renderToStaticMarkup(createElement(WhyPage));

const attributed = [...upstreamStatements, ...handoverStatements];

describe("where the gate sits", () => {
  it("states the five sections the page exists to carry", () => {
    const rendered = markup();
    for (const heading of [
      "What upstream surveillance already does",
      "What it still hands to a person",
      "Where the gate sits",
      "What each of the four layers may and may not do",
      "What this page does not claim",
    ])
      expect(rendered).toContain(heading);
    for (const layer of layerAuthorities)
      expect(rendered).toContain(escaped(layer.name));
  });

  it("attributes every sentence about a system outside this repository", () => {
    for (const statement of attributed) {
      const hasSource = "source" in statement;
      const hasReasoning = "reasoning" in statement;
      expect(hasSource !== hasReasoning, statement.text).toBe(true);
      if (hasSource)
        expect(
          sources.some((source) => source.id === statement.source),
          statement.text,
        ).toBe(true);
    }
  });

  it("renders each statement with its citation or its own-reading mark", () => {
    const rendered = markup();
    for (const statement of attributed) {
      expect(rendered).toContain(escaped(statement.text));
      if ("source" in statement) {
        const source = sources.find((it) => it.id === statement.source)!;
        expect(rendered).toContain(`href="#source-${source.id}"`);
      }
    }
    const reasoningCount = attributed.filter(
      (statement) => "reasoning" in statement,
    ).length;
    expect(reasoningCount).toBeGreaterThan(0);
    expect(rendered.split(escaped(OWN_REASONING_MARK)).length - 1).toBe(
      reasoningCount + 1,
    );
  });

  it("resolves every citation to a listed source, and lists no unused source", () => {
    const rendered = markup();
    for (const source of sources) {
      expect(rendered).toContain(`id="source-${source.id}"`);
      expect(rendered).toContain(`href="${source.href}"`);
      expect(rendered).toContain(escaped(source.title));
      expect(
        attributed.some(
          (statement) =>
            "source" in statement && statement.source === source.id,
        ),
        source.id,
      ).toBe(true);
    }
  });

  it("names the three inputs the gate asks of an upstream, and inspects a conclusion", () => {
    const rendered = markup();
    expect(gateInputs).toHaveLength(3);
    for (const [name, detail] of gateInputs) {
      expect(rendered).toContain(escaped(name));
      expect(rendered).toContain(escaped(detail));
    }
    expect(rendered).toContain(escaped(CONCLUSION_NOT_METHOD));
  });

  it("gives each of the four layers what it may and may not do", () => {
    const rendered = markup();
    expect(layerAuthorities).toHaveLength(4);
    for (const layer of layerAuthorities) {
      expect(rendered).toContain(escaped(layer.may));
      expect(rendered).toContain(escaped(layer.mayNot));
    }
    expect(rendered).toContain("May.");
    expect(rendered).toContain("May not.");
  });

  it("keeps unimplemented components labelled as planned", () => {
    const rendered = markup();
    for (const planned of ["Live model adapters", "Evidence Bundle assembly"]) {
      const index = rendered.indexOf(planned);
      expect(index, planned).toBeGreaterThan(-1);
      expect(rendered.slice(index, index + 200)).toContain("planned");
    }
  });

  it("states the non-affiliation line and the boundary of the argument", () => {
    const rendered = markup();
    expect(notClaimed).toContain(NON_AFFILIATION);
    for (const claim of notClaimed) expect(rendered).toContain(escaped(claim));
  });

  it("keeps the page to the product argument", () => {
    const rendered = markup().toLowerCase();
    for (const outOfScope of [
      "hackathon",
      "competition",
      "submission",
      "portfolio",
      "curriculum vitae",
      "biography",
    ])
      expect(rendered, outOfScope).not.toContain(outOfScope);
  });

  it("serves the diagram the repository documentation commits, byte for byte", () => {
    expect(read(DIAGRAM_SERVED).equals(read(DIAGRAM_SOURCE))).toBe(true);
  });

  it("renders the committed diagram with a text alternative in a scrolling frame", () => {
    const rendered = markup();
    expect(rendered).toContain('src="/diagrams/where-the-gate-sits.svg"');
    const image =
      /<img[^>]*src="\/diagrams\/where-the-gate-sits\.svg"[^>]*>/.exec(
        rendered,
      )?.[0];
    expect(image).toBeDefined();
    expect(/alt="[^"]{40,}"/.test(image!)).toBe(true);
    expect(rendered).toContain('class="diagram-frame"');
  });

  it("paints its own ground so the diagram stays legible in either theme", () => {
    const svg = read(DIAGRAM_SOURCE).toString("utf8");
    const canvas = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    expect(canvas).not.toBeNull();
    const [, width, height] = canvas!;
    expect(svg).toContain(
      `<rect width="${width}" height="${height}" fill="#f7faf9"/>`,
    );
    expect(svg.indexOf("<rect")).toBeLessThan(svg.indexOf("<text"));
    expect(svg).toContain("<title");
    expect(svg).toContain("<desc");
  });

  it("reduces the overview to its claim and sends the argument here", () => {
    const home = renderToStaticMarkup(createElement(HomePage));
    expect(home).toContain('href="/why"');
    expect(home).not.toContain("reviewable evidence for more");
    expect(home).not.toContain("a reviewer needs to check which");
  });

  it("lists the page under the navigation Reference group", () => {
    const navigation = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/site-navigation.tsx"),
      "utf8",
    );
    const reference = navigation.indexOf('"Reference"');
    expect(reference).toBeGreaterThan(-1);
    expect(navigation.indexOf('"/why"')).toBeGreaterThan(reference);
  });
});
