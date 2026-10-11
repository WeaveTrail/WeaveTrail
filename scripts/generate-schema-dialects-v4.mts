import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { generateCorpusV4 } from "../packages/evals/src/schema-dialects-v4";
import { buildLexicalVocabulary } from "../packages/evals/src/lexical-baseline-vocabulary";
const directory = new URL(
  "../packages/evals/fixtures/schema-dialects-v4/",
  import.meta.url,
);
mkdirSync(directory, { recursive: true });
for (const split of ["DEV", "HELD_OUT"] as const) {
  const bytes = await format(JSON.stringify(generateCorpusV4(split)), {
    parser: "json",
  });
  const hash = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(new URL(`${split}.json`, directory), bytes);
  writeFileSync(
    new URL(`${split}.sha256`, directory),
    `${hash}  ${split}.json\n`,
  );
  // The reference vocabulary follows DEV only; HELD_OUT labels never enter it.
  if (split === "DEV") {
    const target = new URL(
      "../packages/evals/fixtures/lexical-baseline-v3/",
      import.meta.url,
    );
    mkdirSync(target, { recursive: true });
    writeFileSync(
      new URL("vocabulary.json", target),
      await format(
        JSON.stringify(
          buildLexicalVocabulary(bytes, hash, "lexical-baseline/3"),
        ),
        { parser: "json" },
      ),
    );
  }
}
