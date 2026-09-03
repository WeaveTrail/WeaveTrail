import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { canonicalizeDecimalString } from "../../contracts/src/decimal-string.ts";

const scenarioRoot = new URL("../src/", import.meta.url);
const sourcePath = new URL(
  "sources/concentrated-buy-dialect-a.csv",
  scenarioRoot,
);
const outputPath = new URL("generated/concentrated-buy.json", scenarioRoot);
const sourceArtifactHash =
  "d4bd80adf6a853adcf98f9ee08092f786b9b9276b349ad11fef6d0af078b867e";

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const bytes = readFileSync(sourcePath);
if (sha256(bytes) !== sourceArtifactHash) {
  throw new Error("dialect A bytes do not match the pinned sourceArtifactHash");
}
const lines = bytes.toString("utf8").trimEnd().split("\n");
const columns = lines[0].split(",");
const events = lines.slice(1).map((line, index) => {
  const values = Object.fromEntries(
    line.split(",").map((value, columnIndex) => [columns[columnIndex], value]),
  );
  const coordinate = {
    sourceArtifactHash,
    rowNumber: String(index + 2),
  };
  const side = { B: "BUY", S: "SELL" }[values.side_code];
  if (!side) throw new Error(`unsupported side code ${values.side_code}`);

  return {
    schemaVersion: "1.1",
    eventId: `event:synthetic-concentrated-buy-v1:SYNTH-X:${encodeURIComponent(values.source_id)}`,
    sourceEventId: values.source_id,
    datasetId: "synthetic-concentrated-buy-v1",
    venueId: "SYNTH-X",
    eventTime: values.ts,
    receivedAt: values.received,
    sequence: values.seq,
    instrumentId: values.symbol,
    eventType: "TRADE",
    side,
    actorId: values.actor,
    counterpartyId: values.counterparty,
    orderId: values.order_ref,
    price: canonicalizeDecimalString(values.px),
    quantity: canonicalizeDecimalString(values.qty),
    rawRowHash: sha256(canonicalJson({ coordinate, values })),
  };
});

writeFileSync(outputPath, `${JSON.stringify(events, null, 2)}\n`);
