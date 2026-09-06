import { createHash } from "node:crypto";
import { open, readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function derivePublishedRows(bytes) {
  let text;
  try {
    text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
  } catch {
    throw new Error("Source artifact must be exact UTF-8");
  }
  if (!Buffer.from(text, "utf8").equals(bytes) || text.includes("\r"))
    throw new Error("Source artifact must be exact UTF-8 with LF endings");
  const lines = text.split("\n");
  if (lines.at(-1) !== "")
    throw new Error("Source artifact must end with one LF");
  lines.pop();
  if (lines.some((line) => !line))
    throw new Error("Source artifact contains an empty row");
  const sourceArtifactHash = digest(bytes);
  const rows = lines.map((line, index) => {
    let values;
    try {
      values = JSON.parse(line);
    } catch {
      throw new Error("Source artifact row is not JSON");
    }
    if (
      values === null ||
      typeof values !== "object" ||
      Array.isArray(values) ||
      !Object.keys(values).length ||
      Object.values(values).some((value) => typeof value !== "string")
    )
      throw new Error("Source artifact row is not a string-valued object");
    return {
      coordinate: {
        sourceArtifactHash,
        rowNumber: String(index + 1),
      },
      values,
    };
  });
  const generatedRows = JSON.stringify(rows, null, 2) + "\n";
  return {
    sourceArtifactHash,
    rows,
    generatedRows,
    generatedRowsHash: digest(generatedRows),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  let output;
  let handle;
  let created = false;
  try {
    const [input, outputPath, ...extra] = process.argv.slice(2);
    if (!input || !outputPath || extra.length)
      throw new Error("Invalid arguments");
    output = outputPath;
    const result = derivePublishedRows(await readFile(input));
    handle = await open(output, "wx");
    created = true;
    await handle.writeFile(result.generatedRows);
    await handle.close();
    handle = undefined;
    process.stdout.write(
      JSON.stringify({
        sourceArtifactHash: result.sourceArtifactHash,
        generatedRowsHash: result.generatedRowsHash,
        rowCount: result.rows.length,
      }) + "\n",
    );
  } catch {
    try {
      await handle?.close();
      if (output && created) await unlink(output);
    } catch {
      process.stderr.write(
        "Offline row derivation cleanup requires inspection.\n",
      );
      process.exitCode = 1;
      process.exit();
    }
    process.stderr.write(
      "Offline row derivation failed. Check the source bytes and new output path.\n",
    );
    process.exitCode = 1;
  }
}
