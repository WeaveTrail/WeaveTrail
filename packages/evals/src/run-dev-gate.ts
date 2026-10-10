import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  readEvaluationModels,
  requireLiveMappingCommand,
} from "./mapping-model-runner";
import { diagnosticTransport } from "./provider-diagnostics";
import { root } from "./held-out-protocol";
import { runDevGate } from "./dev-gate";

async function main() {
  const args = process.argv.slice(2);
  requireLiveMappingCommand(args, process.env);
  if (
    args[0] !== "--live" ||
    args.length > 2 ||
    (args.length === 2 && args[1] !== "--diagnostics")
  )
    throw new Error("Arguments");
  const directories = await runDevGate(
    readEvaluationModels(process.env),
    resolve(root, "dist/mapping-dev-gate"),
    args.includes("--diagnostics")
      ? diagnosticTransport(
          resolve(root, ".model-runs/raw", `dev-gate-${randomUUID()}`),
        )
      : undefined,
  );
  for (const [role, directory] of Object.entries(directories))
    console.log(`${role} DEV records and receipts: ${directory}`);
}
main().catch(() => {
  console.error(
    "DEV gate command failed. Check --live, the committed v4 DEV seal, a clean checkout and server-only configuration. No raw provider errors are printed.",
  );
  process.exitCode = 1;
});
