import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import capture from "../../../../../packages/evals/results/financial-replay-v2.run.json";
import broadProvenance from "../../../../../packages/scenarios/src/sources/published-execution-fix44-broad-participation.provenance.json";
import { LanguageProvider } from "../i18n/language";
import { caseApprovalStep } from "../replay/steps/case-approval";
import { mappingStep } from "../replay/steps/mapping";
import { runStep } from "../replay/steps/run";
import { captureEnvironment } from "./capture";
import ExpectationsPage from "./page";
import publication from "./scenario-expectations.json";

const render = (language: "en" | "ko" = "en") => {
  const page = createElement(ExpectationsPage);
  return renderToStaticMarkup(
    language === "ko" ? createElement(LanguageProvider, null, page) : page,
  );
};

describe("expected results page", () => {
  it("states the environment the committed expectations were captured in", () => {
    expect(captureEnvironment).toEqual({
      node: capture.environment.node.replace(/^v/, ""),
      pnpm: capture.environment.pnpm,
      vitest: capture.environment.vitest,
    });
    expect(broadProvenance.validation.environment).toContain(
      `Vitest ${capture.environment.vitest}`,
    );
    for (const language of ["en", "ko"] as const) {
      const markup = render(language);
      expect(markup).toContain("pnpm expectations:update");
      expect(markup).toContain(`Node <code>${captureEnvironment.node}</code>`);
      expect(markup).toContain(`pnpm <code>${captureEnvironment.pnpm}</code>`);
      expect(markup).toContain(
        `Vitest <code>${captureEnvironment.vitest}</code>`,
      );
      expect(markup).toContain("Linux WSL2 x86_64");
    }
  });

  it("renders every generated expected value", () => {
    const markup = render();
    for (const scenario of publication.scenarios) {
      expect(markup).toContain(scenario.scenario);
      expect(markup).toContain(scenario.workflowState);
      if (scenario.canonicalDatasetHash !== null)
        expect(markup).toContain(scenario.canonicalDatasetHash);
      if (scenario.canonicalResultHash !== null)
        expect(markup).toContain(scenario.canonicalResultHash);
      else
        expect(markup).toContain("Not produced; stopped for pre-replay review");
      expect(markup).toContain(scenario.availableMutations.join(", "));
      if (scenario.result !== null) expect(markup).toContain(scenario.result);
      if (scenario.demonstrates !== null)
        expect(markup).toContain(scenario.demonstrates);
      for (const reviewIssue of scenario.reviewIssues)
        expect(markup).toContain(reviewIssue);
      if (scenario.hypothesis !== null) {
        expect(markup).toContain(scenario.hypothesis.pattern);
        expect(markup).toContain(scenario.hypothesis.manifestVersion);
        expect(markup).toContain(scenario.hypothesis.instrumentIds[0]);
        expect(markup).toContain(scenario.hypothesis.actorIds[0]);
        for (const rule of scenario.hypothesis.rules)
          expect(markup).toContain(`${rule.ruleId}@${rule.ruleVersion}`);
      }
      for (const gate of scenario.gates) {
        expect(markup).toContain(gate.gate);
        expect(markup).toContain(gate.observedValue ?? "not produced");
        expect(markup).toContain(gate.threshold);
      }
    }
  });

  it("lists the cases a visitor can pick before the engine regressions", () => {
    const markup = render();
    const listed = publication.scenarios.filter((s) => s.availableInCaseReplay);
    const regressions = publication.scenarios.filter(
      (s) => !s.availableInCaseReplay,
    );
    const lastListed = Math.max(
      ...listed.map((s) => markup.indexOf(`<th scope="row">${s.label}`)),
    );
    for (const s of regressions)
      expect(markup.indexOf(`<th scope="row">${s.label}`)).toBeGreaterThan(
        lastListed,
      );
  });

  it("quotes the walkthrough's own control labels in both languages", () => {
    for (const language of ["en", "ko"] as const) {
      const markup = render(language);
      for (const label of [
        mappingStep.panel[language].approve,
        caseApprovalStep.panel[language].approve,
        runStep.panel[language].run,
      ])
        expect(markup, `${language}: ${label}`).toContain(label);
    }
    expect(render()).toContain("same-input repeatability only");
    expect(render()).toContain("Web Crypto");
  });
});
