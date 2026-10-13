import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { format } from "prettier";
import {
  renderMappingStudy,
  verifyMappingStudy,
} from "../packages/evals/src/mapping-corpus-artifacts";
import {
  GENERATOR_VERSION,
  GenerationReceiptSchema,
} from "../packages/evals/src/mapping-corpus-contract";
import { sha256 } from "../packages/evals/src/mapping-corpus-generator";

const args = process.argv.slice(2);
const check = args[0] === "--check";
if (!(
  args.length === 0 ||
  (args.length === 1 && check) ||
  (args.length === 2 && args[0] === "--output")
))
  throw new Error(
    "Usage: pnpm eval:corpus:generate [--output DIRECTORY] | pnpm eval:corpus:check",
  );
const files = check ? await verifyMappingStudy() : await renderMappingStudy();
const output = resolve(
  args[0] === "--output" ? args[1]! : "dist/mapping-study-unsealed",
);
mkdirSync(output, { recursive: true });
for (const [name, bytes] of Object.entries(files))
  writeFileSync(resolve(output, name), bytes);
// Actual execution metadata stays separate from deterministic input bytes.
const receipt = GenerationReceiptSchema.parse({
  generatorVersion: GENERATOR_VERSION,
  status: "UNSEALED",
  executedAt: new Date().toISOString(),
  checkout: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  dirtyTrackedFiles: execFileSync("git", ["diff", "--name-only", "HEAD"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean),
  node: process.version,
  pnpm: execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(),
  platform: process.platform,
  arch: process.arch,
  command: check
    ? "pnpm eval:corpus:check"
    : `pnpm eval:corpus:generate${args.length ? ` --output ${args[1]}` : ""}`,
  manifestSha256: sha256(files["manifest.json"]!),
  note: "Source file hashes in manifest identify the generator working tree; checkout alone is not a claim that uncommitted authoring already exists in that commit.",
});
const receiptBytes = await format(JSON.stringify(receipt), { parser: "json" });
writeFileSync(resolve(output, "generation-receipt.json"), receiptBytes);
writeFileSync(
  resolve(output, "generation-receipt.sha256"),
  `${sha256(receiptBytes)}  generation-receipt.json\n`,
);
process.stdout.write(
  `${check ? "PASS: committed bytes verified; two generations match" : "Generated draft inputs"}; UNSEALED; independent review PENDING; ${output}\n`,
);
