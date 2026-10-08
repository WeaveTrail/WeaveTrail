import { createHash } from "node:crypto";
import {
  AllowedTransformSchema,
  MappedTargetFieldSchema,
} from "@weavetrail/contracts";
import type { Corpus } from "./schema-dialects-generator";

export const LEXICAL_BASELINE_VERSION = "lexical-baseline/1";
export const LEXICAL_NORMALIZATION_VERSION = "ascii-separators/1";

// Whole headers only. No substring, instruction decoding, positional or value
// inference. This rule is fixed before evaluating any held-out inputs.
export function lexicalKey(name: string): string | null {
  return /^[A-Za-z][A-Za-z0-9_./ -]*$/.test(name)
    ? name.toLowerCase().replace(/[_. /-]/g, "")
    : null;
}

/** Offline authoring from sealed DEV labels; never called by the mapper. */
export function buildLexicalVocabulary(bytes: string, sha256: string) {
  if (createHash("sha256").update(bytes).digest("hex") !== sha256)
    throw new Error("DEV seal mismatch");
  const corpus = JSON.parse(bytes) as Corpus;
  if (corpus.version !== "schema-dialects/1" || corpus.split !== "DEV")
    throw new Error("Vocabulary requires DEV only");
  const decisions = new Map<string, Set<string>>();
  for (const dialect of corpus.dialects) {
    for (const column of dialect.input.columns) {
      const key = lexicalKey(column.name);
      if (key === null) continue;
      const labels = dialect.gold.filter((g) => g.sourceColumn === column.name);
      if (labels.length !== 1)
        throw new Error("Missing or duplicate DEV label");
      const gold = labels[0]!;
      const decision =
        gold.status === "PROPOSED"
          ? JSON.stringify([
              MappedTargetFieldSchema.parse(gold.targetField),
              AllowedTransformSchema.parse(gold.transform),
            ])
          : "null";
      const values = decisions.get(key) ?? new Set<string>();
      values.add(decision);
      decisions.set(key, values);
    }
  }
  return {
    version: LEXICAL_BASELINE_VERSION,
    normalizationVersion: LEXICAL_NORMALIZATION_VERSION,
    devSha256: sha256,
    entries: [...decisions]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .flatMap(([key, values]) => {
        if (values.size !== 1 || values.has("null")) return [];
        const [targetField, transform] = JSON.parse([...values][0]!) as [
          string,
          string,
        ];
        return [{ key, targetField, transform }];
      }),
  };
}
