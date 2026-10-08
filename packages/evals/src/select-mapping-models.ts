import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadSelectionInputs, root } from "./held-out-protocol";
import { selectMappingModels } from "./mapping-selection";
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--records" || !args[1])
  throw new Error("Use --records <records.json>");
const { source, prices } = loadSelectionInputs();
const result = selectMappingModels(
  JSON.parse(readFileSync(args[1], "utf8")),
  source,
  prices,
);
const output = resolve(root, "dist/mapping-selection");
mkdirSync(output, { recursive: true });
for (const [name, value] of Object.entries(result))
  writeFileSync(
    resolve(output, `${name}.json`),
    JSON.stringify(value, null, 2) + "\n",
  );
console.log(`Offline ADR 0067 result: ${result.decision.outcome}; ${output}`);
