import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { evaluateDevGate } from "./dev-gate";
import { root } from "./held-out-protocol";

const { values } = parseArgs({
  options: {
    before: { type: "string" },
    after: { type: "string" },
    expected: { type: "string" },
  },
});
if (!values.before || !values.after)
  throw new Error(
    "Use --before <session> --after <session> [--expected <gate.json>]",
  );
const result = evaluateDevGate(resolve(values.before), resolve(values.after));
const bytes = JSON.stringify(result, null, 2) + "\n";
if (values.expected && readFileSync(values.expected, "utf8") !== bytes)
  throw new Error("DEV gate result differs from committed bytes");
const output = resolve(root, "dist/mapping-dev-gate");
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "gate.json"), bytes);
console.log(
  `Offline ADR 0075 gate 2: ${result.passed ? "PASSED" : "NOT PASSED"}; ${output}/gate.json`,
);
