import { createHash } from "node:crypto";

import {
  AllowedTransformSchema,
  TradeEventSchema,
  type AllowedTransform,
  type TradeEvent,
} from "@weavetrail/contracts";

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

export type EventSourceIdentity = {
  datasetId: string;
  venueId: string;
  sourceEventId: string;
};

export function deriveEventId(identity: EventSourceIdentity): string {
  return `event:${encodeURIComponent(identity.datasetId)}:${encodeURIComponent(identity.venueId)}:${encodeURIComponent(identity.sourceEventId)}`;
}

type MappedTargetField = Exclude<
  keyof TradeEvent,
  "datasetId" | "eventId" | "rawRowHash" | "schemaVersion" | "venueId"
>;

export type ApprovedSourceMapping = {
  mappingVersion: "1.1";
  sourceArtifactHash: string;
  constants: {
    schemaVersion: "1.0";
    datasetId: string;
    venueId: string;
  };
  fields: readonly (readonly [
    sourceColumn: string,
    targetField: MappedTargetField | null,
    transform: AllowedTransform | null,
  ])[];
};

export type MappingReviewCode =
  | "REQUIRED_TARGET_FIELD_MISSING"
  | "TRANSFORM_REJECTED_VALUE"
  | "UNKNOWN_SOURCE_COLUMN"
  | "UNKNOWN_TRANSFORM";

export type MappingReviewIssue = {
  code: MappingReviewCode;
  rowNumber: string;
  sourceColumn?: string;
  message: string;
};

export type MappingApplicationResult =
  | { status: "APPROVED"; events: TradeEvent[]; issues: [] }
  | { status: "REVIEW_REQUIRED"; issues: MappingReviewIssue[] };

function applyTransform(
  value: string,
  transform: AllowedTransform,
): string | undefined {
  switch (transform) {
    case "IDENTITY":
    case "ISO_DATETIME":
      return value;
    case "UPPERCASE":
      return value.toUpperCase();
    case "DECIMAL_STRING":
      return /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) ? value : undefined;
    case "BUY_SELL_CODE": {
      const sides: Record<string, string> = {
        B: "BUY",
        BUY: "BUY",
        S: "SELL",
        SELL: "SELL",
      };
      return sides[value.toUpperCase()];
    }
    case "EVENT_TYPE_CODE": {
      const eventTypes: Record<string, string> = {
        C: "ORDER_CANCEL",
        CANCEL: "ORDER_CANCEL",
        EXECUTION: "TRADE",
        N: "ORDER_NEW",
        NEW: "ORDER_NEW",
        T: "TRADE",
        TRADE: "TRADE",
      };
      return eventTypes[value.toUpperCase()];
    }
    case "EPOCH_MS_TO_ISO": {
      if (!/^-?\d+$/.test(value)) return undefined;
      const milliseconds = Number(value);
      if (!Number.isSafeInteger(milliseconds)) return undefined;
      try {
        return new Date(milliseconds).toISOString();
      } catch {
        return undefined;
      }
    }
  }
}

export function applyApprovedMapping(
  rows: readonly SourceRow[],
  mapping: ApprovedSourceMapping,
): MappingApplicationResult {
  const issues: MappingReviewIssue[] = [];
  const events: TradeEvent[] = [];
  const fieldMappings = new Map(
    mapping.fields.map(([sourceColumn, targetField, transform]) => [
      sourceColumn,
      { targetField, transform },
    ]),
  );

  for (const row of rows) {
    const candidate: Record<string, string> = { ...mapping.constants };
    for (const [sourceColumn, value] of Object.entries(row.values)) {
      const fieldMapping = fieldMappings.get(sourceColumn);
      if (!fieldMapping) {
        issues.push({
          code: "UNKNOWN_SOURCE_COLUMN",
          rowNumber: row.coordinate.rowNumber,
          sourceColumn,
          message: `Source column ${JSON.stringify(sourceColumn)} is not present in the approved mapping`,
        });
        continue;
      }
      if (fieldMapping.targetField === null) continue;
      const transformResult = AllowedTransformSchema.safeParse(
        fieldMapping.transform,
      );
      if (!transformResult.success) {
        issues.push({
          code: "UNKNOWN_TRANSFORM",
          rowNumber: row.coordinate.rowNumber,
          sourceColumn,
          message: `Source column ${JSON.stringify(sourceColumn)} names an unknown transform`,
        });
        continue;
      }
      const transformed = applyTransform(value, transformResult.data);
      if (transformed === undefined) {
        issues.push({
          code: "TRANSFORM_REJECTED_VALUE",
          rowNumber: row.coordinate.rowNumber,
          sourceColumn,
          message: `Transform ${transformResult.data} rejected source column ${JSON.stringify(sourceColumn)}`,
        });
        continue;
      }
      candidate[fieldMapping.targetField] = transformed;
    }

    const sourceEventId = candidate.sourceEventId;
    if (sourceEventId) {
      candidate.eventId = deriveEventId({
        datasetId: mapping.constants.datasetId,
        venueId: mapping.constants.venueId,
        sourceEventId,
      });
    }
    candidate.rawRowHash = deriveRawRowHash(row);

    const parsed = TradeEventSchema.safeParse(candidate);
    if (!parsed.success) {
      issues.push({
        code: "REQUIRED_TARGET_FIELD_MISSING",
        rowNumber: row.coordinate.rowNumber,
        message: `Mapped row ${row.coordinate.rowNumber} does not satisfy TradeEventSchema`,
      });
    } else {
      events.push(parsed.data);
    }
  }

  if (issues.length > 0) return { status: "REVIEW_REQUIRED", issues };
  return { status: "APPROVED", events, issues: [] };
}

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
