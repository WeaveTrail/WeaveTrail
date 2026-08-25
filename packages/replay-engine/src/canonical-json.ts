import { createHash } from "node:crypto";

import { compareUtf16CodeUnits } from "./canonical-order";

type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function sortValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }

  return value;
}

export function canonicalJson(value: JsonValue): string {
  return JSON.stringify(sortValue(value));
}

export function sha256Canonical(value: JsonValue): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
