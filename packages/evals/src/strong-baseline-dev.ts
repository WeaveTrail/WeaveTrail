import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { sha256Canonical } from "@weavetrail/replay-engine";
import { CorpusSchema, scoreMappingRuns } from "./mapping-scorer";
import { dialectMappingInput } from "./schema-dialects-v2";
import {
  runLexicalMapping,
  VocabularySchema,
} from "./lexical-mapping-baseline";
import {
  buildStrongBaselineConfig,
  runStrongMapping,
  strongBaselineDefinition,
  StrongBaselineConfigSchema,
} from "./strong-mapping-baseline";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const hash = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Development replay only; reads no HELD_OUT, SELECT, AUDIT or DRIFT artifact. */
export function captureStrongBaselineDev() {
  const bytes = read("../fixtures/schema-dialects-v4/DEV.json");
  const sha256 = read("../fixtures/schema-dialects-v4/DEV.sha256")
    .trim()
    .split(/\s+/)[0]!;
  const configuration = StrongBaselineConfigSchema.parse(
    JSON.parse(read("../fixtures/strong-baseline-v1/configuration.json")),
  );
  if (
    sha256Canonical(buildStrongBaselineConfig(bytes, sha256)) !==
    sha256Canonical(configuration)
  )
    throw new Error("Frozen B1 configuration differs from DEV reconstruction");
  const corpus = CorpusSchema.parse(JSON.parse(bytes));
  const b0 = VocabularySchema.parse(
    JSON.parse(read("../fixtures/lexical-baseline-v3/vocabulary.json")),
  );
  if (b0.devSha256 !== sha256)
    throw new Error("B0 and B1 require the same DEV source");
  const records = corpus.dialects.flatMap((dialect) => {
    const input = dialectMappingInput(dialect);
    const context = {
      evaluationSet: { version: corpus.version, split: corpus.split, sha256 },
      dialectId: dialect.id,
      repeat: 1,
    };
    return [
      runLexicalMapping(input, context, b0),
      runStrongMapping(input, context, configuration),
    ];
  });
  const codePaths = [
    "strong-mapping-baseline.ts",
    "strong-baseline-dev.ts",
    "lexical-mapping-baseline.ts",
    "lexical-baseline-vocabulary.ts",
    "mapping-scorer.ts",
    "schema-dialects-v2.ts",
    "../../ai-harness/src/mapping-output-validator.ts",
  ];
  const summary = {
    version: "strong-baseline-dev/1",
    scope: "DEVELOPMENT_ONLY",
    references: [
      {
        version: b0.version,
        normalizationVersion: b0.normalizationVersion,
        devSha256: b0.devSha256,
        configurationHash: sha256Canonical(b0),
        selectable: false,
      },
      strongBaselineDefinition(configuration),
    ],
    codeSha256: Object.fromEntries(
      codePaths.map((path) => [path, hash(read(path))]),
    ),
    resourceSemantics: "NON_MODEL_SENTINEL",
    score: scoreMappingRuns(records, [{ bytes, sha256 }], {
      version: "non-model-no-tariffs/1",
      dated: "2026-10-13",
      provenance:
        "No model calls or measured latency; zero latency is a sentinel, tokens and costs are unavailable.",
      entries: [],
    }),
  };
  return { records, summary };
}
