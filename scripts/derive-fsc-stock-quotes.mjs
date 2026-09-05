import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function validTradingDate(value) {
  if (typeof value !== "string" || !/^\d{8}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
  );
}

// Offline envelope packaging only. Runtime ingestion remains the hash-checked
// JSON Lines parser in replay-engine; no financial value is coerced or computed.
export function deriveFscStockQuotes(bytes, { basDt, market }) {
  if (
    !validTradingDate(basDt) ||
    !["KOSPI", "KOSDAQ", "KONEX"].includes(market)
  ) {
    throw new Error(
      "An explicit valid trading date and documented market are required",
    );
  }
  let envelope;
  try {
    envelope = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    throw new Error("Response must be a UTF-8 JSON envelope");
  }
  const response = envelope?.response;
  if (!object(response) || response.header?.resultCode !== "00") {
    throw new Error("Provider response is not successful");
  }
  const body = response.body;
  const items = body?.items?.item;
  if (!Array.isArray(items) || items.length < 2 || items.length > 40) {
    throw new Error("Expected 2–40 complete response items");
  }
  const pageNumber = (value) =>
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) ||
    (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value));
  if (
    !pageNumber(body.pageNo) ||
    BigInt(body.pageNo) !== 1n ||
    !pageNumber(body.numOfRows) ||
    BigInt(body.numOfRows) !== 40n ||
    !pageNumber(body.totalCount) ||
    BigInt(body.totalCount) < BigInt(items.length) ||
    BigInt(items.length) !==
      (BigInt(body.totalCount) < 40n ? BigInt(body.totalCount) : 40n)
  ) {
    throw new Error(
      "Response pagination must match the complete first page of 40",
    );
  }
  const sourceIds = new Set();
  const instrumentIds = new Set();
  for (const item of items) {
    if (
      !object(item) ||
      Object.values(item).some((value) => typeof value !== "string")
    ) {
      throw new Error(
        "Every complete item must contain only string values; coercion is forbidden",
      );
    }
    if (
      item.basDt !== basDt ||
      item.mrktCtg !== market ||
      !item.srtnCd?.trim() ||
      !item.isinCd?.trim() ||
      !Object.hasOwn(item, "clpr") ||
      !Object.hasOwn(item, "trqu") ||
      sourceIds.has(item.srtnCd) ||
      instrumentIds.has(item.isinCd)
    ) {
      throw new Error(
        "Response violates the fixed date, market, columns or unique issue identities",
      );
    }
    sourceIds.add(item.srtnCd);
    instrumentIds.add(item.isinCd);
  }
  const jsonl = items.map((item) => JSON.stringify(item)).join("\n") + "\n";
  const sourceArtifactHash = digest(jsonl);
  const rows = items.map((values, index) => ({
    coordinate: { sourceArtifactHash, rowNumber: String(index + 1) },
    values,
  }));
  const generatedRows = JSON.stringify(rows, null, 2) + "\n";
  return {
    jsonl,
    generatedRows,
    rows,
    rawResponseHash: digest(bytes),
    sourceArtifactHash,
    generatedRowsHash: digest(generatedRows),
    columns: [...new Set(items.flatMap((item) => Object.keys(item)))],
    pagination: {
      pageNo: body.pageNo,
      numOfRows: body.numOfRows,
      totalCount: body.totalCount,
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const [input, basDt, market, jsonlPath, rowsPath, ...extra] =
      process.argv.slice(2);
    if (!input || !jsonlPath || !rowsPath || extra.length) {
      throw new Error(
        "Usage: node scripts/derive-fsc-stock-quotes.mjs RESPONSE YYYYMMDD MARKET JSONL_OUTPUT ROWS_OUTPUT",
      );
    }
    const result = deriveFscStockQuotes(await readFile(input), {
      basDt,
      market,
    });
    await writeFile(jsonlPath, result.jsonl, { flag: "wx" });
    await writeFile(rowsPath, result.generatedRows, { flag: "wx" });
    process.stdout.write(
      JSON.stringify({
        rawResponseHash: result.rawResponseHash,
        sourceArtifactHash: result.sourceArtifactHash,
        generatedRowsHash: result.generatedRowsHash,
      }) + "\n",
    );
  } catch {
    process.stderr.write(
      "Offline derivation failed. Check the documented arguments, response envelope and new output paths.\n",
    );
    process.exitCode = 1;
  }
}
