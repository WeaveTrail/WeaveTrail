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
    for (const scenario of publication.scenarios) {
      expect(markup).toContain(scenario.scenario);
      expect(markup).toContain(scenario.workflowState);
      expect(markup).toContain(scenario.canonicalDatasetHash);
      expect(markup).toContain(scenario.canonicalResultHash);
      if (scenario.result !== null) expect(markup).toContain(scenario.result);
      for (const gate of scenario.gates) {
        expect(markup).toContain(gate.gate);
        expect(markup).toContain(gate.observedValue ?? "not produced");
        expect(markup).toContain(gate.threshold);
      }
    }
  });
});
