import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { checks } from "./checks";

describe("public evaluation ledger", () => {
  it("uses published-schema classification evidence instead of regression placeholders", () => {
    const classification = checks.find(
      ({ name }) => name === "Scenario classification",
    );
    if (classification?.status !== "Implemented")
      throw new Error("Expected an implemented classification row");
    expect(classification.evidence).toContainEqual({
      file: "packages/replay-engine/src/published-execution-schema.test.ts",
      titles: [
        "pins the artifact, dataset, manifest approval and canonical result hashes",
      ],
    });
    const titles = classification.evidence.flatMap<string>(
      ({ titles }) => titles,
    );
    expect(titles).not.toContain(
      "pins rapid-price-lift-supported.csv to SUPPORTED",
    );
    expect(titles).not.toContain(
      "pins rapid-price-lift-broad-participation.csv to NOT_SUPPORTED",
    );
    expect(titles).toContain(
      "pins rapid-price-lift-insufficient-evidence.csv to INCONCLUSIVE",
    );
    expect(titles).toContain(
      "pins NOT_SUPPORTED, the failing gates and result hash through approved %s replay",
    );
  });

  it("binds every implemented row to committed test titles", () => {
    for (const check of checks) {
      if (check.status !== "Implemented") continue;

      expect(check.evidence.length, check.name).toBeGreaterThan(0);
      for (const evidence of check.evidence) {
        const source = readFileSync(
          resolve(process.cwd(), evidence.file),
          "utf8",
        );
        for (const title of evidence.titles) {
          expect(source, `${check.name}: ${title}`).toContain(title);
        }
      }
    }
  });

  it("keeps planned rows free of implementation evidence", () => {
    for (const check of checks) {
      if (check.status === "Planned") {
        expect("evidence" in check, check.name).toBe(false);
      }
    }
  });

  it("names every implemented row in the public evaluation protocol", () => {
    const protocol = readFileSync(
      resolve(process.cwd(), "docs/EVALUATION.md"),
      "utf8",
    );

    for (const check of checks) {
      if (check.status === "Implemented") {
        expect(protocol, check.name).toContain(check.name);
      }
    }
  });
});
