import { createHash } from "node:crypto";

import { compareUtf16CodeUnits } from "./canonical-order";
import { CanonicalizationError } from "./canonical-order";

type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function serializeValue(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map(serializeValue).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${serializeValue(child)}`)
      .join(",")}}`;
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new CanonicalizationError(
      "NON_FINITE_NUMBER",
      "canonical JSON does not support non-finite numbers",
    );
  }

  return JSON.stringify(value);
}

export function canonicalJson(value: JsonValue): string {
  return serializeValue(value);
}

export function sha256Canonical(value: JsonValue): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
