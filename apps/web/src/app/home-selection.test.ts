import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import firstComparison from "../../../../packages/evals/results/mapping-held-out-v1/comparison.json";
import firstDecision from "../../../../packages/evals/results/mapping-held-out-v1/decision.json";
import { committedHeldOutResult } from "./evals/held-out-result";
import type {
  ComparisonGroup,
  HeldOutResult,
} from "./evals/model-comparison-data";
import {
  HOME_TERM_KEYS,
  HomeContent,
  homeCopy,
  plainText,
} from "./home-content";
import { homeSelection, type HomeSelection } from "./home-selection";
import { LANGUAGES } from "./i18n/language";
import HomePage from "./page";

/** A synthetic SELECTED decision over the committed comparison's shape. */
function selectedResult(escalation: string | null): HeldOutResult {
  const base = committedHeldOutResult;
  const [first, second] = base.comparison.groups.filter(
    (group) => group.role === "MODEL",
  ) as [ComparisonGroup, ComparisonGroup];
  const observed = (group: ComparisonGroup, numerator: string) => {
    const all = group.byTag.ALL!;
    const runs = all.providerFailed.denominator;
    const byTag = Object.fromEntries(
      Object.entries(group.byTag).map(([tag, metrics]) => [
        tag,
        {
          ...metrics,
          providerFailed: { numerator: "0", denominator: runs },
          validOutput: { numerator, denominator: runs },
          strictAccuracy: { numerator: "9", denominator: "10" },
        },
      ]),
    );
    return { ...group, byTag };
  };
  return {
    ...base,
    comparison: {
      ...base.comparison,
      groups: [observed(first, "170"), observed(second, "160")],
    },
    decision: {
      ...base.decision,
      outcome: "SELECTED",
      primary: first.identity.requestedModel,
      escalation: escalation === null ? null : second.identity.requestedModel,
      eligible: [first.identity.requestedModel],
    },
  };
}

const render = (selection: HomeSelection) =>
  renderToStaticMarkup(createElement(HomeContent, { selection }));

/** The visible text of the first-screen section, without the term popovers. */
function firstScreenText(markup: string): string {
  const section = markup.slice(
    markup.indexOf('<section class="hero home-answer'),
    markup.indexOf('<div aria-labelledby="home-term-'),
  );
  return section.replace(/<[^>]+>/g, " ");
}

describe("the home page answers the model-selection question", () => {
  it("reads the committed recovery session as observed output with no qualifier", () => {
    expect(committedHeldOutResult.decision.outcome).toBe("NO_MODEL");
    expect(committedHeldOutResult.decision.session?.sessionId).toBe(
      "f869738c-fb61-42df-9b50-ecfd9c3b299a",
    );
    expect(homeSelection(committedHeldOutResult)).toEqual({
      state: "planned",
      reason: "noneQualified",
    });
  });

  it("reads a session with no model output, and no session, as planned", () => {
    // The first capture: every request failed at the provider.
    const firstSession: HeldOutResult = {
      ...committedHeldOutResult,
      comparison: firstComparison as HeldOutResult["comparison"],
      decision: firstDecision as HeldOutResult["decision"],
    };
    expect(homeSelection(firstSession)).toEqual({
      state: "planned",
      reason: "noOutput",
    });
    expect(homeSelection(null)).toEqual({ state: "planned", reason: "notRun" });
  });

  it("shows no numbers until a selection is published", () => {
    for (const reason of ["notRun", "noOutput", "noneQualified"] as const) {
      const text = firstScreenText(render({ state: "planned", reason }));
      expect(text, reason).not.toMatch(/\d/);
    }
    const page = renderToStaticMarkup(createElement(HomePage));
    expect(firstScreenText(page)).not.toMatch(/\d/);
    expect(page).toContain('data-state="planned"');
    expect(page.replace(/<[^>]+>/g, "")).toContain(
      plainText(homeCopy.en.answer.planned.noneQualified),
    );
  });

  it("names the selected models and links every number to its definition and run", () => {
    const selection = homeSelection(selectedResult("escalation"));
    expect(selection.state).toBe("selected");
    if (selection.state !== "selected") return;
    expect(selection.primaryAccuracy).toEqual({
      numerator: "27",
      denominator: "30",
    });
    const markup = render(selection);
    expect(markup).toContain(selection.primary);
    expect(markup).toContain(selection.escalation!);
    expect(markup).toContain("27/30 · 90.0%");
    expect(markup).toContain(
      `${selection.validOutput.numerator}/${selection.validOutput.denominator}`,
    );
    expect(markup).toContain(
      "docs/EVALUATION.md#declared-mapping-model-selection-rule",
    );
    expect(markup).toContain("docs/EVALUATION.md#offline-mapping-run-scoring");
    expect(markup).toContain(`href="${selection.sessionReceipt}"`);
    expect(markup).toContain(`Run on ${selection.runDate}`);

    const primaryOnly = homeSelection(selectedResult(null));
    expect(primaryOnly.state === "selected" && primaryOnly.escalation).toBe(
      null,
    );
    expect(render(primaryOnly)).toContain(
      "no other candidate qualifies as the",
    );
  });

  it("gives every first-screen term an explanation, the same terms in both languages", () => {
    const termsIn = (marked: string) =>
      [...marked.matchAll(/\[\[(\w+)\|/g)].map((match) => match[1]).sort();
    const sentences = (language: (typeof LANGUAGES)[number]) => {
      const answer = homeCopy[language].answer;
      return [
        answer.question,
        ...Object.values(answer.planned),
        answer.selected("p", "e"),
        answer.primaryOnly("p"),
        answer.control,
      ];
    };
    const [en, ko] = LANGUAGES.map(sentences) as [string[], string[]];
    en.forEach((sentence, index) => {
      expect(termsIn(ko[index]!), sentence).toEqual(termsIn(sentence));
      for (const key of termsIn(sentence))
        expect(HOME_TERM_KEYS, key).toContain(key);
    });
    for (const language of LANGUAGES)
      for (const key of HOME_TERM_KEYS) {
        const [term, explanation] = homeCopy[language].answer.terms[key];
        expect(term.length, key).toBeGreaterThan(0);
        expect(explanation.length, key).toBeGreaterThan(0);
      }
    // Contract values stay untranslated.
    expect(plainText(homeCopy.ko.answer.control)).toContain("REVIEW_REQUIRED");
  });

  it("never calls a model the best or has the AI judge, approve or verify", () => {
    for (const language of LANGUAGES) {
      const answer = homeCopy[language].answer;
      const text = [
        answer.question,
        ...Object.values(answer.planned),
        answer.selected("p", "e"),
        answer.primaryOnly("p"),
        answer.control,
        ...Object.values(answer.terms).flat(),
      ]
        .map(plainText)
        .join("\n");
      expect(text).not.toMatch(/\bbest\b|최고|최선/i);
      expect(text).not.toMatch(
        /\b(AI|model)s? (judges?|approves?|verif(y|ies))\b/i,
      );
      expect(text).not.toMatch(/(AI|모델)(가|이) (판단|승인|검증)/);
    }
  });
});
