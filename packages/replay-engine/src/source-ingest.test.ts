import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  concentratedBuyEvents,
  concentratedBuyDialectAMapping,
  concentratedBuyDialectARows,
  concentratedBuyDialectBMapping,
  concentratedBuyDialectBRows,
} from "@weavetrail/scenarios";
import { canonicalDatasetHash } from "./canonical-dataset";
import { canonicalizeEvents, projectCanonicalEvent } from "./canonicalize";
import { evaluateMappingAgreement } from "./mapping-evaluation";
import { replayFoundation } from "./replay-foundation";

import {
  applyApprovedMapping,
  canonicalRawRow,
  deriveEventId,
  deriveRawRowHash,
  parseCsvSourceArtifact,
  parseJsonLinesSourceArtifact,
  requireUniqueSourceCoordinates,
  sourceArtifactHash,
  SourceIngestError,
} from "./source-ingest";

const DIALECT_A_HASH =
  "d4bd80adf6a853adcf98f9ee08092f786b9b9276b349ad11fef6d0af078b867e";
const DIALECT_B_HASH =
  "71a367b78a9bfefa685b9f40414b778712860b358882537b7f87127ab1584cff";

function artifactBytes(name: string): Buffer {
  return readFileSync(
    new URL(`../../scenarios/src/sources/${name}`, import.meta.url),
  );
}

describe("source provenance", () => {
  const dialectABytes = artifactBytes("concentrated-buy-dialect-a.csv");
  const dialectBBytes = artifactBytes("concentrated-buy-dialect-b.jsonl");

  it("derives the pinned source artifact hashes from exact bytes", () => {
    expect(sourceArtifactHash(dialectABytes)).toBe(DIALECT_A_HASH);
    expect(sourceArtifactHash(dialectBBytes)).toBe(DIALECT_B_HASH);
  });

  it("keeps every declared source row byte-faithful to its committed artifact", () => {
    const parsedRowsByArtifact = new Map([
      [
        DIALECT_A_HASH,
        parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH),
      ],
      [
        DIALECT_B_HASH,
        parseJsonLinesSourceArtifact(dialectBBytes, DIALECT_B_HASH),
      ],
    ]);

    for (const declaredRow of [
      ...concentratedBuyDialectARows,
      ...concentratedBuyDialectBRows,
    ]) {
      const parsedRows = parsedRowsByArtifact.get(
        declaredRow.coordinate.sourceArtifactHash,
      );
      expect(parsedRows).toBeDefined();

      const parsedRow = parsedRows!.find(
        ({ coordinate }) =>
          coordinate.rowNumber === declaredRow.coordinate.rowNumber,
      );
      expect(parsedRow?.values).toEqual(declaredRow.values);
    }
  });

  it("serializes raw columns in canonical key order without coercion", () => {
    const [row] = parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH);

    expect(canonicalRawRow(row!)).toContain(
      '"values":{"actor":"actor-c","counterparty":"liquidity-3"',
    );
    expect(canonicalRawRow(row!)).toContain('"px":"101.25"');
  });

  it("derives different row hashes for semantically corresponding dialect rows", () => {
    const [dialectARow] = parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH);
    const [dialectBRow] = parseJsonLinesSourceArtifact(
      dialectBBytes,
      DIALECT_B_HASH,
    );

    expect(deriveRawRowHash(dialectARow!)).not.toBe(
      deriveRawRowHash(dialectBRow!),
    );
  });

  it("derives readable event IDs from source identity independent of row position", () => {
    const identities = [
      {
        datasetId: "synthetic-concentrated-buy-v1",
        venueId: "SYNTH-X",
        sourceEventId: "source-001",
      },
      {
        datasetId: "synthetic-concentrated-buy-v1",
        venueId: "SYNTH-X",
        sourceEventId: "source:002",
      },
    ];
    const baseline = identities.map(deriveEventId).sort();
    const shuffled = [...identities].reverse().map(deriveEventId).sort();

    expect(baseline).toEqual(shuffled);
    expect(baseline).toEqual([
      "event:synthetic-concentrated-buy-v1:SYNTH-X:source%3A002",
      "event:synthetic-concentrated-buy-v1:SYNTH-X:source-001",
    ]);
  });

  it("fails closed when artifact bytes do not match the declared hash", () => {
    const changedBytes = Buffer.concat([dialectABytes, Buffer.from("changed")]);

    expect(() => parseCsvSourceArtifact(changedBytes, DIALECT_A_HASH)).toThrow(
      expect.objectContaining({ code: "SOURCE_ARTIFACT_HASH_MISMATCH" }),
    );
  });

  it("fails closed on duplicate source coordinates", () => {
    const [row] = parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH);

    expect(() => requireUniqueSourceCoordinates([row!, row!])).toThrow(
      expect.objectContaining({ code: "DUPLICATE_SOURCE_COORDINATE" }),
    );
    expect(() => requireUniqueSourceCoordinates([row!, row!])).toThrow(
      SourceIngestError,
    );
  });

  it("routes duplicate source coordinates to review before mapping", () => {
    const [row] = parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH);
    const conflictingRow = {
      ...row!,
      values: { ...row!.values, source_id: "source-conflict" },
    };

    const result = applyApprovedMapping(
      [row!, conflictingRow],
      concentratedBuyDialectAMapping,
    );
    expect(result).toMatchObject({
      status: "REVIEW_REQUIRED",
      issues: [
        expect.objectContaining({ code: "DUPLICATE_SOURCE_COORDINATE" }),
      ],
    });
    expect(result).not.toHaveProperty("events");
  });

  it("routes duplicate target-field mappings to review before overwrite", () => {
    const [row] = parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH);
    const mapping = {
      ...concentratedBuyDialectAMapping,
      fields: concentratedBuyDialectAMapping.fields.map((field) =>
        field[0] === "qty" ? ([field[0], "price", field[2]] as const) : field,
      ),
    } as const;

    const result = applyApprovedMapping([row!], mapping);
    expect(result).toMatchObject({
      status: "REVIEW_REQUIRED",
      issues: [expect.objectContaining({ code: "DUPLICATE_TARGET_FIELD" })],
    });
    expect(result).not.toHaveProperty("events");
  });

  it("rejects duplicate source-column mappings identically in both listing orders", () => {
    const [row] = parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH);
    const fieldsWithoutQuantityOrOrder =
      concentratedBuyDialectAMapping.fields.filter(
        ([sourceColumn]) =>
          sourceColumn !== "qty" && sourceColumn !== "order_ref",
      );
    const quantityMapping = ["qty", "quantity", "DECIMAL_STRING"] as const;
    const orderMapping = ["qty", "orderId", "DECIMAL_STRING"] as const;
    const ignoredOrder = ["order_ref", null, null] as const;
    const mappings = [
      {
        ...concentratedBuyDialectAMapping,
        fields: [
          ...fieldsWithoutQuantityOrOrder,
          ignoredOrder,
          quantityMapping,
          orderMapping,
        ],
      },
      {
        ...concentratedBuyDialectAMapping,
        fields: [
          ...fieldsWithoutQuantityOrOrder,
          ignoredOrder,
          orderMapping,
          quantityMapping,
        ],
      },
    ] as const;

    const results = mappings.map((mapping) =>
      applyApprovedMapping([row!], mapping),
    );
    for (const result of results) {
      expect(result).toMatchObject({
        status: "REVIEW_REQUIRED",
        issues: [expect.objectContaining({ code: "DUPLICATE_SOURCE_COLUMN" })],
      });
      expect(result).not.toHaveProperty("events");
      expect(result).not.toHaveProperty("canonicalResultHash");
    }
    expect(results[0]!.issues).toEqual(results[1]!.issues);
  });

  it.each([
    ["missing", null],
    ["unknown", "MODEL_GENERATED_CODE"],
  ] as const)(
    "reports a %s transform once for a multi-row artifact",
    (_, invalidTransform) => {
      const rows = parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH);
      const mapping = {
        ...concentratedBuyDialectAMapping,
        fields: concentratedBuyDialectAMapping.fields.map((field) =>
          field[0] === "side_code"
            ? [field[0], field[1], invalidTransform]
            : field,
        ),
      } as unknown as typeof concentratedBuyDialectAMapping;

      const result = applyApprovedMapping(rows, mapping);
      expect(result.status).toBe("REVIEW_REQUIRED");
      expect(
        result.issues.filter(({ code }) => code === "UNKNOWN_TRANSFORM"),
      ).toHaveLength(1);
      expect(result).not.toHaveProperty("events");
    },
  );

  it("applies both committed approved mappings", () => {
    const dialectA = applyApprovedMapping(
      parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH),
      concentratedBuyDialectAMapping,
    );
    const dialectB = applyApprovedMapping(
      parseJsonLinesSourceArtifact(dialectBBytes, DIALECT_B_HASH),
      concentratedBuyDialectBMapping,
    );

    expect(dialectA).toMatchObject({ status: "APPROVED", issues: [] });
    expect(dialectB).toMatchObject({ status: "APPROVED", issues: [] });
  });

  it("re-derives every generated fixture event and raw-row hash", () => {
    const dialectARows = parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH);
    const dialectA = applyApprovedMapping(
      dialectARows,
      concentratedBuyDialectAMapping,
    );
    expect(dialectA.status).toBe("APPROVED");
    if (dialectA.status !== "APPROVED") {
      throw new Error("committed dialect A mapping must be approved");
    }

    expect(dialectA.events).toEqual(concentratedBuyEvents);
    for (const [index, event] of concentratedBuyEvents.entries()) {
      expect(event.rawRowHash).toBe(deriveRawRowHash(dialectARows[index]!));
      expect(event.rawRowHash).not.toMatch(/^([a-f0-9])\1{63}$/);
    }
  });

  it("converges equivalent source dialects to one canonical dataset and result", () => {
    const dialectARows = parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH);
    const dialectBRows = parseJsonLinesSourceArtifact(
      dialectBBytes,
      DIALECT_B_HASH,
    );
    const dialectA = applyApprovedMapping(
      dialectARows,
      concentratedBuyDialectAMapping,
    );
    const dialectB = applyApprovedMapping(
      dialectBRows,
      concentratedBuyDialectBMapping,
    );
    expect(dialectA.status).toBe("APPROVED");
    expect(dialectB.status).toBe("APPROVED");
    if (dialectA.status !== "APPROVED" || dialectB.status !== "APPROVED") {
      throw new Error("committed source mappings must be approved");
    }

    const dialectAEvents = canonicalizeEvents(dialectA.events).events;
    const dialectBEvents = canonicalizeEvents(dialectB.events).events;
    expect(dialectAEvents.map(projectCanonicalEvent)).toEqual(
      dialectBEvents.map(projectCanonicalEvent),
    );
    expect(canonicalDatasetHash(dialectA.events)).toBe(
      canonicalDatasetHash(dialectB.events),
    );
    expect(replayFoundation(dialectA.events).canonicalResultHash).toBe(
      replayFoundation(dialectB.events).canonicalResultHash,
    );

    expect(DIALECT_A_HASH).not.toBe(DIALECT_B_HASH);
    const dialectBRowsBySourceId = new Map(
      dialectB.events.map((event, index) => [
        event.sourceEventId,
        dialectBRows[index]!,
      ]),
    );
    for (const [index, event] of dialectA.events.entries()) {
      const dialectBRow = dialectBRowsBySourceId.get(event.sourceEventId);
      expect(dialectBRow).toBeDefined();
      expect(deriveRawRowHash(dialectARows[index]!)).not.toBe(
        deriveRawRowHash(dialectBRow!),
      );
    }
  });

  it("reports field-level mapping agreement counts and review outcomes", () => {
    const dialectA = applyApprovedMapping(
      parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH),
      concentratedBuyDialectAMapping,
    );
    const dialectB = applyApprovedMapping(
      parseJsonLinesSourceArtifact(dialectBBytes, DIALECT_B_HASH),
      concentratedBuyDialectBMapping,
    );
    const report = evaluateMappingAgreement(dialectA, dialectB);

    expect(report.reviewOutcomes).toEqual({
      left: "APPROVED",
      right: "APPROVED",
    });
    expect(report.comparedEventCount).toBe(4);
    expect(report.fieldAgreement).toHaveLength(15);
    expect(report.fieldAgreement).toEqual(
      expect.arrayContaining([
        { field: "eventTime", agreements: 4, comparisons: 4 },
        { field: "price", agreements: 4, comparisons: 4 },
        { field: "quantity", agreements: 4, comparisons: 4 },
      ]),
    );
    expect(JSON.stringify(report)).not.toMatch(/percentage|accuracy/i);
  });

  it.each([
    ["unknown source column", "UNKNOWN_SOURCE_COLUMN"],
    ["unknown transform", "UNKNOWN_TRANSFORM"],
    ["transform-rejected value", "TRANSFORM_REJECTED_VALUE"],
    ["missing required target", "REQUIRED_TARGET_FIELD_MISSING"],
    ["mapping artifact mismatch", "SOURCE_ARTIFACT_HASH_MISMATCH"],
  ] as const)(
    "routes %s to review without events",
    (mutation, expectedCode) => {
      const [row] = parseCsvSourceArtifact(dialectABytes, DIALECT_A_HASH);
      const rows = [{ ...row!, values: { ...row!.values } }];
      let mapping: typeof concentratedBuyDialectAMapping | unknown =
        concentratedBuyDialectAMapping;

      if (mutation === "unknown source column") {
        rows[0]!.values.unapproved = "source-text";
      } else if (mutation === "unknown transform") {
        mapping = {
          ...concentratedBuyDialectAMapping,
          fields: concentratedBuyDialectAMapping.fields.map((field) =>
            field[0] === "side_code"
              ? [field[0], field[1], "MODEL_GENERATED_CODE"]
              : field,
          ),
        };
      } else if (mutation === "transform-rejected value") {
        rows[0]!.values.side_code = "UNKNOWN_SIDE";
      } else if (mutation === "missing required target") {
        delete rows[0]!.values.source_id;
      } else {
        rows[0]!.coordinate = {
          ...rows[0]!.coordinate,
          sourceArtifactHash: DIALECT_B_HASH,
        };
      }

      const result = applyApprovedMapping(
        rows,
        mapping as typeof concentratedBuyDialectAMapping,
      );
      expect(result.status).toBe("REVIEW_REQUIRED");
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: expectedCode }),
        ]),
      );
      expect(result).not.toHaveProperty("events");
      expect(result).not.toHaveProperty("canonicalDatasetHash");
    },
  );
});
