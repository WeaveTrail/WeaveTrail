import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

import { fscMarketAdapters, withFscTransport } from "./fsc-market-adapters.mjs";
import { retrieveCompleteSeries } from "./retrieve-complete-series.mjs";

export async function retrieveFscMarketSource({
  adapterName,
  declarationPath,
  output,
  publisherObservations = [],
}) {
  const adapter = fscMarketAdapters[adapterName];
  if (!adapter) throw new Error("Unknown reviewed FSC market adapter");
  const declaration = JSON.parse(await readFile(declarationPath, "utf8"));
  return retrieveCompleteSeries(
    { declaration, output, publisherObservations },
    withFscTransport(adapter),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const [adapterName, declarationPath, output, observationsPath, ...extra] =
      process.argv.slice(2);
    if (!adapterName || !declarationPath || !output || extra.length)
      throw new Error("Invalid arguments");
    const publisherObservations = observationsPath
      ? JSON.parse(await readFile(observationsPath, "utf8"))
      : [];
    await retrieveFscMarketSource({
      adapterName,
      declarationPath,
      output,
      publisherObservations,
    });
    process.stdout.write(
      "Saved complete original responses, source rows and redacted acquisition evidence.\n",
    );
  } catch {
    process.stderr.write(
      "FSC market retrieval failed. Check the reviewed adapter, declaration, credential, permission date, transport and new output path. No credential details are logged.\n",
    );
    process.exitCode = 1;
  }
}
