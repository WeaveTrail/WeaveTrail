import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  canonicalRawRow,
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
});
