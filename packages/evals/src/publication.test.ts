import { deepStrictEqual } from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { it } from "vitest";
import { runEvaluation } from "./runner";

it("reproduces the committed evaluation without updating any oracle", async () => {
  const result = await runEvaluation();
  const committed = readFileSync(
    new URL("../results/financial-replay-v3.json", import.meta.url),
    "utf8",
  );
  // Explicit assertion, deliberately independent of Vitest's snapshot update mode.
  deepStrictEqual(result, JSON.parse(committed));
  const output = await format(JSON.stringify(result, null, 2), {
    parser: "json",
  });
  deepStrictEqual(output, committed);
  if (process.env.WEAVETRAIL_EVALUATION_OUTPUT) {
    writeFileSync(process.env.WEAVETRAIL_EVALUATION_OUTPUT, output);
  }
});
