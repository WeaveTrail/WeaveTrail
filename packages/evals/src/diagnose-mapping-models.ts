import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConfiguredSchemaMappingProvider } from "@weavetrail/ai-harness/server";
import {
  readEvaluationModels,
  requireLiveMappingCommand,
} from "./mapping-model-runner";
import { dialectMappingInput } from "./schema-dialects-v2";
import { CorpusSchema } from "./mapping-scorer";
import { diagnosticTransport } from "./provider-diagnostics";
import { root } from "./held-out-protocol";

async function main() {
  const args = process.argv.slice(2);
  requireLiveMappingCommand(args, process.env);
  if (
    args[0] !== "--live" ||
    args.length > 2 ||
    (args.length === 2 && args[1] !== "--legacy-store")
  )
    throw new Error("Arguments");
  const legacy = args.includes("--legacy-store");
  const input = dialectMappingInput(
    CorpusSchema.parse(
      JSON.parse(
        readFileSync(
          resolve(root, "packages/evals/fixtures/schema-dialects-v2/DEV.json"),
          "utf8",
        ),
      ),
    ).dialects[0]!,
  );
  const directory = resolve(root, ".model-runs/raw", `dev-${randomUUID()}`);
  const transport = diagnosticTransport(directory);
  const probe: typeof fetch = (url, options) =>
    transport(
      url,
      legacy
        ? {
            ...options,
            body: JSON.stringify({
              ...JSON.parse(String(options?.body)),
              store: false,
            }),
          }
        : options,
    );
  for (const model of readEvaluationModels(process.env)) {
    const attempt = await new ConfiguredSchemaMappingProvider(
      model,
      probe,
    ).attempt(input);
    console.log(
      JSON.stringify({
        model: model.model,
        httpStatus: attempt.httpStatus,
        outcome: attempt.outcome,
        failureClass: attempt.failureClass,
      }),
    );
  }
  console.log(`Server-only error bodies: ${directory}`);
}
main().catch(() => {
  console.error(
    "DEV diagnostic failed; raw errors and credentials are never printed.",
  );
  process.exitCode = 1;
});
