import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { MappingRunReceiptSchema } from "@weavetrail/contracts";
import { sha256Canonical } from "@weavetrail/replay-engine";
import { committedReplayScenarios } from "@weavetrail/scenarios";
import {
  readEvaluationModels,
  requireLiveMappingCommand,
  runConfiguredMapping,
} from "./mapping-model-runner";

// Explicit adapter smoke runs over a registered synthetic dialect. No gold,
// held-out input, scoring or automatic model selection enters this command.
async function main() {
  const args = process.argv.slice(2);
  requireLiveMappingCommand(args, process.env);
  const scenario = args[2];
  if (
    args.length !== 3 ||
    args[0] !== "--live" ||
    args[1] !== "--scenario" ||
    (scenario !== "concentrated-buy-dialect-a.csv" &&
      scenario !== "concentrated-buy-dialect-b.jsonl")
  )
    throw new Error(
      "Use --live --scenario concentrated-buy-dialect-a.csv (or dialect-b).",
    );
  const models = readEvaluationModels(process.env);
  const source = committedReplayScenarios[scenario]!;
  const output = new URL("../../../dist/mapping-runs/", import.meta.url);
  mkdirSync(output, { recursive: true });
  for (const model of models) {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const record = await runConfiguredMapping(
      model,
      {
        sourceArtifactHash: source.sourceArtifactHash,
        constants: source.constants,
        columns: [...source.columns],
        sampleRows: source.rows.map((row) => row.values),
      },
      {
        evaluationSet: {
          version: "replay-synthetic-adapter-smoke/1",
          sha256: source.sourceArtifactHash,
          split: "DEV",
        },
        dialectId: scenario,
        repeat: 1,
      },
    );
    const receipt = MappingRunReceiptSchema.parse({
      schemaVersion: "mapping-run-receipt/1",
      runId,
      startedAt,
      recordHash: sha256Canonical(record),
    });
    writeFileSync(
      new URL(`${runId}.json`, output),
      JSON.stringify(record, null, 2) + "\n",
      { flag: "wx" },
    );
    writeFileSync(
      new URL(`${runId}.receipt.json`, output),
      JSON.stringify(receipt, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(`${record.outcome}: dist/mapping-runs/${runId}.json`);
  }
}

main().catch(() => {
  // Never print configuration, Zod input or provider exception text.
  console.error(
    "Mapping command failed. Check explicit --live arguments and server-only configuration; live calls are disabled in CI.",
  );
  process.exitCode = 1;
});
