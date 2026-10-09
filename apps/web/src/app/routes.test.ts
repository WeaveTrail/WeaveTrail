import { existsSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ReplayScenarioSchema } from "@weavetrail/contracts";
import { describe, expect, it } from "vitest";

import historical from "../../../../packages/evals/results/financial-replay-v2.json";
import { committedReplaySources } from "../lib/replay-sources";
import { prepareReplayScenarios } from "./replay/prepare-scenarios";
import { shellCopy } from "./shell/copy";

const appDirectory = resolve(fileURLToPath(import.meta.url), "..");

function files(directory: string, name: RegExp): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return files(path, name);
    return name.test(entry.name) ? [relative(appDirectory, path)] : [];
  });
}

/**
 * The site serves exactly these routes. A page or API route that a removed
 * capability needed cannot come back without changing this list, the
 * navigation and the route lists in the deployment and architecture docs.
 */
const PAGES = [
  "page.tsx",
  "architecture/page.tsx",
  "data-handling/page.tsx",
  "evals/page.tsx",
  "expectations/page.tsx",
  "methodology/page.tsx",
  "replay/page.tsx",
  "why/page.tsx",
];
const API_ROUTES = ["api/mapping/route.ts", "api/replay/route.ts"];

describe("served routes", () => {
  it("serves exactly the current pages and API routes", () => {
    expect(files(appDirectory, /^page\.tsx$/).sort()).toEqual(
      [...PAGES].sort(),
    );
    expect(files(appDirectory, /^route\.[cm]?[jt]sx?$/).sort()).toEqual(
      API_ROUTES,
    );
  });

  it("puts every page in the navigation, in both languages", () => {
    const routes = PAGES.map((page) =>
      page === "page.tsx" ? "/" : `/${page.replace("/page.tsx", "")}`,
    ).sort();
    for (const { navigation } of Object.values(shellCopy))
      expect(
        navigation.flatMap(([, items]) => items.map(([, href]) => href)).sort(),
      ).toEqual(routes);
  });

  it("offers only synthetic sources", async () => {
    expect(ReplayScenarioSchema.options).toEqual(
      Object.keys(committedReplaySources),
    );
    for (const source of Object.values(committedReplaySources))
      expect(source.provenance.kind).toBe("synthetic");
    const prepared = await prepareReplayScenarios();
    for (const source of prepared.scenarios)
      expect(source.provenance?.kind).toBe("synthetic");
    expect(prepared).not.toHaveProperty("coverage");
  });

  /**
   * The real-data tier was withdrawn (ADR 0056) because its publication was
   * not permitted. These artifacts and scenario names stay absent even
   * outside the source registry.
   */
  it("keeps withdrawn artifacts and scenario names out", () => {
    for (const path of [
      "packages/published-data",
      "docs/assets/worked-case.svg",
      "docs/assets/worked-case.ko.svg",
    ])
      expect(existsSync(path), path).toBe(false);
    const withdrawn = historical.scenarios.filter(
      (item) => item.dataKind === "published",
    );
    expect(withdrawn).not.toHaveLength(0);
    for (const source of withdrawn)
      expect(ReplayScenarioSchema.safeParse(source.scenario).success).toBe(
        false,
      );
  });
});
