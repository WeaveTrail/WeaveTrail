import { readFileSync } from "node:fs";
import { z } from "zod";
import { ColumnAssignmentSchema, cells } from "./mapping-corpus-contract";
import { sha256, type MappingStudy } from "./mapping-corpus-generator";

export const reviewBaselineDirectory = new URL(
  "../fixtures/mapping-study-review-v1/",
  import.meta.url,
);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
export const ReviewBaselineSchema = z
  .object({
    version: z.literal("mapping-study-review-baseline/1"),
    sourceCommit: z.string().regex(/^[a-f0-9]{40}$/u),
    reviewDocument: z.literal("docs/MAPPING_STUDY_V1_GOLD_REVIEW.md"),
    reviewDocumentSha256: HashSchema,
    reviewer: z.string().min(1),
    reviewedAt: z.literal("2026-10-13"),
    files: z.array(
      z.object({ path: z.string().min(1), sha256: HashSchema }).strict(),
    ),
    records: z.array(
      z
        .object({
          dialectId: z.string().min(1),
          familyId: z.string().min(1),
          split: z.enum(["SELECT", "AUDIT", "DRIFT"]),
          inputHash: HashSchema,
          goldSha256: HashSchema,
          familySha256: HashSchema,
          stratum: z.enum(["RESOLVABLE", "HARD_RESOLVABLE", "MUST_REVIEW"]),
          cell: z.enum(cells),
          canonicalAssignments: z.array(ColumnAssignmentSchema),
          expectedValidator: z.enum([
            "VALID",
            "MISSING_REQUIRED_TARGET",
            "TRANSFORM_FAILED",
          ]),
          expectedDisposition: z.enum([
            "PROPOSAL_OFFERABLE",
            "REVIEW_REQUIRED",
          ]),
          absentRequiredTargets: z.array(z.string()),
        })
        .strict(),
    ),
  })
  .strict();

export function readReviewBaseline(directory: URL = reviewBaselineDirectory) {
  const bytes = readFileSync(new URL("baseline.json", directory), "utf8");
  if (
    readFileSync(new URL("baseline.sha256", directory), "utf8") !==
    `${sha256(bytes)}  baseline.json\n`
  )
    throw new Error("Independent review baseline checksum mismatch");
  const baseline = ReviewBaselineSchema.parse(JSON.parse(bytes));
  if (
    sha256(
      readFileSync(
        new URL(
          "../../../docs/MAPPING_STUDY_V1_GOLD_REVIEW.md",
          import.meta.url,
        ),
      ),
    ) !== baseline.reviewDocumentSha256
  )
    throw new Error("Independent review document binding mismatch");
  return { baseline, sha256: sha256(bytes) };
}

/** Apply only the recorded decisions. Changed provider bytes need a new review. */
export function corpusReview(study: MappingStudy) {
  const { baseline, sha256: baselineSha256 } = readReviewBaseline();
  const inputs = study.splits.flatMap((s) => s.input.inputs);
  if (
    new Set(baseline.records.map((r) => r.dialectId)).size !==
      baseline.records.length ||
    baseline.records.length !== inputs.length ||
    inputs.some(
      (i) => !baseline.records.some((r) => r.dialectId === i.dialectId),
    )
  )
    throw new Error(
      "Independent review baseline must cover exactly the current dialect IDs",
    );
  const records = study.families.map((family) => {
    const original = baseline.records.filter((r) => r.familyId === family.id);
    const current = study.splits
      .flatMap((s) => s.gold.records)
      .filter((g) => g.familyId === family.id);
    if (
      !original.length ||
      original.length !== current.length ||
      original.some(
        (r) =>
          r.split !== family.split ||
          r.cell !== family.cell ||
          r.stratum !== family.stratum,
      )
    )
      throw new Error(
        `Independent review family binding mismatch: ${family.id}`,
      );
    const changed = original.filter((r) => {
      const gold = current.find((g) => g.dialectId === r.dialectId);
      if (!gold)
        throw new Error(
          `Independent review dialect/family mismatch: ${r.dialectId}`,
        );
      const tuples = gold.columns.map((c) =>
        Object.fromEntries(
          Object.entries(c).filter(([key]) =>
            [
              "columnId",
              "sourceColumn",
              "targetField",
              "transform",
              "status",
            ].includes(key),
          ),
        ),
      );
      return (
        inputs.find((i) => i.dialectId === r.dialectId)!.inputHash !==
          r.inputHash ||
        JSON.stringify(tuples) !== JSON.stringify(r.canonicalAssignments) ||
        gold.expectedValidator !== r.expectedValidator ||
        gold.expectedDisposition !== r.expectedDisposition ||
        JSON.stringify(gold.absentRequiredTargets) !==
          JSON.stringify(r.absentRequiredTargets)
      );
    });
    const rejected =
      family.stratum === "MUST_REVIEW" || family.split === "DRIFT";
    return {
      familyId: family.id,
      author: family.author,
      originalReview: {
        reviewer: baseline.reviewer,
        reviewedAt: baseline.reviewedAt,
        gold: "AGREED",
        lineage: rejected ? "REJECTED_AS_AUTHORED" : "ACCEPTED",
        finding:
          family.split === "DRIFT"
            ? "B2"
            : family.stratum === "MUST_REVIEW"
              ? "B1"
              : null,
        originalRecords: original.map((r) => ({
          dialectId: r.dialectId,
          familyId: r.familyId,
          split: r.split,
          inputHash: r.inputHash,
          goldSha256: r.goldSha256,
          familySha256: r.familySha256,
        })),
      },
      currentInputReview: changed.length
        ? "PENDING_CHANGED_INPUT_OR_GOLD_REVIEW"
        : "MATCHES_REVIEWED_PROJECTION",
      changedDialectIds: changed.map((r) => r.dialectId),
      currentLineage: rejected
        ? "UNRESOLVED"
        : changed.length
          ? "PENDING_REVIEW"
          : "ACCEPTED",
      disagreements: rejected
        ? [
            family.split === "DRIFT"
              ? "B2_SHARED_MUTATION_TEMPLATE"
              : "B1_SHARED_NULL_SLOT_TEMPLATE",
          ]
        : [],
      resolutions: [
        "B3_REVIEWED_TRANSFORM_EQUIVALENTS_RECORDED",
        "N4_COMPETING_ROLES_NAMED",
      ],
    };
  });
  const changed = records.filter((r) => r.changedDialectIds.length);
  const exclusions = changed.map((record) => ({
    familyId: record.familyId,
    reason:
      "Input or canonical gold changed before any model run; old review does not approve the replacement.",
    originalSourceCommit: baseline.sourceCommit,
    replacedRecords: record.originalReview.originalRecords.filter((r) =>
      record.changedDialectIds.includes(r.dialectId),
    ),
    replacementInputHashes: record.changedDialectIds.map((dialectId) => ({
      dialectId,
      inputHash: inputs.find((i) => i.dialectId === dialectId)!.inputHash,
    })),
    originalBytes:
      "Retained at the immutable source commit and paths in the review baseline; not silently overwritten in history.",
  }));
  return {
    version: "mapping-study-review/1",
    status: "APPLIED_WITH_UNRESOLVED_FINDINGS",
    baselineSha256,
    reviewDocumentSha256: baseline.reviewDocumentSha256,
    sourceCommit: baseline.sourceCommit,
    records,
    exclusions,
    corrections: [
      {
        finding: "B3",
        status: "APPLIED",
        note: "Complete equivalent assignments are diagnostic; strict canonical gold is unchanged.",
      },
      {
        finding: "N1",
        status: "APPLIED",
        note: "Required removals carry REQUIRED_TARGET_ABSENT.",
      },
      {
        finding: "N2",
        status: "APPLIED_PENDING_REVIEW",
        note: "Used-corpus headers replaced; new provider bytes need review.",
      },
      {
        finding: "N3",
        status: "LABEL_LIMITATION_RECORDED",
        note: "HARD_RESOLVABLE is a construction stratum, not measured difficulty; glosses remain.",
      },
      {
        finding: "N4",
        status: "APPLIED",
        note: "Mapped alternatives name competing roles and supplied partner columns.",
      },
      {
        finding: "N5",
        status: "APPLIED_PENDING_REVIEW",
        note: "Actor padding explicitly states the requested output.",
      },
      {
        finding: "N6",
        status: "APPLIED_PENDING_REVIEW",
        note: "Removal event ID distinguishes the cancellation event from its order.",
      },
      {
        finding: "N7",
        status: "APPLIED_PENDING_REVIEW",
        note: "New names use seeded positions while unchanged names retain relative base order.",
      },
    ],
    sealReadiness: {
      status: "BLOCKED",
      liveRunnerEligible: false,
      acceptedUnchangedFamilies: records.filter(
        (r) => r.currentLineage === "ACCEPTED",
      ).length,
      independentFamilyCount: "NOT_ESTABLISHED",
      blockers: [
        {
          code: "B1_SHARED_NULL_SLOT_TEMPLATE",
          familyIds: records
            .filter((r) => r.originalReview.finding === "B1")
            .map((r) => r.familyId),
        },
        {
          code: "B2_SHARED_MUTATION_TEMPLATE",
          familyIds: records
            .filter((r) => r.originalReview.finding === "B2")
            .map((r) => r.familyId),
        },
        {
          code: "CHANGED_INPUT_OR_GOLD_REQUIRES_INDEPENDENT_REVIEW",
          familyIds: changed.map((r) => r.familyId),
        },
      ],
      note: "The existing design requires independent SELECT/AUDIT families. B1 redesign also needs reviewed coverage floors: two cell-specific SELECT families cannot satisfy the current five-family null-tag floor. No threshold is relaxed here. Audited pre-registration remains planned.",
    },
  };
}

export function requireCorpusSealReady(study: MappingStudy) {
  const report = corpusReview(study);
  if (report.sealReadiness.blockers.length)
    throw new Error(
      `Corpus sealing blocked: ${report.sealReadiness.blockers.map((b) => `${b.code} (${b.familyIds.length} families)`).join("; ")}`,
    );
  return report;
}
