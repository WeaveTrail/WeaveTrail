import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import HomePage from "../page";
import WhyPage from "./page";
import { situation, sources, whyCopy } from "./copy";
import { shellCopy } from "../shell/copy";

/** React escapes text nodes; compare against the same escaping. */
const escaped = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

const markup = () => renderToStaticMarkup(createElement(WhyPage));

describe("why a reviewer would use WeaveTrail", () => {
  it("opens from the reviewer's situation, then says what they gain", () => {
    const rendered = markup();
    const gains = rendered.indexOf('id="benefits"');
    expect(gains).toBeGreaterThan(-1);
    for (const statement of situation) {
      const index = rendered.indexOf(escaped(statement.text.en));
      expect(index, statement.text.en).toBeGreaterThan(-1);
      expect(index).toBeLessThan(gains);
    }
    for (const [title, body] of whyCopy.en.benefits) {
      expect(rendered).toContain(escaped(title));
      for (const sentence of body.split(/(?<=\.)\s+/))
        expect(rendered).toContain(escaped(sentence));
    }
    expect(rendered).toContain('href="/replay?mode=guided"');
  });

  it("cites a listed source beside every sentence about the outside world", () => {
    const rendered = markup();
    for (const statement of situation) {
      expect(
        sources.some((source) => source.id === statement.source),
        statement.text.en,
      ).toBe(true);
      expect(rendered).toContain(`href="#source-${statement.source}"`);
    }
  });

  it("resolves every citation to a listed source, and lists no unused source", () => {
    const rendered = markup();
    for (const source of sources) {
      expect(rendered).toContain(`id="source-${source.id}"`);
      expect(rendered).toContain(`href="${escaped(source.href)}"`);
      expect(rendered).toContain(escaped(source.title.en));
      expect(
        situation.some((statement) => statement.source === source.id),
        source.id,
      ).toBe(true);
    }
  });

  it("cites only the supervisory bodies this project stands on", () => {
    for (const source of sources) {
      const { host } = new URL(source.href);
      expect(host, source.id).toMatch(/^www\.(fsc\.go\.kr|fss\.or\.kr)$/);
    }
    // The guideline the readme already records is among them.
    const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
    const guideline = sources.find(({ id }) => id === "financial-ai-guideline");
    expect(guideline).toBeDefined();
    expect(readme).toContain(guideline!.href);
  });

  it("states what the service does not do, and the non-affiliation line", () => {
    const rendered = markup();
    for (const limit of whyCopy.en.limits)
      expect(rendered).toContain(escaped(limit));
    expect(whyCopy.en.limits.join(" ")).toMatch(/no affiliation/);
    expect(whyCopy.en.limits.join(" ")).toMatch(/does not judge guilt/);
    expect(whyCopy.ko.limits.join(" ")).toMatch(/아무 관계가 없습니다/);
  });

  it("keeps the page to the product argument", () => {
    const rendered = markup().toLowerCase();
    for (const excludedText of [
      "hackathon",
      "competition",
      "submission",
      "portfolio",
      "curriculum vitae",
      "biography",
    ])
      expect(rendered, excludedText).not.toContain(excludedText);
  });

  it("is reached from the home page", () => {
    const home = renderToStaticMarkup(createElement(HomePage));
    expect(home).toContain('href="/why"');
  });

  it("clears the sticky header when a citation jumps to its source", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/explainer/explainer.css"),
      "utf8",
    );
    const rule = /([^}]*)\{\s*scroll-margin-top: 110px;/.exec(styles);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain(".source-list li");
  });

  it("keeps the documented route lists complete", () => {
    // Both documents enumerate the site's routes, and a new one silently
    // missing from either is how the deployment check stops covering it.
    const routes = ["/why", "/architecture", "/evals", "/replay"];
    const deployment = readFileSync(
      resolve(process.cwd(), "docs/DEPLOYMENT.md"),
      "utf8",
    );
    for (const route of routes)
      expect(deployment, route).toContain(`\`${route}\``);
    for (const document of ["ARCHITECTURE.md", "ARCHITECTURE.ko.md"]) {
      const architecture = readFileSync(
        resolve(process.cwd(), "docs", document),
        "utf8",
      );
      for (const route of routes)
        expect(architecture, `${document} ${route}`).toContain(route);
    }
  });

  it("lists the page under the navigation group on how it works", () => {
    for (const { navigation } of Object.values(shellCopy))
      expect(navigation[1][1].map(([, href]) => href)).toEqual([
        "/why",
        "/architecture",
      ]);
    expect(shellCopy.en.navigation[1][0]).toBe("How it works");
  });
});
