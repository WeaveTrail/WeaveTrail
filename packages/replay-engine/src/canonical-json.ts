import { createHash } from "node:crypto";

import { compareUtf16CodeUnits } from "./canonical-order";
import { CanonicalizationError } from "./canonical-order";

type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type CanonicalJsonInput =
  | JsonPrimitive
  | undefined
  | CanonicalJsonInput[]
  | { [key: string]: CanonicalJsonInput };

function rejectUndefined(): never {
  throw new CanonicalizationError(
    "UNDEFINED_VALUE",
    "canonical JSON does not support undefined values outside object properties",
  );
}

function serializeValue(value: CanonicalJsonInput): string {
  if (Array.isArray(value)) {
    return `[${Array.from(value, (child) =>
      child === undefined ? rejectUndefined() : serializeValue(child),
    ).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${serializeValue(child)}`)
      .join(",")}}`;
  }

  if (value === undefined) return rejectUndefined();

  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new CanonicalizationError(
      "NON_FINITE_NUMBER",
      "canonical JSON does not support non-finite numbers",
    );
  }

  return JSON.stringify(value);
}

export function canonicalJson(value: CanonicalJsonInput): string {
  return serializeValue(value);
}

export function sha256Canonical(value: CanonicalJsonInput): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
