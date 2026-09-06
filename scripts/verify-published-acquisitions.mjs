import { readFile, readdir } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { deriveFscStockQuotes } from "./derive-fsc-stock-quotes.mjs";
import { validateCompleteSeriesArtifact } from "./complete-series.mjs";

// Offline admission only. Adapters are passed by committed test code, never
// loaded from a path or executable content supplied in artifact metadata.
export async function verifyPublishedAcquisitions(directory, adapters = {}) {
  const files = (await readdir(directory, { recursive: true })).filter((file) =>
    file.endsWith(".provenance.json"),
  );
  for (const file of files) {
    const artifactDirectory = dirname(join(directory, file));
    const provenance = JSON.parse(
      await readFile(join(directory, file), "utf8"),
    );
    const record = JSON.parse(
      await readFile(
        join(directory, file.replace(".provenance.json", ".acquisition.json")),
        "utf8",
      ),
    );
    const jsonl = await readFile(
      join(artifactDirectory, provenance.artifacts.runtimeJsonl.path),
      "utf8",
    );
    if (record.scope === "bounded-window") {
      if (
        Object.keys(record).sort().join() !==
          "provenanceFile,scope,sourceArtifactHash" ||
        record.provenanceFile !== basename(file) ||
        record.sourceArtifactHash !== provenance.artifacts.runtimeJsonl.sha256
      )
        throw new Error("Invalid bounded-window classification");
      const bytes = await readFile(
        join(artifactDirectory, provenance.artifacts.rawResponse.path),
      );
      const derived = deriveFscStockQuotes(bytes, {
        basDt: provenance.basDt,
        market: provenance.request.mrktCls,
      });
      if (
        derived.jsonl !== jsonl ||
        derived.rawResponseHash !== provenance.artifacts.rawResponse.sha256 ||
        derived.sourceArtifactHash !== record.sourceArtifactHash ||
        derived.generatedRowsHash !==
          provenance.artifacts.generatedRows.sha256 ||
        derived.generatedRows !==
          (await readFile(
            join(artifactDirectory, provenance.artifacts.generatedRows.path),
            "utf8",
          ))
      )
        throw new Error(
          "Bounded-window bytes disagree with recorded provenance",
        );
    } else if (record.declaration?.scope === "complete-series") {
      const endpoint = record.pages?.[0]?.request?.endpoint;
      if (!Object.hasOwn(adapters, endpoint))
        throw new Error(
          "Complete-series artifact requires a committed offline publisher adapter",
        );
      const raw = [];
      for (const page of record.pages) {
        if (!/^page-[1-9]\d*\.response$/.test(page.file))
          throw new Error("Invalid original page path");
        raw.push(await readFile(join(artifactDirectory, page.file)));
      }
      validateCompleteSeriesArtifact(record, raw, jsonl, adapters[endpoint]);
      if (
        record.sourceArtifactHash !== provenance.artifacts.runtimeJsonl.sha256
      )
        throw new Error(
          "Complete-series source differs from recorded provenance",
        );
    } else {
      throw new Error(
        "Every real artifact must declare a recognized acquisition scope",
      );
    }
  }
  return files.length;
}
