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
    expect(markup).toMatch(/일별 자료에 없어서|does not say when/);
    // No order between the two extremes may be drawn or implied, because the
    // daily record does not contain one.
    expect(markup).toMatch(/순서는 그리지 않았습니다|no order between them/);
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

  it("names the reference line it draws", () => {
    const markup = block();
    const { spot } = publishedCaseSeries();
    const previous = spot.at(-2)!.close;
    // The compact chart draws the line, so it says what the line is, both on
    // screen and in the accessible name.
    expect(markup).toContain(previous);
    expect(markup).toMatch(/현물 전일 종가|spot previous close/);
    const label = /aria-label="([^"]*)"/.exec(markup);
    expect(label).not.toBeNull();
    expect(label![1]).toContain(previous);
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
