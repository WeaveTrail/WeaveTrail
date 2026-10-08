import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { MappingPriceTableSchema } from "./mapping-scorer";
import { SELECTION_MODELS } from "./mapping-selection";
it("reproduces dated standard prices from the attributed original response", () => {
  const directory = new URL(
    "../fixtures/mapping-selection-v1/",
    import.meta.url,
  );
  const prices = MappingPriceTableSchema.parse(
    JSON.parse(readFileSync(new URL("prices.json", directory), "utf8")),
  );
  const bytes = readFileSync(
    new URL("google-pricing-2026-10-08.html.txt", directory),
  );
  expect(prices.provenance).toContain(
    createHash("sha256").update(bytes).digest("hex"),
  );
  expect(prices.entries.map((e) => e.requestedModel)).toEqual([
    ...SELECTION_MODELS,
  ]);
  expect(bytes.toString()).toContain("creativecommons.org/licenses/by/4.0");
  expect(() =>
    execFileSync(process.execPath, ["scripts/extract-mapping-prices.mjs"], {
      cwd: new URL("../../../", import.meta.url),
    }),
  ).not.toThrow();
});
