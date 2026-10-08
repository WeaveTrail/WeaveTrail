import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  readEvaluationModels,
  requireLiveMappingCommand,
} from "./mapping-model-runner";
import { runHeldOut, root } from "./held-out-protocol";
async function main() {
  const args = process.argv.slice(2);
  requireLiveMappingCommand(args, process.env);
  if (
    args.length !== 3 ||
    args[0] !== "--live" ||
    args[1] !== "--catalogue" ||
    !args[2]
  )
    throw new Error("Arguments");
  const output = await runHeldOut(
    readEvaluationModels(process.env),
    JSON.parse(readFileSync(args[2], "utf8")),
    resolve(root, "dist/mapping-held-out"),
  );
  console.log(`HELD_OUT records and receipts: ${output}`);
}
main().catch(() => {
  console.error(
    "HELD_OUT command failed. Check --live --catalogue, committed pre-run seals, run-date catalogue and server-only configuration. No raw provider errors are printed.",
  );
  process.exitCode = 1;
});
