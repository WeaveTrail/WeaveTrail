import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { publishedCaseSeries } from "../../lib/published-case";
import { HomeEvent } from "./home-event";
import HomePage from "../page";

function block() {
  const { spot, future } = publishedCaseSeries();
  return renderToStaticMarkup(
    createElement(HomeEvent, {
      spot: spot.at(-1)!,
      future,
      previousClose: spot.at(-2)!.close,
    }),
  );
}

describe("the event on the entry screen", () => {
  it("carries only committed published values", () => {
    const markup = block();
    const { spot, future } = publishedCaseSeries();
    const day = spot.at(-1)!;
    for (const value of [day.open, day.high, day.low, day.close])
      expect(markup, value).toContain(value);
    expect(markup).toContain(future.close);
    // The entry screen states no result. Everything the rule produces belongs
    // to the case, after an approval.
    for (const ruleOutput of [
      "13.9147",
      "25.4705",
      "17.95",
      "SUPPORTED",
      "ffd7110a",
    ])
      expect(markup, ruleOutput).not.toContain(ruleOutput);
  });

  it("says the high and the low are not placed in time", () => {
    const markup = block();
    expect(markup).toMatch(/점선|dashed/);
    expect(markup).toMatch(/일별 자료에 없습니다|does not say when/);
  });

  it("offers one way into the case", () => {
    expect(block()).toContain('href="/case-2026-09-03"');
  });

  it("sits directly below the hero, before the explanatory sections", () => {
    // The entry screen turns from what the product is to what it did here, and
    // it is the only block on the page carrying a chart.
    const home = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/home-content.tsx"),
      "utf8",
    );
    const hero = home.indexOf('className="hero shell"');
    const event = home.indexOf("<HomeEvent");
    const sections = home.indexOf('className="shell system-section"');
    expect(hero).toBeGreaterThan(-1);
    expect(event).toBeGreaterThan(hero);
    expect(event).toBeLessThan(sections);
  });

  it("renders from the server page without shipping the artifacts", async () => {
    const markup = renderToStaticMarkup(HomePage());
    expect(markup).toContain('href="/case-2026-09-03"');
  });
});
