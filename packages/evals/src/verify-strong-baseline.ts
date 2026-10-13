import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { captureStrongBaselineDev } from "./strong-baseline-dev";

const capture = captureStrongBaselineDev();
const output = new URL("../../../dist/strong-baseline-dev/", import.meta.url);
const files = [
  {
    name: "records.json",
    value: capture.records,
    expected: "../fixtures/strong-baseline-v1/records.json",
  },
  {
    name: "summary.json",
    value: capture.summary,
    expected: "../results/strong-baseline-dev-v1.json",
  },
];
// Verify everything before writing output. This command never updates expectations.
for (const file of files)
  if (
    readFileSync(new URL(file.expected, import.meta.url), "utf8") !==
    JSON.stringify(file.value) + "\n"
  )
    throw new Error(
      `Strong baseline ${file.name} differs from committed bytes`,
    );
mkdirSync(output, { recursive: true });
for (const file of files)
  writeFileSync(new URL(file.name, output), JSON.stringify(file.value) + "\n");
console.log(
  "PASS: frozen B1 configuration, B0/B1 DEV records and common-scorer summary match committed bytes",
);
