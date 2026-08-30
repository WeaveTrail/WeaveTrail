import { createHash } from "node:crypto";

import { canonicalJson } from "./canonical-json";

export type SourceIngestErrorCode =
  | "DUPLICATE_SOURCE_COORDINATE"
  | "INVALID_SOURCE_ARTIFACT"
  | "SOURCE_ARTIFACT_HASH_MISMATCH";

export class SourceIngestError extends Error {
  readonly code: SourceIngestErrorCode;

  constructor(code: SourceIngestErrorCode, message: string) {
    super(message);
    this.name = "SourceIngestError";
    this.code = code;
  }
}

export type SourceCoordinate = {
  sourceArtifactHash: string;
  rowNumber: string;
};

export type SourceRow = {
  coordinate: SourceCoordinate;
  values: Record<string, string>;
};

export function sourceArtifactHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireArtifactHash(
  bytes: Uint8Array,
  declaredSourceArtifactHash: string,
): void {
  const actualHash = sourceArtifactHash(bytes);
  if (actualHash !== declaredSourceArtifactHash) {
    throw new SourceIngestError(
      "SOURCE_ARTIFACT_HASH_MISMATCH",
      `Declared sourceArtifactHash ${declaredSourceArtifactHash} does not match artifact bytes ${actualHash}`,
    );
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SourceIngestError(
      "INVALID_SOURCE_ARTIFACT",
      "Source artifact must contain valid UTF-8 text",
    );
  }
}

function artifactLines(bytes: Uint8Array): string[] {
  const text = decodeUtf8(bytes);
  if (text.includes("\r")) {
    throw new SourceIngestError(
      "INVALID_SOURCE_ARTIFACT",
      "Source artifact must use LF line endings",
    );
  }
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

export function canonicalRawRow(row: SourceRow): string {
  return canonicalJson({
    coordinate: row.coordinate,
    values: row.values,
  });
}

export function deriveRawRowHash(row: SourceRow): string {
  return createHash("sha256").update(canonicalRawRow(row)).digest("hex");
}

export function requireUniqueSourceCoordinates(
  rows: readonly SourceRow[],
): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = canonicalJson(row.coordinate);
    if (seen.has(key)) {
      throw new SourceIngestError(
        "DUPLICATE_SOURCE_COORDINATE",
        `Duplicate source coordinate sourceArtifactHash=${row.coordinate.sourceArtifactHash}, rowNumber=${row.coordinate.rowNumber}`,
      );
    }
    seen.add(key);
  }
}

export function parseCsvSourceArtifact(
  bytes: Uint8Array,
  declaredSourceArtifactHash: string,
): SourceRow[] {
  requireArtifactHash(bytes, declaredSourceArtifactHash);
  const lines = artifactLines(bytes);
  const header = lines[0]?.split(",");
  if (
    !header ||
    header.length === 0 ||
    header.some((column) => column === "")
  ) {
    throw new SourceIngestError(
      "INVALID_SOURCE_ARTIFACT",
      "CSV source artifact must contain a non-empty header",
    );
  }
  if (new Set(header).size !== header.length) {
    throw new SourceIngestError(
      "INVALID_SOURCE_ARTIFACT",
      "CSV source artifact contains a duplicate header column",
    );
  }

  const rows = lines.slice(1).map((line, index) => {
    const cells = line.split(",");
    if (cells.length !== header.length) {
      throw new SourceIngestError(
        "INVALID_SOURCE_ARTIFACT",
        `CSV row ${index + 2} has ${cells.length} columns; expected ${header.length}`,
      );
    }
    return {
      coordinate: {
        sourceArtifactHash: declaredSourceArtifactHash,
        rowNumber: String(index + 2),
      },
      values: Object.fromEntries(
        header.map((column, columnIndex) => [column, cells[columnIndex] ?? ""]),
      ),
    };
  });
  requireUniqueSourceCoordinates(rows);
  return rows;
}

export function parseJsonLinesSourceArtifact(
  bytes: Uint8Array,
  declaredSourceArtifactHash: string,
): SourceRow[] {
  requireArtifactHash(bytes, declaredSourceArtifactHash);
  const rows = artifactLines(bytes).map((line, index) => {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new SourceIngestError(
        "INVALID_SOURCE_ARTIFACT",
        `JSON Lines row ${index + 1} is not valid JSON`,
      );
    }
    if (
      value === null ||
      Array.isArray(value) ||
      typeof value !== "object" ||
      Object.values(value).some((field) => typeof field !== "string")
    ) {
      throw new SourceIngestError(
        "INVALID_SOURCE_ARTIFACT",
        `JSON Lines row ${index + 1} must be an object of string values`,
      );
    }
    return {
      coordinate: {
        sourceArtifactHash: declaredSourceArtifactHash,
        rowNumber: String(index + 1),
      },
      values: value as Record<string, string>,
    };
  });
  requireUniqueSourceCoordinates(rows);
  return rows;
}
