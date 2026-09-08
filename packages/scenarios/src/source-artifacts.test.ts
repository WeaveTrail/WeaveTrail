import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  publishedExecutionFixProposal,
  publishedExecutionH0stcnt0Proposal,
} from "./published-execution-schema";
import { syntheticSourceProvenanceByArtifact } from "./source-provenance";

type ProvenanceRecord = {
  kind: "real" | "synthetic";
  provider: string;
  title: string;
  originUrl?: string;
  retrievedAt?: string;
  licence?: {
    termsUrl: string;
    checkedAt: string;
    attribution: string;
  };
  artifacts: {
    runtimeSource?: { path: string; sha256: string };
    runtimeJsonl?: { path: string; sha256: string };
  };
  derivation?: {
    kind: string;
    description: string;
    schemaSources: {
      id: string;
      title: string;
      url: string;
      retrievedOn: string;
    }[];
    ruleSources: {
      id: string;
      title: string;
      url: string;
      retrievedOn: string;
      usage: string;
    }[];
    fieldCorrespondence: {
      publishedField: string;
      committedColumn: string;
      canonicalUse: string;
      schemaSourceIds: string[];
    }[];
    takenFromSpecifications?: string[];
    inventedProperties?: string[];
    actorDimension?: string;
    absentFields?: {
      investigationField: string;
      reason: string;
      workbenchHandling: string;
    }[];
  };
  syntheticity?: {
    values: string;
    entities: string;
    marketData: string;
  };
};

const scenarioSourceRoot = fileURLToPath(
  new URL("./sources/", import.meta.url),
);
const publishedSourceRoot = fileURLToPath(
  new URL("../../published-data/src/sources/real/", import.meta.url),
);

function filesBelow(root: string): string[] {
  return readdirSync(root)
    .flatMap((name) => {
      const path = join(root, name);
      return statSync(path).isDirectory() ? filesBelow(path) : [path];
    })
    .sort();
}

function readRecord(path: string): ProvenanceRecord {
  return JSON.parse(readFileSync(path, "utf8")) as ProvenanceRecord;
}

function runtimeArtifact(recordPath: string, record: ProvenanceRecord) {
  const artifact =
    record.kind === "synthetic"
      ? record.artifacts.runtimeSource
      : record.artifacts.runtimeJsonl;
  if (!artifact)
    throw new Error(`${recordPath} has no runtime source artifact`);
  return {
    path: resolve(dirname(recordPath), artifact.path),
    sha256: artifact.sha256,
  };
}

function artifactBytes(name: string): Buffer {
  return readFileSync(new URL(`./sources/${name}`, import.meta.url));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("synthetic source artifacts", () => {
  it.each([
    [
      "actorless-multi-instrument-quotes.jsonl",
      "b1eae0149d9903a25e30f66e630d441035b3356b191d54e7c30327fe1853f094",
    ],
    [
      "concentrated-buy-dialect-a.csv",
      "d4bd80adf6a853adcf98f9ee08092f786b9b9276b349ad11fef6d0af078b867e",
    ],
    [
      "concentrated-buy-dialect-b.jsonl",
      "71a367b78a9bfefa685b9f40414b778712860b358882537b7f87127ab1584cff",
    ],
    [
      "published-execution-fix44.csv",
      "f623c3327251b5323b07d066cb940bee0ac0ed895c39fb81707469ae1e1f958b",
    ],
    [
      "published-execution-h0stcnt0.jsonl",
      "c6fb040df7cf060d43795424f95a8261b0ca4a06486750639c9762e39893c8ef",
    ],
    [
      "rapid-price-lift-supported.csv",
      "72511e0c67ec066130fcb10d92f0afa43e1147023722ca0fa6d82ef57a90a827",
    ],
    [
      "rapid-price-lift-broad-participation.csv",
      "08b1d150939e10d91c8818424572feab58e55e6fd2e71acd3a2149b72b76f6d0",
    ],
    [
      "rapid-price-lift-insufficient-evidence.csv",
      "15f79ef0265f836b5a01635bbcdd8e2f241431fbcc87fc504a1e2f7ea05582f7",
    ],
  ])("pins the exact bytes of %s", (name, expectedHash) => {
    const bytes = artifactBytes(name);

    expect(bytes.includes(13)).toBe(false);
    expect(sha256(bytes)).toBe(expectedHash);
  });

  it("records every committed synthetic and published replay source exactly once", () => {
    const roots = [scenarioSourceRoot, publishedSourceRoot];
    const sourceFiles = roots.flatMap((root) =>
      filesBelow(root).filter((path) => /\.(?:csv|jsonl)$/.test(path)),
    );
    const recordFiles = roots.flatMap((root) =>
      filesBelow(root).filter((path) => path.endsWith(".provenance.json")),
    );
    const claims = recordFiles.map((recordPath) => {
      const record = readRecord(recordPath);
      return {
        recordPath,
        record,
        ...runtimeArtifact(recordPath, record),
      };
    });

    expect(claims.map(({ path }) => path).sort()).toEqual(sourceFiles.sort());
    expect(new Set(claims.map(({ path }) => path)).size).toBe(claims.length);
    for (const claim of claims) {
      expect(
        sha256(readFileSync(claim.path)),
        relative(resolve(scenarioSourceRoot, "../../../.."), claim.recordPath),
      ).toBe(claim.sha256);
      expect(claim.record.provider).not.toHaveLength(0);
      expect(claim.record.title).not.toHaveLength(0);
      if (claim.record.kind === "synthetic") {
        expect(claim.record.syntheticity?.values).toContain("synthetic");
        expect(claim.record.syntheticity?.entities).toContain("No real");
        expect(claim.record.syntheticity?.marketData).toContain(
          "No market data",
        );
        expect(claim.record.derivation?.description).not.toHaveLength(0);
        expect(claim.record.derivation?.schemaSources).toBeInstanceOf(Array);
        expect(claim.record.derivation?.ruleSources).toBeInstanceOf(Array);
        expect(claim.record.derivation?.fieldCorrespondence).toBeInstanceOf(
          Array,
        );
      } else {
        expect(new URL(claim.record.originUrl!).protocol).toBe("https:");
        expect(Date.parse(claim.record.retrievedAt!)).not.toBeNaN();
        expect(new URL(claim.record.licence!.termsUrl).protocol).toBe("https:");
        expect(Date.parse(claim.record.licence!.checkedAt)).not.toBeNaN();
        expect(claim.record.licence!.attribution).not.toHaveLength(0);
      }
    }

    expect(Object.keys(syntheticSourceProvenanceByArtifact).sort()).toEqual(
      filesBelow(scenarioSourceRoot)
        .filter((path) => /\.(?:csv|jsonl)$/.test(path))
        .map((path) => relative(scenarioSourceRoot, path))
        .sort(),
    );
  });

  it.each([
    {
      recordName: "published-execution-fix44.provenance.json",
      expectedFields: [
        "ExecID",
        "TransactTime",
        "Symbol",
        "Side",
        "LastPx",
        "LastQty",
        "Account",
      ],
      expectedColumns: publishedExecutionFixProposal.fields.map(
        ({ sourceColumn }) => sourceColumn,
      ),
      absentActor: false,
    },
    {
      recordName: "published-execution-h0stcnt0.provenance.json",
      expectedFields: [
        "MKSC_SHRN_ISCD",
        "STCK_CNTG_HOUR",
        "STCK_PRPR",
        "CNTG_VOL",
        "CCLD_DVSN",
        "BSOP_DATE",
      ],
      expectedColumns: publishedExecutionH0stcnt0Proposal.fields.map(
        ({ sourceColumn }) => sourceColumn,
      ),
      absentActor: true,
    },
  ])(
    "pins the published field correspondence and derivation boundary in $recordName",
    ({ recordName, expectedFields, expectedColumns, absentActor }) => {
      const record = readRecord(join(scenarioSourceRoot, recordName));
      const derivation = record.derivation!;

      expect(derivation.kind).toBe("published-schema-projection");
      expect(
        derivation.fieldCorrespondence.map(
          ({ publishedField }) => publishedField,
        ),
      ).toEqual(expectedFields);
      expect(
        derivation.fieldCorrespondence.map(
          ({ committedColumn }) => committedColumn,
        ),
      ).toEqual(expectedColumns);

      const schemaSourceIds = new Set(
        derivation.schemaSources.map(({ id }) => id),
      );
      for (const correspondence of derivation.fieldCorrespondence) {
        expect(correspondence.canonicalUse).not.toHaveLength(0);
        expect(correspondence.schemaSourceIds.length).toBeGreaterThan(0);
        for (const sourceId of correspondence.schemaSourceIds)
          expect(schemaSourceIds.has(sourceId), sourceId).toBe(true);
      }
      for (const source of [
        ...derivation.schemaSources,
        ...derivation.ruleSources,
      ]) {
        expect(new URL(source.url).protocol).toBe("https:");
        expect(source.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      expect(derivation.schemaSources.length).toBeGreaterThan(0);
      expect(derivation.ruleSources).toHaveLength(2);
      for (const ruleSource of derivation.ruleSources)
        expect(ruleSource.usage).toContain("rule only");
      expect(derivation.takenFromSpecifications?.join(" ")).toMatch(
        /field names|numeric tags/,
      );
      expect(derivation.takenFromSpecifications?.join(" ")).toMatch(
        /code values/,
      );
      expect(derivation.takenFromSpecifications?.join(" ")).toMatch(/notation/);
      expect(derivation.takenFromSpecifications?.join(" ")).toMatch(
        /session hours/,
      );
      expect(derivation.takenFromSpecifications?.join(" ")).toMatch(
        /tick size/,
      );
      expect(derivation.inventedProperties?.join(" ")).toMatch(/instrument/);
      expect(derivation.inventedProperties?.join(" ")).toMatch(/prices/);
      expect(derivation.inventedProperties?.join(" ")).toMatch(
        /quantities and volumes/,
      );
      expect(derivation.actorDimension).toContain(
        "Per-execution actor attribution is not published",
      );
      expect(derivation.actorDimension).toContain("eligibility condition");
      expect(record.syntheticity?.values).toContain("Every value");
      expect(record.syntheticity?.entities).toContain("No real issuer");
      expect(record.syntheticity?.marketData).toContain(
        "No market data was requested, retrieved, committed, redistributed",
      );

      if (absentActor) {
        expect(derivation.absentFields).toEqual([
          expect.objectContaining({
            investigationField: "actorId",
            reason: expect.stringContaining("no participant or account field"),
            workbenchHandling: expect.stringMatching(
              /REVIEW_REQUIRED.*does not copy, infer or synthesize an actor/,
            ),
          }),
        ]);
      } else {
        expect(derivation.absentFields).toEqual([]);
        expect(derivation.inventedProperties?.join(" ")).toMatch(/actor/);
      }
    },
  );
});
