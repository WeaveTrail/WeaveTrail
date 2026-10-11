import { MappingRunRecordSchema } from "@weavetrail/contracts";
import type { Corpus } from "./schema-dialects-generator";

/** Authored scorer controls, not provider observations or model measurements. */
export function authorLexicalComparisonControls(
  sources: { bytes: string; sha256: string }[],
) {
  return sources.flatMap(({ bytes, sha256 }) => {
    const corpus = JSON.parse(bytes) as Corpus;
    return corpus.dialects.flatMap((dialect) =>
      ["synthetic-oracle", "synthetic-always-abstain"].flatMap((model) =>
        [1, 2].map((repeat) =>
          MappingRunRecordSchema.parse({
            schemaVersion: "mapping-run/1",
            evaluationSet: {
              version: corpus.version,
              split: corpus.split,
              sha256,
            },
            dialectId: dialect.id,
            repeat,
            provider: "synthetic-authored-controls",
            requestedModel: model,
            reportedModel: null,
            adapterVersion: "synthetic-authored/1",
            promptVersion: "synthetic-no-prompt/1",
            outputSchemaVersion: "mapping-fields/1",
            validatorVersion: "synthetic-authored-outcome/1",
            temperature: "0",
            latencyMs: 0,
            inputTokens: null,
            outputTokens: null,
            outcome: "VALID",
            failureClass: null,
            validatorReasons: [],
            parsedOutput: {
              fields: dialect.gold.map((gold) => ({
                sourceColumn: gold.sourceColumn,
                targetField:
                  model === "synthetic-oracle" ? gold.targetField : null,
                transform: model === "synthetic-oracle" ? gold.transform : null,
                status:
                  model === "synthetic-oracle"
                    ? gold.status
                    : "REVIEW_REQUIRED",
                confidence:
                  model === "synthetic-oracle" && gold.status === "PROPOSED"
                    ? 1
                    : 0,
                evidence:
                  "Authored synthetic scorer control; not a validator or provider observation.",
              })),
            },
          }),
        ),
      ),
    );
  });
}
