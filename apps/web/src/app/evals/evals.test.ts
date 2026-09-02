import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { checks } from "./page";

describe("public evaluation ledger", () => {
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
