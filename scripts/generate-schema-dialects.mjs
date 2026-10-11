import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { format } from "prettier";
import { generateCorpus } from "../packages/evals/src/schema-dialects-generator.ts";

const directory = new URL(
  "../packages/evals/fixtures/schema-dialects-v1/",
  import.meta.url,
);
for (const split of ["DEV", "HELD_OUT"]) {
  const bytes = await format(JSON.stringify(generateCorpus(split)), {
    parser: "json",
  });
  writeFileSync(new URL(`${split}.json`, directory), bytes);
  writeFileSync(
    new URL(`${split}.sha256`, directory),
    `${createHash("sha256").update(bytes).digest("hex")}  ${split}.json\n`,
  );
}
