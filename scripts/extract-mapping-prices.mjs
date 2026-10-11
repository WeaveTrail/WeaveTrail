import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const directory = new URL(
  "../packages/evals/fixtures/mapping-selection-v1/",
  import.meta.url,
);
const source = readFileSync(
  new URL("google-pricing-2026-10-08.html.txt", directory),
  "utf8",
);
const models = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-2.5-pro",
  "gemini-3.1-pro-preview",
];
const entries = models.map((model) => {
  const section = source.split(`id="${model}"`)[1]?.split("</table>")[0];
  if (!section) throw new Error(`Missing model section: ${model}`);
  const rows = [...section.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(1);
  const rates = rows.slice(0, 2).map((row) => {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    const match = cells[2]?.[1].match(/\$(\d+)\.(\d{2})/);
    if (!match) throw new Error("Missing standard paid rate");
    return String(BigInt(match[1]) * 1000000n + BigInt(match[2]) * 10000n);
  });
  return {
    provider: "google",
    requestedModel: model,
    reportedModel: model,
    inputMicroUsdPerMillionTokens: rates[0],
    outputMicroUsdPerMillionTokens: rates[1],
  };
});
const table = {
  version: "google-gemini-standard-2026-10-08/1",
  dated: "2026-10-08",
  provenance: `Google, Gemini Developer API pricing, https://ai.google.dev/gemini-api/docs/pricing?hl=ja; retrieved 2026-10-08; original-byte SHA-256 ${createHash("sha256").update(source).digest("hex")}. CC BY 4.0. Standard paid text, uncached, prompts <= 200000 tokens; output includes thinking. Gemini 3.8 introductory rates through 2026-12-31. Deterministic extraction: scripts/extract-mapping-prices.mjs.`,
  entries,
};
const bytes = JSON.stringify(table, null, 2) + "\n";
if (process.argv.includes("--write"))
  writeFileSync(new URL("prices.json", directory), bytes);
else if (readFileSync(new URL("prices.json", directory), "utf8") !== bytes)
  throw new Error("Price capture differs");
