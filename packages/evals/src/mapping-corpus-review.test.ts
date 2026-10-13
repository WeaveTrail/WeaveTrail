import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { preflight } from "./mapping-corpus-preflight";
import { generateMappingStudy, sha256 } from "./mapping-corpus-generator";
import {
  corpusReview,
  readReviewBaseline,
  requireCorpusSealReady,
  reviewBaselineDirectory,
} from "./mapping-corpus-review";

const study = generateMappingStudy();
describe("applied independent corpus review", () => {
  it("reports the applied original review and pending replacement review in preflight", () => {
    const review = corpusReview(study);
    const report = preflight(study);
    expect(report.independentGoldReview).toBe(review.status);
    expect(report).toMatchObject({
      replacementGoldReview: {
        status: "PENDING_INDEPENDENT_REVIEW",
        familyIds: review.records
          .filter((r) => r.changedDialectIds.length)
          .map((r) => r.familyId),
      },
    });
  });

  it("retains rejected lineage and requires review of replacement projections", () => {
    const report = corpusReview(study);
    expect(
      report.sealReadiness.blockers.map((b) => [b.code, b.familyIds.length]),
    ).toEqual([
      ["B1_SHARED_NULL_SLOT_TEMPLATE", 28],
      ["B2_SHARED_MUTATION_TEMPLATE", 12],
      ["CHANGED_INPUT_OR_GOLD_REQUIRES_INDEPENDENT_REVIEW", 15],
      ["CHANGED_FAMILY_REQUIRES_INDEPENDENT_LINEAGE_REVIEW", 4],
    ]);
    expect(report.sealReadiness.acceptedUnchangedFamilies).toBe(54);
    expect(report.exclusions).toHaveLength(15);
    expect(report.exclusions.flatMap((e) => e.replacedRecords)).toHaveLength(
      25,
    );
    expect(report.records.find((r) => r.familyId === "f-009")).toMatchObject({
      currentLineage: "PENDING_REVIEW",
      changedDialectIds: ["d-009"],
    });
    expect(report.records.find((r) => r.familyId === "f-001")).toMatchObject({
      currentLineage: "ACCEPTED",
      changedDialectIds: [],
    });
    expect(() => requireCorpusSealReady(study)).toThrow(
      "Corpus sealing blocked",
    );
  });

  it.each(["TARGET", "DISPOSITION", "INPUT", "VALIDATOR"] as const)(
    "never inherits review after a %s change",
    (kind) => {
      const changed = structuredClone(study);
      const gold = changed.splits[0]!.gold.records[0]!;
      if (kind === "TARGET") gold.columns[0]!.targetField = "actorId";
      else if (kind === "DISPOSITION")
        gold.expectedDisposition = "REVIEW_REQUIRED";
      else if (kind === "VALIDATOR")
        gold.expectedValidator = "TRANSFORM_FAILED";
      else changed.splits[0]!.input.inputs[0]!.inputHash = "0".repeat(64);
      const record = corpusReview(changed).records.find(
        (r) => r.familyId === gold.familyId,
      )!;
      expect(record.currentLineage).toBe("PENDING_REVIEW");
      expect(record.changedDialectIds).toContain(gold.dialectId);
    },
  );

  it.each([
    "lineageId",
    "parents",
    "eventKinds",
    "problem",
    "namingConvention",
    "independence",
    "author",
  ] as const)(
    "does not inherit lineage acceptance after changing %s",
    (field) => {
      const changed = structuredClone(study);
      const family = changed.families.find((f) => f.id === "f-001")!;
      if (field === "parents") family.parents = ["f-002"];
      else if (field === "eventKinds") family.eventKinds = ["ORDER_NEW"];
      else if (field === "lineageId") family.lineageId = "f-002";
      else family[field] += " redesigned";
      const record = corpusReview(changed).records.find(
        (r) => r.familyId === family.id,
      )!;
      expect(record.currentLineage).toBe("PENDING_REVIEW");
      expect(record.changedDialectIds).toEqual([]);
      expect(corpusReview(changed).sealReadiness.blockers).toContainEqual(
        expect.objectContaining({
          code: "CHANGED_FAMILY_REQUIRES_INDEPENDENT_LINEAGE_REVIEW",
          familyIds: expect.arrayContaining([family.id]),
        }),
      );
    },
  );

  it.each(["TARGET", "DISPOSITION", "VALIDATOR"] as const)(
    "binds replacement gold after a gold-only %s change",
    (kind) => {
      const changed = structuredClone(study);
      const gold = changed.splits[0]!.gold.records[0]!;
      const input = changed.splits[0]!.input.inputs[0]!;
      if (kind === "TARGET") gold.columns[0]!.targetField = "actorId";
      else if (kind === "DISPOSITION")
        gold.expectedDisposition = "REVIEW_REQUIRED";
      else gold.expectedValidator = "TRANSFORM_FAILED";
      const exclusion = corpusReview(changed).exclusions.find(
        (e) => e.familyId === gold.familyId,
      )!;
      expect(exclusion).toMatchObject({
        replacementRecords: [
          {
            dialectId: gold.dialectId,
            inputHash: input.inputHash,
            goldSha256: sha256(JSON.stringify(gold)),
          },
        ],
      });
      expect(input.inputHash).toBe(exclusion.replacedRecords[0]!.inputHash);
    },
  );

  it("rejects changing a family stratum or assigning an old dialect to a different family", () => {
    const changed = structuredClone(study);
    changed.families[0]!.stratum = "MUST_REVIEW";
    expect(() => corpusReview(changed)).toThrow("family binding mismatch");
    const rebound = structuredClone(study);
    const first = rebound.splits[0]!.gold.records[0]!;
    const second = rebound.splits[0]!.gold.records[1]!;
    [first.dialectId, second.dialectId] = [second.dialectId, first.dialectId];
    expect(() => corpusReview(rebound)).toThrow("dialect/family mismatch");
  });

  it.each(["BYTES", "SCHEMA", "DOCUMENT"] as const)(
    "rejects a corrupted review baseline: %s",
    (kind) => {
      const root = mkdtempSync(join(tmpdir(), "weavetrail-review-baseline-"));
      try {
        cpSync(reviewBaselineDirectory, root, { recursive: true });
        const path = join(root, "baseline.json");
        const baseline = JSON.parse(readFileSync(path, "utf8"));
        if (kind === "SCHEMA") baseline.unreviewedClaim = true;
        else if (kind === "DOCUMENT")
          baseline.reviewDocumentSha256 = "0".repeat(64);
        else baseline.reviewer += " changed";
        const bytes = JSON.stringify(baseline);
        writeFileSync(path, bytes);
        if (kind !== "BYTES")
          writeFileSync(
            join(root, "baseline.sha256"),
            `${sha256(bytes)}  baseline.json\n`,
          );
        expect(() => readReviewBaseline(pathToFileURL(`${root}/`))).toThrow(
          kind === "BYTES"
            ? "checksum mismatch"
            : kind === "DOCUMENT"
              ? "document binding mismatch"
              : "Unrecognized key",
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("seed-places renamed and added columns while retaining unchanged relative order", () => {
    const drift = study.splits.find((s) => s.input.split === "DRIFT")!;
    const positions: number[] = [];
    for (const relation of study.relations.filter(
      (r) => r.change === "RENAME" || r.change === "ADD",
    )) {
      const base = drift.input.inputs.find(
        (i) => i.dialectId === relation.baseDialectId,
      )!;
      const next = drift.input.inputs.find(
        (i) => i.dialectId === relation.dialectId,
      )!;
      const unchanged = relation.observable
        .filter((o) => o.label === "UNCHANGED")
        .map((o) => o.name);
      expect(
        next.projection.columns
          .filter((c) => unchanged.includes(c.name))
          .map((c) => c.name),
      ).toEqual(
        base.projection.columns
          .filter((c) => unchanged.includes(c.name))
          .map((c) => c.name),
      );
      positions.push(
        next.projection.columns.findIndex((c) =>
          relation.observable.some(
            (o) => o.label === "ADDED" && o.name === c.name,
          ),
        ),
      );
    }
    expect(new Set(positions).size).toBeGreaterThan(3);
  });
});
