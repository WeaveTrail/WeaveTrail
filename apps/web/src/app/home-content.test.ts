import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DECLARED_MODELS,
  FAILURE_LOG_ENTRIES,
} from "./evals/model-comparison-data";
import { GUIDE_STAGES, guideStageNames } from "./guide-stages";
import { homeCopy } from "./home-content";
import HomePage from "./page";
import { navigationCopy } from "./site-navigation";

describe("home page", () => {
  const markup = renderToStaticMarkup(createElement(HomePage));

  it("draws the four control-line stages under the guided walkthrough's names", () => {
    let cursor = -1;
    for (const stage of GUIDE_STAGES) {
      const next = markup.indexOf(`data-stage="${stage}"`);
      expect(next, stage).toBeGreaterThan(cursor);
      expect(markup).toContain(guideStageNames.en[stage]);
      cursor = next;
    }
  });

  it("cites the board's counts from the committed data", () => {
    expect(markup).toContain(
      homeCopy.en.comparison(DECLARED_MODELS.length, "2026-10-08"),
    );
    expect(markup).toContain(
      homeCopy.en.failureLog(FAILURE_LOG_ENTRIES.length),
    );
  });

  it("lists every planned capability as planned, apart from what runs", () => {
    const planned = markup.indexOf('data-status="planned"');
    expect(planned).toBeGreaterThan(-1);
    for (const item of homeCopy.en.plannedItems)
      expect(markup.indexOf(item)).toBeGreaterThan(planned);
  });

  it("keeps the retired framing and replay wording off the home page", () => {
    const korean = JSON.stringify(homeCopy.ko);
    expect(korean).not.toContain("리플레이");
    for (const retired of [
      "After the alert",
      "Bounded application",
      "concentrated-buy",
    ])
      expect(markup).not.toContain(retired);
  });

  it("puts the model comparison in the first navigation group in both languages", () => {
    for (const groups of Object.values(navigationCopy)) {
      const [, first] = groups[0]!;
      expect(first.map(([, href]) => href)).toEqual(["/", "/evals", "/replay"]);
    }
  });
});
