import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { publishedCaseSeries } from "../../lib/published-case";
import { HomeEvent } from "./home-event";
import { INTRADAY_HIGH, INTRADAY_LOW } from "./intraday-session";
import HomePage from "../page";

function block() {
  const { spot } = publishedCaseSeries();
  return renderToStaticMarkup(createElement(HomeEvent, { spot: spot.at(-1)! }));
}

describe("the event on the entry screen", () => {
  it("carries only committed published values", () => {
    const markup = block();
    const { spot } = publishedCaseSeries();
    const day = spot.at(-1)!;
    for (const value of [day.open, day.high, day.low, day.close])
      expect(markup, value).toContain(value);
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

  it("marks when the session reached its high and its low", () => {
    const markup = block();
    // The minute series does carry a time for each extreme, which is exactly
    // what the daily record could not give.
    expect(markup).toContain(INTRADAY_HIGH.time);
    expect(markup).toContain(INTRADAY_LOW.time);
    expect(markup).toContain(INTRADAY_HIGH.value);
    expect(markup).toContain(INTRADAY_LOW.value);
  });

  it("says the drawn session takes no part in the checks", () => {
    expect(block()).toMatch(
      /판단에 쓰이지 않습니다|takes no part in the checks/,
    );
  });

  it("narrates no order between the two extremes", () => {
    // The chart stopped drawing a sequence the record does not contain; the
    // prose beside it may not put one back.
    const markup = block();
    expect(markup).not.toMatch(/올랐다가|내려갔|came back|fell to|reached/);
  });

  it("reads its figures from the committed row rather than restating them", () => {
    // A correction to the artifact must not leave old figures attached to a
    // real instrument, so no price may be written into the copy table.
    const source = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/case-2026-09-03/home-event.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/1[0-9]{3}\.[0-9]/);
    const { spot } = publishedCaseSeries();
    const markup = block();
    for (const value of [
      spot.at(-1)!.open,
      spot.at(-1)!.high,
      spot.at(-1)!.low,
      spot.at(-1)!.close,
    ])
      expect(markup, value).toContain(value);
  });

  it("names the marks it draws in the accessible name", () => {
    const markup = block();
    const label = /aria-label="([^"]*)"/.exec(markup);
    expect(label).not.toBeNull();
    for (const value of [INTRADAY_HIGH.value, INTRADAY_LOW.value])
      expect(label![1], value).toContain(value);
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
