import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
import { loadDevGateCorpus } from "./dev-gate";

/**
 * One DEV request per configured candidate. By default it probes the first
 * sealed v4 DEV dialect with the ADR 0075 stack (gate 3); `--legacy-store`
 * reproduces the removed request parameter on v2 DEV with the ADR 0069 stack.
 * Only each candidate's HTTP status and closed outcome are printed and written.
 */
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
  const { corpus, sha256 } = legacy
    ? {
        corpus: CorpusSchema.parse(
          JSON.parse(
            readFileSync(
              resolve(
                root,
                "packages/evals/fixtures/schema-dialects-v2/DEV.json",
              ),
              "utf8",
            ),
          ),
        ),
        sha256: null,
      }
    : loadDevGateCorpus();
  const dialect = corpus.dialects[0]!;
  const input = dialectMappingInput(dialect);
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
  const stack = legacy ? "adr-0069" : "adr-0075";
  const probedAt = new Date().toISOString();
  const results = [];
  for (const model of readEvaluationModels(process.env)) {
    const attempt = await new ConfiguredSchemaMappingProvider(
      model,
      probe,
      stack,
    ).attempt(input);
    const result = {
      model: model.model,
      httpStatus: attempt.httpStatus,
      outcome: attempt.outcome,
      failureClass: attempt.failureClass,
    };
    console.log(JSON.stringify(result));
    results.push(result);
  }
  if (!legacy) {
    const output = resolve(root, "dist/mapping-probe");
    mkdirSync(output, { recursive: true });
    const file = resolve(output, `probe-${probedAt.slice(0, 10)}.json`);
    writeFileSync(
      file,
      JSON.stringify(
        {
          version: "mapping-probe/1",
          probedAt,
          stack,
          evaluationSet: { version: corpus.version, sha256, split: "DEV" },
          dialectId: dialect.id,
          results,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    console.log(`Sanitized probe output: ${file}`);
  }
  console.log(`Server-only error bodies: ${directory}`);
}
main().catch(() => {
  console.error(
    "DEV diagnostic failed; raw errors and credentials are never printed.",
  );
  process.exitCode = 1;
});
