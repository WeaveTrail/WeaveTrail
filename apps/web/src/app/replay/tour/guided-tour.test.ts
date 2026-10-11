import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { committedReplaySources } from "../../../lib/replay-sources";
import { LANGUAGES } from "../../i18n/language";
import type { GateName } from "../copy";
import { prepareReplayScenarios } from "../prepare-scenarios";
import { WORKED_CASE } from "../use-case-replay";
import { SCENES, tourCopy } from "./copy";
import { GuidedTour } from "./guided-tour";

/** React escapes text nodes; compare against the same escaping. */
const escaped = (text: string) => text.replace(/'/g, "&#x27;");

const GATES: readonly GateName[] = [
  "PRICE_CHANGE",
  "AGGRESSIVE_BUY_SHARE",
  "ACTOR_CONCENTRATION",
  "REPEATED_EXECUTION",
  "REMOVAL_SENSITIVITY",
];

describe("guided walkthrough", () => {
  it("opens on the worked case's source, untouched, with one action", async () => {
    const prepared = await prepareReplayScenarios();
    const markup = renderToStaticMarkup(createElement(GuidedTour, prepared));
    const text = tourCopy.en;
    expect(markup).toContain(escaped(text.scenes.source.title));
    for (const id of SCENES) expect(markup).toContain(text.scenes[id].short);
    // Every committed value of the worked case is shown as received.
    for (const row of committedReplaySources[WORKED_CASE].rows)
      for (const value of Object.values(row.values))
        expect(markup).toContain(`<code>${value}</code>`);
    expect(markup).toContain(escaped(text.source.goal));
    expect(markup.match(/class="button primary"/g)).toHaveLength(1);
    expect(markup).toContain(escaped(text.source.action));
    // Nothing has been approved or computed before the visitor acts.
    expect(markup).not.toContain("tour-verdict");
    expect(markup).not.toContain(text.mapping.done);
  });

  it("names every rule check as a criterion in both languages", () => {
    for (const language of LANGUAGES)
      for (const gate of GATES) {
        const criterion = tourCopy[language].scope.criteria[gate]("2");
        expect(criterion, `${language} ${gate}`).toContain("2");
      }
  });

  it("names every field of the worked case's proposal in both languages", () => {
    const fields = committedReplaySources[
      WORKED_CASE
    ].mappingProposal.fields.map(({ targetField }) => targetField!);
    for (const language of LANGUAGES)
      for (const field of fields)
        expect(
          tourCopy[language].mapping.fields[field],
          `${language} ${field}`,
        ).toBeDefined();
  });

  it("says the suggestion and the scope were prepared, in both languages", () => {
    for (const language of LANGUAGES) {
      expect(tourCopy[language].mapping.prepared).toMatch(
        /prepared|미리 준비한/,
      );
      expect(tourCopy[language].scope.prepared).toMatch(/advance|미리/);
    }
  });
});
