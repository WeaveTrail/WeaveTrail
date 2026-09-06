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
    expect(markup).toContain("including Dialect A and Dialect B");
    expect(markup).toContain("Git revision");
    expect(markup).toContain("0ab7d3bf8f1016306f1c0225f5fa12a3415c2b79");
    expect(markup).toContain("Linux WSL2 x86_64");
    for (const scenario of publication.scenarios) {
      expect(markup).toContain(scenario.scenario);
      expect(markup).toContain(scenario.workflowState);
      expect(markup).toContain(scenario.canonicalDatasetHash);
      expect(markup).toContain(scenario.canonicalResultHash);
      if (scenario.result !== null) expect(markup).toContain(scenario.result);
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
