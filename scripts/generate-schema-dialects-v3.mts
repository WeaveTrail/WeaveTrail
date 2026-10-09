import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { generateCorpusV3 } from "../packages/evals/src/schema-dialects-v3";
const directory = new URL(
  "../packages/evals/fixtures/schema-dialects-v3/",
  import.meta.url,
);
mkdirSync(directory, { recursive: true });
const bytes = await format(JSON.stringify(generateCorpusV3()), {
  parser: "json",
});
writeFileSync(new URL("HELD_OUT.json", directory), bytes);
writeFileSync(
  new URL("HELD_OUT.sha256", directory),
  `${createHash("sha256").update(bytes).digest("hex")}  HELD_OUT.json\n`,
);
