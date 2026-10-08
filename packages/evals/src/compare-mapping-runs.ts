import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  baselineRecordsForComparison,
  createMappingSelectionRecord,
  scoreMappingComparison,
} from "./mapping-comparison";

const { values } = parseArgs({
  options: {
    records: { type: "string" },
    prices: { type: "string" },
    selected: { type: "string" },
    expected: { type: "string" },
  },
});
const read = (path: string | URL) => readFileSync(path, "utf8");
const fixture = new URL("../fixtures/lexical-baseline-v1/", import.meta.url);
const corpus = new URL("../fixtures/schema-dialects-v1/", import.meta.url);
const sources = ["DEV", "HELD_OUT"].map((split) => ({
  bytes: read(new URL(`${split}.json`, corpus)),
  sha256: read(new URL(`${split}.sha256`, corpus))
    .trim()
    .split(/\s+/)[0]!,
}));
const defaultCapture = !values.records && !values.prices && !values.selected;
const records = JSON.parse(
  read(values.records ?? new URL("records.json", fixture)),
);
const prices = JSON.parse(
  read(values.prices ?? new URL("../mapping-score-v1/prices.json", fixture)),
);
const baselineBytes =
  JSON.stringify(baselineRecordsForComparison(records, sources, prices)) + "\n";
if (
  defaultCapture &&
  baselineBytes !== read(new URL("baseline-records.json", fixture))
)
  throw new Error("Baseline records differ from committed bytes");
const comparison = scoreMappingComparison(records, sources, prices);
const selected = values.selected
  ? JSON.parse(read(values.selected))
  : defaultCapture
    ? JSON.parse(read(new URL("selected.json", fixture)))
    : [];
const result = {
  comparison,
  selection: createMappingSelectionRecord(comparison, selected),
};
const bytes = JSON.stringify(result) + "\n";
const expected =
  values.expected ??
  (defaultCapture
    ? new URL("../results/mapping-comparison-v1.json", import.meta.url)
    : undefined);
if (expected !== undefined && read(expected) !== bytes)
  throw new Error("Mapping comparison differs from committed bytes");
const output = new URL("../../../dist/mapping-comparisons/", import.meta.url);
mkdirSync(output, { recursive: true });
writeFileSync(new URL("baseline-records.json", output), baselineBytes);
writeFileSync(new URL("summary.json", output), bytes);
console.log(
  expected === undefined
    ? "Scored mapping comparison: dist/mapping-comparisons/summary.json"
    : "PASS: baseline records and comparison match committed bytes",
);
