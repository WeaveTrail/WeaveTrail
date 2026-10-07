import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { scoreMappingRuns } from "./mapping-scorer";

const { values } = parseArgs({
  options: {
    records: { type: "string" },
    prices: { type: "string" },
    expected: { type: "string" },
  },
});
const read = (path: string | URL) => readFileSync(path, "utf8");
const fixture = new URL("../fixtures/mapping-score-v1/", import.meta.url);
const corpus = new URL("../fixtures/schema-dialects-v1/", import.meta.url);
const sources = ["DEV", "HELD_OUT"].map((split) => ({
  bytes: read(new URL(`${split}.json`, corpus)),
  sha256: read(new URL(`${split}.sha256`, corpus))
    .trim()
    .split(/\s+/)[0]!,
}));
const result = scoreMappingRuns(
  JSON.parse(read(values.records ?? new URL("records.json", fixture))),
  sources,
  JSON.parse(read(values.prices ?? new URL("prices.json", fixture))),
);
// Deterministic compact JSON plus one newline is the versioned byte format.
const bytes = JSON.stringify(result) + "\n";
const expected =
  values.expected ??
  (!values.records && !values.prices
    ? new URL("../results/mapping-score-v1.json", import.meta.url)
    : undefined);
if (expected !== undefined && read(expected) !== bytes)
  throw new Error("Mapping score differs from committed summary");
const output = new URL("../../../dist/mapping-scores/", import.meta.url);
mkdirSync(output, { recursive: true });
writeFileSync(new URL("summary.json", output), bytes);
console.log(
  expected === undefined
    ? "Scored mapping records: dist/mapping-scores/summary.json"
    : "PASS: offline mapping summary matches committed bytes",
);
