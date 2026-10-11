import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FAILURE_LOG_ENTRIES } from "../evals/model-comparison-data";
import { GUIDE_STAGES, guideStageNames } from "../guide-stages";
import { LANGUAGES } from "../i18n/language";
import HomePage from "../page";
import { shellCopy } from "../shell/copy";
import { plainText } from "../shell/sentence-lines";
import { homeCopy } from "./copy";

/** React escapes text nodes; compare against the same escaping. */
const escaped = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");

describe("home page", () => {
  const markup = renderToStaticMarkup(createElement(HomePage));
  const text = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  it("leads with what a reviewer gains and offers the walkthrough first", () => {
    const title = markup.indexOf('id="home-title"');
    const walkThrough = markup.indexOf('href="/replay?mode=guided"');
    expect(title).toBeGreaterThan(-1);
    expect(walkThrough).toBeGreaterThan(title);
    expect(text).toContain(plainText(homeCopy.en.intro.title));
    for (const sentence of homeCopy.en.intro.lede)
      expect(markup).toContain(escaped(sentence));
    // The walkthrough's prepared data and suggestion are said plainly.
    expect(markup).toContain(homeCopy.en.intro.demoNote);
  });

  it("draws the four stages under the guided walkthrough's names", () => {
    let cursor = -1;
    for (const stage of GUIDE_STAGES) {
      const next = markup.indexOf(`data-stage="${stage}"`);
      expect(next, stage).toBeGreaterThan(cursor);
      expect(markup).toContain(guideStageNames.en[stage]);
      expect(markup).toContain(homeCopy.en.stages[stage]);
      cursor = next;
    }
  });

  it("states each gain, and sends model choice to the comparison", () => {
    for (const [title, body] of homeCopy.en.benefits) {
      expect(markup).toContain(title);
      expect(text).toContain(escaped(body));
    }
    expect(markup).toContain('href="/evals"');
    expect(markup).toContain(
      homeCopy.en.failureLogLink(FAILURE_LOG_ENTRIES.length),
    );
    expect(markup).toContain('href="/why"');
  });

  it("sets each sentence of the lede on its own line", () => {
    const lede = /<p class="home-lede sentence-lines">(.*?)<\/p>/.exec(
      markup,
    )?.[1];
    expect(lede).toBeDefined();
    expect(lede!.match(/<span>/g)).toHaveLength(homeCopy.en.intro.lede.length);
  });

  it("keeps the retired framing and replay wording off the home page", () => {
    const korean = JSON.stringify(homeCopy.ko);
    expect(korean).not.toContain("리플레이");
    for (const retired of [
      "After the alert",
      "Bounded application",
      "concentrated-buy",
      "What is built",
    ])
      expect(markup).not.toContain(retired);
    expect(korean).not.toContain("만든 것");
  });

  it("leads the first navigation group with the walkthrough in both languages", () => {
    for (const { navigation: groups } of Object.values(shellCopy)) {
      const [, first] = groups[0]!;
      expect(first.map(([, href]) => href)).toEqual(["/replay", "/", "/evals"]);
    }
  });

  it("makes no model-selection claim on the home page", () => {
    expect(text).not.toMatch(
      /NO_MODEL|no model|model is chosen|primary model/i,
    );
    for (const copy of [homeCopy.en, homeCopy.ko])
      expect(JSON.stringify(copy)).not.toMatch(
        /NO_MODEL|고른 모델|선택한 모델|기본 모델/,
      );
  });

  it("never has the AI judge, approve or verify", () => {
    for (const language of LANGUAGES) {
      const copy = JSON.stringify(homeCopy[language]);
      expect(copy).not.toMatch(
        /\b(AI|model)s? (judges?|approves?|verif(y|ies))\b/i,
      );
      expect(copy).not.toMatch(/(AI|모델)(가|이) (판단|승인|검증)/);
    }
  });
});
