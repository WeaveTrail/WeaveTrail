import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("lab mapping status boundary", () => {
  it("does not render an approval status before approval binding exists", () => {
    const source = readFileSync(new URL("./lab.tsx", import.meta.url), "utf8");
    const providerSource = readFileSync(
      new URL(
        "../../../../../packages/ai-harness/src/fixture-provider.ts",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).not.toContain("APPROVED");
    expect(providerSource).not.toContain("APPROVED");
    expect(providerSource).toContain("PROPOSED");
    expect(source + providerSource).toContain("REVIEW_REQUIRED");
  });
});
