import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import publication from "./scenario-expectations.json";
import ExpectationsPage from "./page";

describe("published scenario expectations page", () => {
  it("renders every generated expected value and the clean-session boundary", () => {
    const markup = renderToStaticMarkup(createElement(ExpectationsPage));

    expect(markup).toContain("Reproduce a baseline from a clean session");
    expect(markup).toContain("Approval hashing requires Web Crypto");
    expect(markup).toContain("same-input repeatability only");
    expect(markup).toContain("marked engine regression");
    expect(markup).toContain("pnpm expectations:update");
    expect(markup).toContain("Vitest");
    expect(markup).toContain("Linux WSL2 x86_64");
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
        for (const rule of scenario.hypothesis.rules) {
          expect(markup).toContain(`${rule.ruleId}@${rule.ruleVersion}`);
        }
      }
      for (const gate of scenario.gates) {
        expect(markup).toContain(gate.gate);
        expect(markup).toContain(gate.observedValue ?? "not produced");
        expect(markup).toContain(gate.threshold);
      }
    }
  });
});
