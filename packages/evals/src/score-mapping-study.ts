import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { canonicalJson } from "@weavetrail/replay-engine";
import { sha256 } from "./mapping-corpus-generator";
import { scoreMappingStudy } from "./mapping-study-scorer";
import { selectStudyModels } from "./mapping-study-selection";

const Path = z.string().min(1);
const BundleSchema = z
  .object({
    version: z.literal("mapping-study-bundle/1"),
    protocol: Path,
    inputs: Path,
    gold: Path,
    families: Path,
    prices: Path,
    b0: Path,
    b1: Path,
    session: Path,
    records: Path,
    routes: Path.optional(),
  })
  .strict();
export function readStudyBundle(path: string) {
  const directory = dirname(resolve(path));
  const bundle = BundleSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const bytes = (name: string) => {
    const value = readFileSync(resolve(directory, name), "utf8");
    return { bytes: value, sha256: sha256(value) };
  };
  const json = (name: string): unknown => JSON.parse(bytes(name).bytes);
  return {
    protocol: json(bundle.protocol),
    source: {
      inputs: bytes(bundle.inputs),
      gold: bytes(bundle.gold),
      families: bytes(bundle.families),
    },
    prices: bytes(bundle.prices),
    references: { b0: json(bundle.b0), b1: json(bundle.b1) },
    session: json(bundle.session),
    records: json(bundle.records),
    ...(bundle.routes ? { routes: json(bundle.routes) } : {}),
  };
}
export function runStudyScoreCommand(args: string[]) {
  let bundle: string | undefined,
    output: string | undefined,
    check: string | undefined,
    select = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--select") select = true;
    else if (["--bundle", "--out", "--check"].includes(arg!)) {
      const value = args[++i];
      if (!value || value.startsWith("--"))
        throw new Error("Missing command argument");
      if (arg === "--bundle" && !bundle) bundle = value;
      else if (arg === "--out" && !output) output = value;
      else if (arg === "--check" && !check) check = value;
      else throw new Error("Duplicate command argument");
    } else
      throw new Error("Unknown command argument; this command is offline only");
  }
  if (!bundle || (output && check))
    throw new Error(
      "Use --bundle <path> [--select] [--out <directory> | --check <file>]",
    );
  const input = readStudyBundle(bundle),
    result = select ? selectStudyModels(input) : scoreMappingStudy(input);
  const serialized = `${canonicalJson(result)}\n`;
  if (check) {
    if (readFileSync(check, "utf8") !== serialized)
      throw new Error(
        "Study summary byte mismatch; expectations were not updated",
      );
  } else if (output) {
    mkdirSync(output, { recursive: true });
    writeFileSync(
      resolve(output, select ? "selection.json" : "summary.json"),
      serialized,
    );
  } else process.stdout.write(serialized);
  return result;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    runStudyScoreCommand(process.argv.slice(2));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Study scoring failed",
    );
    process.exitCode = 1;
  }
}
