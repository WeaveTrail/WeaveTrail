import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FixtureSchemaMappingProvider } from "@weavetrail/ai-harness";
import {
  committedReplayScenarios,
  rapidPriceLiftScenarios,
} from "@weavetrail/scenarios";
import { validateLocalPayloadPaths } from "../../../../scripts/verify-design-snapshot.mjs";
import ArchitecturePage from "./architecture/page";
import EvalsPage from "./evals/page";
import { Lab, type LabScenario } from "./lab/lab";
import MethodologyPage from "./methodology/page";
import HomePage from "./page";

const forbidden = [
  "2.1.0",
  "rapid_price_lift@1.4.0",
  "mapping-proposal@1.2.0",
  "case-manifest@1.1.0",
  "fixture-mapper@0.3.1",
  "KRX-SYN-0007",
  "KRX-SYN-0011",
  "9f2c41ab77e0d3b5",
  "41b7de09c5a8f236",
  "c70a5be1148f9d32",
  "7d3e12aa08bf49c1",
  "act_44",
  "act_51",
  "act_07",
  "act_12",
  "act_19",
];

describe("canonical product presentation", () => {
  it("rejects forbidden and unrecorded local snapshot files", () => {
    const allowed = (path: string) =>
      path === "styles.css" ||
      path.startsWith("tokens/") ||
      path.startsWith("assets/");
    expect(() =>
      validateLocalPayloadPaths(
        ["styles.css", "ui_kits/workbench/fixtures.js"],
        ["styles.css"],
        allowed,
      ),
    ).toThrow("Local snapshot path is not allowlisted");
    expect(() =>
      validateLocalPayloadPaths(
        ["styles.css", "assets/unrecorded.svg"],
        ["styles.css"],
        allowed,
      ),
    ).toThrow("unexpected: assets/unrecorded.svg");
  });

  it("keeps all five routes in the common full-navigation shell", () => {
    const layout = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/layout.tsx"),
      "utf8",
    );
    const navigation = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/site-navigation.tsx"),
      "utf8",
    );
    for (const href of ["/", "/architecture", "/lab", "/evals", "/methodology"])
      expect(navigation).toContain(`"${href}"`);
    expect(navigation).toContain("Primary navigation");
    expect(navigation).toContain('aria-current={pathname === href ? "page"');
    expect(layout).toContain("skip-link");
  });

  it("keeps forbidden design fixtures out of rendered public pages", () => {
    const markup = [HomePage, ArchitecturePage, EvalsPage, MethodologyPage]
      .map((Page) => renderToStaticMarkup(createElement(Page)))
      .join("\n");
    for (const value of forbidden) expect(markup).not.toContain(value);
  });

  it("renders case scope only from committed scenarios", async () => {
    const provider = new FixtureSchemaMappingProvider();
    for (const [value, scenario] of Object.entries(rapidPriceLiftScenarios)) {
      const proposal = await provider.propose({
        sourceArtifactHash: scenario.sourceArtifactHash,
        constants: scenario.constants,
        columns: [...scenario.columns],
        sampleRows: [],
      });
      const labScenario: LabScenario = {
        value: value as LabScenario["value"],
        label: scenario.label,
        sourceArtifactHash: scenario.sourceArtifactHash,
        rows: scenario.rows,
        manifest: scenario.manifest,
      };
      const markup = renderToStaticMarkup(
        createElement(Lab, {
          proposals: { [scenario.sourceArtifactHash]: proposal },
          providerMode: "fixture",
          scenarios: [labScenario],
        }),
      );
      expect(markup).toContain(scenario.manifest.hypothesis.instrumentId);
      expect(markup).toContain(scenario.manifest.hypothesis.actorIds[0]!);
      expect(markup).toContain(scenario.manifest.hypothesis.startTime);
      expect(markup).toContain(
        committedReplayScenarios[value as keyof typeof committedReplayScenarios]
          .label,
      );
      for (const designValue of forbidden)
        expect(markup).not.toContain(designValue);
    }
  });

  it("keeps the three results separate from pre-replay review vocabulary", () => {
    const markup = renderToStaticMarkup(createElement(HomePage));
    for (const result of ["SUPPORTED", "NOT_SUPPORTED", "INCONCLUSIVE"])
      expect(markup).toContain(result);
    expect(markup).toContain("REVIEW_REQUIRED · pre-replay");
  });
});
