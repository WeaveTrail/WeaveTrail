import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadHeldOutSession,
  loadSelectionInputs,
  root,
} from "./held-out-protocol";
import { selectMappingModels } from "./mapping-selection";
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--session" || !args[1])
  throw new Error("Use --session <dist/mapping-held-out/session-id>");
const { records, session, protocolVersion } = loadHeldOutSession(
  resolve(args[1]),
);
const { source, prices } = loadSelectionInputs(false, protocolVersion);
const result = selectMappingModels(records, source, prices, session);
const output = resolve(root, "dist/mapping-selection");
mkdirSync(output, { recursive: true });
for (const [name, value] of Object.entries(result))
  writeFileSync(
    resolve(output, `${name}.json`),
    JSON.stringify(value, null, 2) + "\n",
  );
console.log(
  `Offline ${result.decision.rule} result: ${result.decision.outcome}; ${output}`,
);
