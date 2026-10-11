import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DECLARED_MODELS,
  FAILURE_LOG_ENTRIES,
} from "../evals/model-comparison-data";
import { GUIDE_STAGES, guideStageNames } from "../guide-stages";
import publication from "../expectations/scenario-expectations.json";
import { LANGUAGES } from "../i18n/language";
import { replayCopy } from "../replay/copy";
import { committedReplaySources } from "../../lib/replay-sources";
import { HOME_TERM_KEYS, homeCopy } from "./copy";
import { HOME_EXAMPLE_SCENARIO, homeExample } from "./example";
import { plainText } from "./home-view";
import HomePage from "../page";
import { shellCopy } from "../shell/copy";

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

  it("leads the first navigation group with the walkthrough in both languages", () => {
    for (const { navigation: groups } of Object.values(shellCopy)) {
      const [, first] = groups[0]!;
      expect(first.map(([, href]) => href)).toEqual(["/replay", "/", "/evals"]);
    }
  });

  it("shows the worked case's committed end screen as a labelled example", () => {
    const example = homeExample();
    const captured = publication.scenarios.find(
      (entry) => entry.scenario === HOME_EXAMPLE_SCENARIO,
    )!;
    // The example is the guided walkthrough's worked case.
    expect(captured.availableInCaseReplay).toBe(true);
    expect(example.result).toBe(captured.result);
    expect(example.gates).toEqual(captured.gates);
    expect(example.canonicalResultHash).toBe(captured.canonicalResultHash);
    const proposal =
      committedReplaySources[HOME_EXAMPLE_SCENARIO].mappingProposal.fields;
    for (const { sourceColumn, targetField } of example.mapping)
      expect(proposal).toContainEqual(
        expect.objectContaining({ sourceColumn, targetField }),
      );

    expect(markup).toContain(homeCopy.en.example.eyebrow);
    expect(markup).toContain(`data-result="${example.result}"`);
    for (const gate of example.gates) {
      expect(markup).toContain(gate.observedValue);
      expect(markup).toContain(gate.threshold);
      expect(markup).toContain(replayCopy.en.machine.gates[gate.gate].label);
    }
    expect(markup).toContain(example.canonicalResultHash.slice(0, 12));
  });

  it("makes no model-selection claim on the home page", () => {
    const text = markup.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(
      /NO_MODEL|no model|model is chosen|primary model/i,
    );
    for (const copy of [homeCopy.en, homeCopy.ko])
      expect(JSON.stringify(copy)).not.toMatch(
        /NO_MODEL|고른 모델|선택한 모델|기본 모델/,
      );
  });

  it("gives every first-screen term an explanation, the same terms in both languages", () => {
    const termsIn = (marked: string) =>
      [...marked.matchAll(/\[\[(\w+)\|/g)].map((match) => match[1]).sort();
    const sentences = (language: (typeof LANGUAGES)[number]) => {
      const example = homeCopy[language].example;
      return [example.mappingLabel, example.gatesLabel, example.control];
    };
    const [en, ko] = LANGUAGES.map(sentences) as [string[], string[]];
    const used = new Set<string>();
    en.forEach((sentence, index) => {
      expect(termsIn(ko[index]!), sentence).toEqual(termsIn(sentence));
      for (const key of termsIn(sentence)) used.add(key!);
    });
    expect([...used].sort()).toEqual([...HOME_TERM_KEYS].sort());
    for (const language of LANGUAGES)
      for (const key of HOME_TERM_KEYS) {
        const [term, explanation] = homeCopy[language].example.terms[key];
        expect(term.length, key).toBeGreaterThan(0);
        expect(explanation.length, key).toBeGreaterThan(0);
      }
    // Contract values stay untranslated.
    expect(plainText(homeCopy.ko.example.control)).toContain("REVIEW_REQUIRED");
  });

  it("never has the AI judge, approve or verify", () => {
    for (const language of LANGUAGES) {
      const example = homeCopy[language].example;
      const text = [
        example.mappingLabel,
        example.gatesLabel,
        example.control,
        ...Object.values(example.terms).flat(),
      ]
        .map(plainText)
        .join("\n");
      expect(text).not.toMatch(
        /\b(AI|model)s? (judges?|approves?|verif(y|ies))\b/i,
      );
      expect(text).not.toMatch(/(AI|모델)(가|이) (판단|승인|검증)/);
    }
  });
});
