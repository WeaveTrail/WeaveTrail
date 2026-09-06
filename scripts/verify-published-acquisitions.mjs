import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import {
  join,
  dirname,
  basename,
  relative,
  resolve,
  isAbsolute,
} from "node:path";
import { isDeepStrictEqual } from "node:util";
import { deriveFscStockQuotes } from "./derive-fsc-stock-quotes.mjs";
import { validateCompleteSeriesArtifact } from "./complete-series.mjs";

// Offline admission only. Adapters are passed by committed test code, never
// loaded from a path or executable content supplied in artifact metadata.
export async function verifyPublishedAcquisitions(directory, adapters = {}) {
  const registeredAdapters = new Map(
    Object.entries(adapters).map(([endpoint, adapter]) => [
      new URL(endpoint).href,
      adapter,
    ]),
  );
  const inventory = (
    await readdir(directory, { recursive: true, withFileTypes: true })
  )
    .filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)));
  const files = inventory.filter((file) => file.endsWith(".provenance.json"));
  const claimed = new Set();
  const claim = (path) => {
    const name = relative(directory, path);
    if (name.startsWith("..")) return;
    claimed.add(name);
  };
  const artifactPath = (artifactDirectory, path) => {
    const resolved = resolve(artifactDirectory, path);
    const name = relative(artifactDirectory, resolved);
    if (!name || name === ".." || name.startsWith("../") || isAbsolute(name))
      throw new Error(
        "Artifact path must stay within its provenance directory",
      );
    return resolved;
  };
  const text = (value) => typeof value === "string" && value.trim().length > 0;
  const https = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  };
  const instant = (value) =>
    typeof value === "string" && Number.isFinite(Date.parse(value));
  const validateProvenance = (provenance) => {
    if (
      provenance?.kind !== "real" ||
      !text(provenance.provider) ||
      !text(provenance.title) ||
      !https(provenance.originUrl) ||
      !instant(provenance.retrievedAt) ||
      !text(provenance.licence?.label) ||
      !https(provenance.licence?.termsUrl) ||
      !instant(provenance.licence?.checkedAt) ||
      !text(provenance.licence?.attributionRequirements) ||
      !text(provenance.licence?.attribution) ||
      !text(provenance.artifacts?.runtimeJsonl?.path) ||
      !/^[a-f0-9]{64}$/.test(provenance.artifacts?.runtimeJsonl?.sha256)
    )
      throw new Error(
        "Real artifact lacks required provenance or licence metadata",
      );
  };
  for (const file of files) {
    const artifactDirectory = dirname(join(directory, file));
    const provenance = JSON.parse(
      await readFile(join(directory, file), "utf8"),
    );
    const pairedRecordPath = join(
      directory,
      file.replace(".provenance.json", ".acquisition.json"),
    );
    let recordPath = pairedRecordPath;
    let record;
    try {
      record = JSON.parse(await readFile(recordPath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      recordPath = join(artifactDirectory, "acquisition.json");
      record = JSON.parse(await readFile(recordPath, "utf8"));
    }
    validateProvenance(provenance);
    claim(join(directory, file));
    claim(recordPath);
    const runtimePath = artifactPath(
      artifactDirectory,
      provenance.artifacts.runtimeJsonl.path,
    );
    claim(runtimePath);
    const runtimeBytes = await readFile(runtimePath);
    const runtimeHash = createHash("sha256").update(runtimeBytes).digest("hex");
    if (runtimeHash !== provenance.artifacts.runtimeJsonl.sha256)
      throw new Error("Runtime bytes disagree with recorded provenance");
    let jsonl;
    try {
      jsonl = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(runtimeBytes);
    } catch {
      throw new Error("Runtime artifact is not exact UTF-8");
    }
    if (!Buffer.from(jsonl, "utf8").equals(runtimeBytes))
      throw new Error("Runtime artifact is not exact UTF-8");
    if (record.scope === "bounded-window") {
      if (
        Object.keys(record).sort().join() !==
          "provenanceFile,scope,sourceArtifactHash" ||
        record.provenanceFile !== basename(file) ||
        record.sourceArtifactHash !== provenance.artifacts.runtimeJsonl.sha256
      )
        throw new Error("Invalid bounded-window classification");
      const rawResponsePath = artifactPath(
        artifactDirectory,
        provenance.artifacts.rawResponse.path,
      );
      const bytes = await readFile(rawResponsePath);
      claim(rawResponsePath);
      const generatedRowsPath = join(
        artifactDirectory,
        provenance.artifacts.generatedRows.path,
      );
      claim(generatedRowsPath);
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
        derived.generatedRows !== (await readFile(generatedRowsPath, "utf8"))
      )
        throw new Error(
          "Bounded-window bytes disagree with recorded provenance",
        );
    } else if (record.declaration?.scope === "complete-series") {
      const declarationPath = join(artifactDirectory, "declaration.json");
      const declaration = JSON.parse(await readFile(declarationPath, "utf8"));
      claim(declarationPath);
      if (!isDeepStrictEqual(declaration, record.declaration))
        throw new Error(
          "Pre-request declaration differs from acquisition receipt",
        );
      if (
        provenance.retrievedAt !== record.retrievedAt ||
        provenance.licence.label !== record.declaration.permission.label ||
        provenance.licence.checkedAt !==
          record.declaration.permission.checkedAt ||
        provenance.licence.termsUrl !==
          record.declaration.permission.termsUrl ||
        provenance.licence.attribution !==
          record.declaration.permission.attribution
      )
        throw new Error(
          "Complete-series receipt disagrees with provenance metadata",
        );
      const endpoint = record.pages?.[0]?.request?.endpoint;
      const adapter = registeredAdapters.get(endpoint);
      if (!adapter)
        throw new Error(
          "Complete-series artifact requires a committed offline publisher adapter",
        );
      const raw = [];
      for (const page of record.pages) {
        if (!/^page-[1-9]\d*\.response$/.test(page.file))
          throw new Error("Invalid original page path");
        raw.push(await readFile(join(artifactDirectory, page.file)));
        claim(join(artifactDirectory, page.file));
      }
      validateCompleteSeriesArtifact(record, raw, jsonl, adapter);
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
  const unclaimed = inventory.filter(
    (file) => basename(file) !== "README.md" && !claimed.has(file),
  );
  if (unclaimed.length)
    throw new Error(
      `Real artifact lacks adjacent provenance: ${unclaimed.sort()[0]}`,
    );
  return files.length;
}
