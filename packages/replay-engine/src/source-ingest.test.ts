import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
} from "@weavetrail/scenarios";
import { canonicalDatasetHash } from "./canonical-dataset";
import { canonicalizeEvents, projectCanonicalEvent } from "./canonicalize";
import { replayFoundation } from "./replay-foundation";

import {
  applyApprovedMapping,
  canonicalRawRow,
  deriveEventId,
  deriveRawRowHash,
  parseCsvSourceArtifact,
  parseJsonLinesSourceArtifact,
  requireUniqueSourceCoordinates,
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

  it.each([
    ["unknown source column", "UNKNOWN_SOURCE_COLUMN"],
    ["unknown transform", "UNKNOWN_TRANSFORM"],
    ["transform-rejected value", "TRANSFORM_REJECTED_VALUE"],
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
      } else {
        rows[0]!.values.side_code = "UNKNOWN_SIDE";
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
