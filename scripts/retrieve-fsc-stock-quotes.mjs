import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

import {
  deriveFscStockQuotes,
  validTradingDate,
} from "./derive-fsc-stock-quotes.mjs";

export const FSC_STOCK_QUOTE_ENDPOINT =
  "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo";

// Manual only: imports never read credentials or make a network request.
export async function retrieveFscStockQuotes(
  { basDt, market, output, permissionCheckedAt },
  fetchResponse = globalThis.fetch,
) {
  if (
    !validTradingDate(basDt) ||
    !["KOSPI", "KOSDAQ", "KONEX"].includes(market) ||
    !output
  ) {
    throw new Error(
      "An explicit valid trading date, market and new output path are required",
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  if (permissionCheckedAt !== today || basDt >= today.replaceAll("-", "")) {
    throw new Error(
      "Recheck unrestricted permission and linked terms today; use a completed trading date",
    );
  }
  const suppliedKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!suppliedKey) throw new Error("DATA_GO_KR_SERVICE_KEY is not configured");
  let key;
  try {
    key = decodeURIComponent(suppliedKey);
  } catch {
    throw new Error("Service key encoding is invalid");
  }
  const parameters = {
    basDt,
    resultType: "json",
    pageNo: "1",
    numOfRows: "40",
    mrktCls: market,
  };
  const url = new URL(FSC_STOCK_QUOTE_ENDPOINT);
  url.search = new URLSearchParams({
    ...parameters,
    serviceKey: key,
  }).toString();
  let response;
  let bytes;
  try {
    response = await fetchResponse(url, {
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("HTTP failure");
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    // Never expose fetch errors: they can include a credential-bearing URL.
    throw new Error("Retrieval failed at the HTTP or transport boundary");
  }
  const text = new TextDecoder().decode(bytes);
  const contentType = response.headers.get("content-type");
  const disclosed = `${text}\n${contentType ?? ""}`;
  const forms = [
    suppliedKey,
    key,
    encodeURIComponent(key),
    new URLSearchParams({ serviceKey: key })
      .toString()
      .slice("serviceKey=".length),
  ];
  if (
    forms.some(
      (secret) =>
        secret && disclosed.toLowerCase().includes(secret.toLowerCase()),
    )
  ) {
    throw new Error(
      "Response echoes credentials; no response bytes were saved",
    );
  }
  const artifact = deriveFscStockQuotes(bytes, { basDt, market });
  const receipt = {
    endpoint: FSC_STOCK_QUOTE_ENDPOINT,
    parameters: { ...parameters, serviceKey: "REDACTED" },
    retrievedAt: new Date().toISOString(),
    permissionCheckedAt,
    contentType,
    rowCount: artifact.rows.length,
    pagination: artifact.pagination,
    rawResponseHash: artifact.rawResponseHash,
    sourceArtifactHash: artifact.sourceArtifactHash,
    generatedRowsHash: artifact.generatedRowsHash,
    columns: artifact.columns,
  };
  await writeFile(output, bytes, { flag: "wx" });
  await writeFile(
    `${output}.receipt.json`,
    JSON.stringify(receipt, null, 2) + "\n",
    { flag: "wx" },
  );
  return receipt;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const [basDt, market, output, permissionCheckedAt, ...extra] =
      process.argv.slice(2);
    if (extra.length) throw new Error("Unexpected arguments");
    await retrieveFscStockQuotes({
      basDt,
      market,
      output,
      permissionCheckedAt,
    });
    process.stdout.write(
      "Saved the original response and redacted receipt to new files.\n",
    );
  } catch {
    process.stderr.write(
      "Retrieval failed. Check credentials, today's licence verification, completed date, market, response constraints and new output paths. No credential details are logged.\n",
    );
    process.exitCode = 1;
  }
}
