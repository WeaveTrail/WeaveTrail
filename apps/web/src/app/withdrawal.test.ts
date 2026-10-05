import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReplayScenarioSchema } from "@weavetrail/contracts";
import { committedReplaySources } from "../lib/replay-sources";
import { prepareReplayScenarios } from "./replay/prepare-scenarios";
import { navigationCopy } from "./site-navigation";
import HomePage from "./page";
import current from "../../../../packages/evals/results/financial-replay-v3.json";
import historical from "../../../../packages/evals/results/financial-replay-v2.json";

const read = (path: string) => readFileSync(path, "utf8");

describe("committed real-data withdrawal", () => {
  it("removes artifacts, source-dependent routes and public figures", () => {
    for (const path of [
      "packages/published-data",
      "apps/web/src/app/case-2026-09-03/page.tsx",
      "apps/web/src/app/api/case-2026-09-03/route.ts",
      "apps/web/src/app/api/coverage/route.ts",
      "apps/web/src/app/api/check/coverage/route.ts",
      "docs/assets/worked-case.svg",
      "docs/assets/worked-case.ko.svg",
    ])
      expect(existsSync(path), path).toBe(false);
  });

  it("keeps the accepted source inventory synthetic and rejects withdrawn names", async () => {
    expect(ReplayScenarioSchema.options).toEqual(
      Object.keys(committedReplaySources),
    );
    for (const source of Object.values(committedReplaySources))
      expect(source.provenance.kind).toBe("synthetic");
    for (const source of historical.scenarios.filter(
      (item) => item.dataKind === "published",
    ))
      expect(ReplayScenarioSchema.safeParse(source.scenario).success).toBe(
        false,
      );
    const prepared = await prepareReplayScenarios();
    for (const source of prepared.scenarios)
      expect(source.provenance?.kind).toBe("synthetic");
    expect(prepared).not.toHaveProperty("coverage");
  });

  it("keeps the homepage usable and removes case links in both languages", () => {
    const markup = renderToStaticMarkup(createElement(HomePage));
    expect(markup).toContain('href="/replay?mode=guided"');
    expect(markup).not.toContain("/case-2026-09-03");
    for (const groups of Object.values(navigationCopy))
      for (const [, items] of groups)
        expect(items.map(([, href]) => href)).not.toContain("/case-2026-09-03");
  });

  it("preserves all retained evaluation oracles, hashes, mappings and mutations", () => {
    expect(current.scenarios).toEqual(
      historical.scenarios.filter((item) => item.dataKind === "synthetic"),
    );
    expect(current.mappings).toEqual(historical.mappings);
    expect(current.mutations).toEqual(historical.mutations);
    expect(current.counts.publishedBaselines).toBe(0);
    expect(current.evaluationVersion).toBe("financial-replay-evaluation/3");
    expect(read("packages/evals/results/README.md")).toContain("withdrawn");
  });

  it("keeps historical captures byte-for-byte unchanged", () => {
    const pins: Record<string, string> = {
      "packages/evals/results/financial-replay-v1.json":
        "2611d2d468dcd3b118d27dd2d2e800ff79f1879205128fe42e5061756abc9532",
      "packages/evals/results/financial-replay-v1.run.json":
        "f3e38bdfb8c4d67752ef765d072af94372c7f4bf7d8fa95a472818c2edd16f17",
      "packages/evals/results/financial-replay-v2.json":
        "7945d3626a2e334d64d61628c777457974db65f12a3f40144797f49af29b58cf",
      "packages/evals/results/financial-replay-v2.run.json":
        "f94cf2e38bd259454fe5772f5b96cd06ba00a5a71d5364bb958c04b4937b73ef",
      "packages/evals/results/published-claim-coverage-v1.json":
        "1aa0903e92d335d774a115a4265299ad3cbc88419dd6f3ec265430e28e040e44",
      "packages/evals/results/published-claim-coverage-v1.run.json":
        "65a4ccf4ccd4289681ac1a6889017bde1c02cf5fa0644fe290a2062bc80b46a7",
    };
    for (const [path, hash] of Object.entries(pins))
      expect(
        createHash("sha256").update(readFileSync(path)).digest("hex"),
        path,
      ).toBe(hash);
  });
});
