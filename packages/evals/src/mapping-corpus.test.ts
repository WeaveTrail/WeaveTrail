import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateMappingStructure } from "@weavetrail/ai-harness/server";
import {
  replayApproved,
  validateReplayApprovals,
  applyApprovedMapping,
  approvedSourceMapping,
} from "@weavetrail/replay-engine";
import {
  ArtifactSchema,
  ProviderProjectionSchema,
  GoldRecordSchema,
  GoldArtifactSchema,
} from "./mapping-corpus-contract";
import {
  generateMappingStudy,
  goldFields,
  goldProposal,
  mappingInput,
  sha256,
} from "./mapping-corpus-generator";
import {
  overlapReport,
  preflight,
  previousFiles,
  priorMaterial,
} from "./mapping-corpus-preflight";
import {
  corpusDirectory,
  verifyMappingStudy,
} from "./mapping-corpus-artifacts";
import { CorpusSchema } from "./mapping-scorer";

const study = generateMappingStudy();
const drift = study.splits.find((s) => s.input.split === "DRIFT")!;
const base = drift.input.inputs[0]!;
const gold = drift.gold.records[0]!;
const output = () => ({
  kind: "fields" as const,
  value: { fields: goldFields(gold) },
});

describe("unsealed mapping study inputs", () => {
  it("detects exact projected input reuse from historical material", () => {
    const prior = priorMaterial()[0]!.corpus.dialects[0]!;
    const duplicate = structuredClone(study);
    const input = duplicate.splits[0]!.input.inputs[0]!;
    input.projection = {
      columns: prior.input.columns.map((c, i) => ({
        columnId: `c${String(i + 1).padStart(2, "0")}`,
        name: c.name,
      })),
      sampleRows: Array.from(
        {
          length: Math.min(
            8,
            Math.max(...prior.input.columns.map((c) => c.samples.length)),
          ),
        },
        (_, row) => prior.input.columns.map((c) => c.samples[row]!),
      ),
    };
    input.inputHash = sha256(JSON.stringify(input.projection));
    expect(overlapReport(duplicate).crossFamilyExactInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signature: input.inputHash,
          members: expect.arrayContaining([
            duplicate.splits[0]!.gold.records[0]!.familyId,
          ]),
        }),
      ]),
    );
  });
  it("reproduces every committed draft byte twice, with shared-validator witnesses and allocation checks", async () => {
    const files = await verifyMappingStudy();
    expect(files["manifest.json"]).toContain('"liveRunnerEligible": false');
    const preflightArtifact = JSON.parse(files["preflight.json"]!);
    const manifest = JSON.parse(files["manifest.json"]!);
    const ledger = JSON.parse(files["review-ledger.json"]!);
    expect(preflightArtifact.independentGoldReview).toBe(ledger.status);
    expect(manifest.independentGoldReview).toBe(ledger.status);
    expect(preflightArtifact.replacementGoldReview).toEqual({
      status: "PENDING_INDEPENDENT_REVIEW",
      familyIds: study.families
        .filter((family) =>
          ledger.records.some(
            (record: { familyId: string; changedDialectIds: string[] }) =>
              record.familyId === family.id && record.changedDialectIds.length,
          ),
        )
        .map((family) => family.id),
    });
    expect(study.families).toHaveLength(96);
    expect(
      study.splits.map((s) => [s.input.split, s.input.inputs.length]),
    ).toEqual([
      ["SELECT", 24],
      ["AUDIT", 60],
      ["DRIFT", 84],
    ]);
    expect(study.relations).toHaveLength(72);
  });

  it.each(["obsolete.json", "retired/obsolete.json"])(
    "rejects unexpected corpus artifact %s without changing the fixture",
    async (name) => {
      const directory = mkdtempSync(
        join(tmpdir(), "weavetrail-corpus-inventory-"),
      );
      try {
        cpSync(corpusDirectory, directory, { recursive: true });
        const path = join(directory, name);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, '{"obsolete":true}\n');
        await expect(verifyMappingStudy(directory)).rejects.toThrow(
          `unexpected corpus artifact: ${name}`,
        );
        expect(readFileSync(path, "utf8")).toBe('{"obsolete":true}\n');
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it.each([
    "BYTES_CHANGED",
    "WRONG_MANIFEST",
    "INVALID_SHAPE",
    "MISSING_RECEIPT",
  ] as const)("rejects invalid captured receipt: %s", async (kind) => {
    const directory = mkdtempSync(join(tmpdir(), "weavetrail-corpus-receipt-"));
    try {
      cpSync(corpusDirectory, directory, { recursive: true });
      const path = join(directory, "generation-receipt.json");
      const receipt = JSON.parse(readFileSync(path, "utf8"));
      if (kind === "MISSING_RECEIPT") rmSync(path);
      else {
        if (kind === "WRONG_MANIFEST") receipt.manifestSha256 = "0".repeat(64);
        else if (kind === "INVALID_SHAPE")
          receipt.executedAt = "not a timestamp";
        else receipt.executedAt = "2037-01-02T00:00:00Z";
        const bytes = JSON.stringify(receipt);
        writeFileSync(path, bytes);
        // Independently exercising schema/binding requires a valid byte checksum.
        if (kind !== "BYTES_CHANGED")
          writeFileSync(
            join(directory, "generation-receipt.sha256"),
            `${sha256(bytes)}  generation-receipt.json\n`,
          );
      }
      await expect(verifyMappingStudy(directory)).rejects.toThrow(
        kind === "WRONG_MANIFEST"
          ? "generation receipt manifest binding mismatch"
          : kind === "BYTES_CHANGED"
            ? "generation receipt checksum mismatch"
            : kind === "MISSING_RECEIPT"
              ? "ENOENT"
              : "Invalid ISO datetime",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("validates a recaptured receipt without requiring volatile metadata to regenerate identically", async () => {
    const directory = mkdtempSync(
      join(tmpdir(), "weavetrail-corpus-recapture-"),
    );
    try {
      cpSync(corpusDirectory, directory, { recursive: true });
      const path = join(directory, "generation-receipt.json");
      const receipt = JSON.parse(readFileSync(path, "utf8"));
      receipt.executedAt = "2037-01-02T00:00:00Z";
      const bytes = JSON.stringify(receipt);
      writeFileSync(path, bytes);
      writeFileSync(
        join(directory, "generation-receipt.sha256"),
        `${sha256(bytes)}  generation-receipt.json\n`,
      );
      await verifyMappingStudy(directory);
      expect(readFileSync(path, "utf8")).toBe(bytes);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails on lost coverage, duplicate identities and changed input/gold bindings", () => {
    const missingFamily = structuredClone(study);
    missingFamily.families.pop();
    expect(() => preflight(missingFamily)).toThrow("96 unique");
    const duplicate = structuredClone(study);
    duplicate.splits[0]!.input.inputs[1]!.dialectId =
      duplicate.splits[0]!.input.inputs[0]!.dialectId;
    expect(() => preflight(duplicate)).toThrow("unique scenario");
    const corrupt = structuredClone(study);
    corrupt.splits[0]!.input.inputs[0]!.projection.sampleRows[0]![0] =
      "changed bytes";
    expect(() => preflight(corrupt)).toThrow("input hash");
    const badGold = structuredClone(study);
    badGold.splits[0]!.gold.records[0]!.columns.pop();
    expect(() => preflight(badGold)).toThrow("ordered gold coverage");
    const lostTag = structuredClone(study);
    lostTag.families
      .filter((f) => f.split === "SELECT")
      .forEach((f) =>
        f.columns.forEach((c) => {
          if (c.tag === "ABBREVIATED") c.tag = "CLEAR";
        }),
      );
    expect(() => preflight(lostTag)).toThrow("ABBREVIATED");
  });

  it("projects only bounded headers and samples; strict contracts reject leaked gold/labels", () => {
    for (const split of study.splits)
      for (const input of split.input.inputs) {
        expect(Object.keys(input.projection)).toEqual([
          "columns",
          "sampleRows",
        ]);
        expect(input.projection.sampleRows).toHaveLength(2);
        expect(
          ProviderProjectionSchema.safeParse({ ...input.projection, gold: [] })
            .success,
        ).toBe(false);
        expect(
          ProviderProjectionSchema.safeParse({
            ...input.projection,
            familyId: "f-001",
          }).success,
        ).toBe(false);
        expect(
          ProviderProjectionSchema.safeParse({
            ...input.projection,
            sampleRows: Array.from(
              { length: 9 },
              () => input.projection.sampleRows[0],
            ),
          }).success,
        ).toBe(false);
        expect(
          new Set(input.projection.columns.map((c) => c.columnId)).size,
        ).toBe(input.projection.columns.length);
      }
    for (const target of [
      "sourceEventId",
      "eventTime",
      "instrumentId",
      "eventType",
    ]) {
      const positions = study.splits[0]!.gold.records.map((g) =>
        g.columns.findIndex((c) => c.targetField === target),
      );
      expect(new Set(positions).size).toBeGreaterThan(2);
    }
  });

  it("records complete reviewed transform equivalents without relaxing canonical tuples", () => {
    for (const split of study.splits)
      for (const gold of split.gold.records) {
        const input = split.input.inputs.find(
          (i) => i.dialectId === gold.dialectId,
        )!;
        expect(GoldRecordSchema.safeParse(gold).success).toBe(true);
        const rows = input.projection.sampleRows.map((row, i) => ({
          coordinate: {
            sourceArtifactHash: input.inputHash,
            rowNumber: String(i + 1),
          },
          values: Object.fromEntries(
            input.projection.columns.map((c, index) => [c.name, row[index]!]),
          ),
        }));
        const canonicalApplication =
          gold.expectedDisposition === "PROPOSAL_OFFERABLE"
            ? applyApprovedMapping(
                rows,
                approvedSourceMapping(goldProposal(input, gold)),
              )
            : undefined;
        const canonical = gold.columns.map((c) => [
          c.columnId,
          c.targetField,
          c.transform,
          c.status,
        ]);
        for (const assignment of gold.acceptedAlternativeAssignments) {
          expect(assignment).toHaveLength(gold.columns.length);
          expect(assignment.map((c) => [c[0], c[1], c[3]])).toEqual(
            gold.columns.map((c) => [c.columnId, c.targetField, c.status]),
          );
          expect(assignment).not.toEqual(canonical);
          const columns = assignment.map((tuple, i) => ({
            ...gold.columns[i]!,
            transform: tuple[2],
          }));
          expect(
            validateMappingStructure(
              {
                kind: "fields",
                value: { fields: goldFields({ ...gold, columns }) },
              },
              mappingInput(input),
            ).status,
          ).toBe(
            gold.expectedValidator === "VALID" ? "VALID" : "REVIEW_REQUIRED",
          );
          if (canonicalApplication)
            expect(
              applyApprovedMapping(
                rows,
                approvedSourceMapping(
                  goldProposal(input, { ...gold, columns }),
                ),
              ),
            ).toEqual(canonicalApplication);
          for (const [i, column] of columns.entries())
            if (
              [
                "actorId",
                "orderId",
                "instrumentId",
                "sourceEventId",
                "price",
                "quantity",
              ].includes(column.targetField ?? "")
            )
              expect(column.transform).toBe(gold.columns[i]!.transform);
        }
      }
    const lowerSide = study.splits
      .flatMap((s) => s.gold.records)
      .find((g) => g.dialectId === "d-047")!;
    expect(
      lowerSide.acceptedAlternativeAssignments.some((a) =>
        a.some((c) => c[1] === "side" && c[2] === "UPPERCASE"),
      ),
    ).toBe(true);
  });

  it("rejects incomplete, rebound and duplicate diagnostic alternatives", () => {
    const original = study.splits[0]!.gold.records[0]!;
    for (const change of ["DROP", "TARGET", "DUPLICATE"] as const) {
      const altered = structuredClone(original);
      const assignment = altered.acceptedAlternativeAssignments[0]!;
      if (change === "DROP") assignment.pop();
      else if (change === "TARGET") assignment[0]![1] = "actorId";
      else
        altered.acceptedAlternativeAssignments.push(
          structuredClone(assignment),
        );
      expect(GoldRecordSchema.safeParse(altered).success).toBe(false);
    }
  });

  it.each(["UPPERCASE", "EPOCH_MS_TO_ISO"] as const)(
    "rejects unreviewed event-time alternative %s in both the artifact contract and preflight",
    (transform) => {
      const changed = structuredClone(study);
      const split = changed.splits[0]!;
      const gold = split.gold.records[0]!;
      const clock = gold.columns.findIndex(
        (c) => c.targetField === "eventTime",
      );
      const assignment = gold.columns.map(
        (c) =>
          [c.columnId, c.targetField, c.transform, c.status] as [
            string,
            typeof c.targetField,
            typeof c.transform,
            typeof c.status,
          ],
      );
      assignment[clock]![2] = transform;
      gold.acceptedAlternativeAssignments = [assignment];
      expect(GoldArtifactSchema.safeParse(split.gold).success).toBe(false);
      expect(() => preflight(changed)).toThrow();
    },
  );

  it.each(["instrumentId", "quantity"] as const)(
    "rejects a structurally compatible but unreviewed %s normalization",
    (target) => {
      const changed = structuredClone(study);
      const split = changed.splits[0]!;
      const gold = split.gold.records[0]!;
      const field = gold.columns.findIndex((c) => c.targetField === target);
      const assignment = gold.columns.map(
        (c) =>
          [c.columnId, c.targetField, c.transform, c.status] as [
            string,
            typeof c.targetField,
            typeof c.transform,
            typeof c.status,
          ],
      );
      assignment[field]![2] = target === "quantity" ? "IDENTITY" : "UPPERCASE";
      gold.acceptedAlternativeAssignments = [assignment];
      expect(GoldArtifactSchema.safeParse(split.gold).success).toBe(false);
      expect(() => preflight(changed)).toThrow(
        "no independently reviewed equivalence",
      );
    },
  );

  it("does not extrapolate a reviewed lowercase side equivalence to single-letter codes", () => {
    const changed = structuredClone(study);
    const split = changed.splits.find((s) =>
      s.gold.records.some((g) => g.dialectId === "d-047"),
    )!;
    const gold = split.gold.records.find((g) => g.dialectId === "d-047")!;
    const input = split.input.inputs.find(
      (i) => i.dialectId === gold.dialectId,
    )!;
    const side = gold.columns.findIndex((c) => c.targetField === "side");
    input.projection.sampleRows[0]![side] = "B";
    input.projection.sampleRows[1]![side] = "S";
    input.inputHash = sha256(JSON.stringify(input.projection));
    gold.inputHash = input.inputHash;
    expect(() => preflight(changed)).toThrow("shared-validator witness");
  });

  it("checks equivalence domains even when a missing required target prevents a full dry run", () => {
    const changed = structuredClone(study);
    const split = changed.splits.find((s) => s.input.split === "DRIFT")!;
    const gold = split.gold.records.find((g) => g.dialectId === "d-089.3")!;
    const input = split.input.inputs.find(
      (i) => i.dialectId === gold.dialectId,
    )!;
    const side = gold.columns.findIndex((c) => c.targetField === "side");
    expect(gold.expectedValidator).toBe("MISSING_REQUIRED_TARGET");
    input.projection.sampleRows[0]![side] = "buy";
    input.projection.sampleRows[1]![side] = "sell";
    input.inputHash = sha256(JSON.stringify(input.projection));
    gold.inputHash = input.inputHash;
    expect(() => preflight(changed)).toThrow("alternative side domain witness");
  });

  it("labels required target absence before complete visible assignments", () => {
    const removed = study.relations.filter(
      (r) => r.change === "REMOVE" && r.allocation.remove === "REQUIRED",
    );
    expect(removed).toHaveLength(6);
    for (const relation of removed)
      expect(
        drift.gold.records.find((g) => g.dialectId === relation.dialectId),
      ).toMatchObject({
        reasonCategory: "REQUIRED_TARGET_ABSENT",
        expectedValidator: "MISSING_REQUIRED_TARGET",
        expectedDisposition: "REVIEW_REQUIRED",
      });
  });

  it("keeps review inputs structurally valid and resolvable inputs free of any-review decoys", () => {
    for (const split of study.splits.filter((s) => s.input.split !== "DRIFT"))
      for (const g of split.gold.records) {
        const f = study.families.find((f) => f.id === g.familyId)!;
        expect(g.expectedValidator).toBe("VALID");
        expect(g.absentRequiredTargets).toEqual([]);
        expect(g.columns.some((c) => c.status === "REVIEW_REQUIRED")).toBe(
          f.stratum === "MUST_REVIEW",
        );
        for (const c of g.columns.filter((c) => c.tag === "AMBIGUOUS"))
          expect(
            c.alternatives.filter((a) => a.ruledOutBy === null).length,
          ).toBeGreaterThanOrEqual(2);
      }
  });

  it("preserves supported/unsupported representation witnesses and hidden semantics without changing observable gold", () => {
    const representations = study.relations.filter(
      (r) => r.change === "REPRESENTATION",
    );
    expect(
      representations.filter(
        (r) => r.allocation.representation === "SUPPORTED",
      ),
    ).toHaveLength(6);
    expect(
      representations.filter(
        (r) => r.allocation.representation === "UNSUPPORTED",
      ),
    ).toHaveLength(6);
    for (const r of study.relations.filter(
      (r) => r.change === "SAME_SHAPE_SEMANTICS",
    )) {
      const before = drift.gold.records.find(
        (g) => g.dialectId === r.baseDialectId,
      )!;
      const after = drift.gold.records.find(
        (g) => g.dialectId === r.dialectId,
      )!;
      if (r.allocation.semantics === "UNOBSERVABLE") {
        expect(before.columns).toEqual(after.columns);
        expect(r.inputHash).toBe(r.baseInputHash);
        expect(r.scenarioTruth).toMatchObject({
          changed: true,
          visibility: "HIDDEN",
          beforeTarget: "actorId",
          afterTarget: "counterpartyId",
        });
      } else {
        expect(
          after.columns.find((c) => c.targetField === "counterpartyId"),
        ).toBeDefined();
        expect(
          before.columns.find((c) => c.targetField === "actorId"),
        ).toBeDefined();
        expect(
          validateMappingStructure(
            { kind: "fields", value: { fields: goldFields(before) } },
            mappingInput(
              drift.input.inputs.find((d) => d.dialectId === r.dialectId)!,
            ),
          ).status,
        ).toBe("VALID");
      }
    }
  });

  it("classifies a competing required addition globally even when the old column stays locally unchanged", () => {
    for (const r of study.relations.filter(
      (r) => r.change === "ADD" && r.allocation.add === "COMPETING_REQUIRED",
    )) {
      const g = drift.gold.records.find((g) => g.dialectId === r.dialectId)!;
      expect(g.columns.filter((c) => c.tag === "AMBIGUOUS")).toHaveLength(2);
      expect(g.expectedValidator).toBe("MISSING_REQUIRED_TARGET");
      expect(r.observable.filter((o) => o.label === "ADDED")).toHaveLength(1);
      expect(r.observable.filter((o) => o.label === "UNCHANGED")).toHaveLength(
        7,
      );
    }
  });

  it("separately pins required absence, duplicate targets, invented columns, unknown transforms, dry-run failures and order-only invariants", () => {
    const rejected = (
      alter: (fields: ReturnType<typeof goldFields>) => void,
      reason: string,
    ) => {
      const o = output();
      alter(o.value.fields);
      expect(
        validateMappingStructure(o, mappingInput(base)).reasons[0]?.code,
      ).toBe(reason);
    };
    rejected((fields) => {
      const f = fields.find((f) => f.targetField === "sourceEventId")!;
      f.targetField = null;
      f.transform = null;
      f.status = "REVIEW_REQUIRED";
    }, "MISSING_REQUIRED_TARGET");
    rejected((fields) => {
      const f = fields.find((f) => f.targetField === "actorId")!;
      f.targetField = "sourceEventId";
    }, "DUPLICATE_TARGET");
    rejected((fields) => {
      fields[0]!.sourceColumn = "invented source";
    }, "INVENTED_COLUMN");
    rejected((fields) => {
      fields[0]!.transform = "UNREGISTERED" as never;
    }, "UNKNOWN_TRANSFORM");
    const badSamples = structuredClone(base);
    const clockIndex = gold.columns.findIndex(
      (c) => c.targetField === "eventTime",
    );
    badSamples.projection.sampleRows[0]![clockIndex] = "not an ISO time";
    expect(
      validateMappingStructure(output(), mappingInput(badSamples)).reasons[0]
        ?.code,
    ).toBe("TRANSFORM_FAILED");
    const shuffled = mappingInput(base),
      fields = goldFields(gold);
    shuffled.columns.reverse();
    fields.reverse();
    expect(
      validateMappingStructure({ kind: "fields", value: { fields } }, shuffled)
        .status,
    ).toBe("VALID");
    expect(
      validateMappingStructure(
        { kind: "fields", value: { fields: goldFields(gold).reverse() } },
        mappingInput(base),
      ).reasons[0]?.code,
    ).toBe("REORDERED_COLUMN");
  });

  it("rejects omitted and stale approval records; a wrong-base fixture can remain structurally valid", () => {
    const fixture = study.baseApprovals[0]!;
    const rename = drift.input.inputs.find(
      (d) => d.dialectId === `${base.dialectId}.2`,
    )!;
    const renamedGold = drift.gold.records.find(
      (g) => g.dialectId === rename.dialectId,
    )!;
    const checked = validateReplayApprovals(
      goldProposal(rename, renamedGold),
      fixture.approval,
      undefined,
    );
    expect(checked).toMatchObject({
      accepted: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "APPROVED_ARTIFACT_HASH_MISMATCH" }),
      ]),
    });
    const rows = mappingInput(base).sampleRows.map((values, i) => ({
      coordinate: {
        sourceArtifactHash: base.inputHash,
        rowNumber: String(i + 1),
      },
      values: values as Record<string, string>,
    }));
    expect(
      replayApproved(rows, rows, fixture.proposal, undefined, undefined),
    ).toMatchObject({
      status: "REVIEW_REQUIRED",
      issues: [expect.objectContaining({ code: "APPROVAL_RECORD_REQUIRED" })],
    });
    const wrong = goldFields(gold);
    const party = wrong.find((f) => f.targetField === "actorId")!;
    party.targetField = "counterpartyId";
    expect(
      validateMappingStructure(
        { kind: "fields", value: { fields: wrong } },
        mappingInput(base),
      ).status,
    ).toBe("VALID");
    expect(wrong).not.toEqual(goldFields(gold)); // Acceptance cannot prove semantic correctness.
  });

  it("records overlap warnings and pending review honestly, excludes unused v4 input and is rejected by historical runner contracts", () => {
    expect(previousFiles).not.toContain("schema-dialects-v4/HELD_OUT.json");
    const overlap = JSON.parse(
      readFileSync(new URL("overlap-report.json", corpusDirectory), "utf8"),
    );
    expect(overlap.semanticSlotStructure.length).toBeGreaterThan(0);
    expect(overlap.namingGrammar.length).toBeGreaterThan(0);
    expect(overlap.decodedAttackText).toEqual([]);
    expect(overlap.crossFamilyExactInputs).toEqual([]);
    expect(study.families.every((f) => f.review.status === "PENDING")).toBe(
      true,
    );
    for (const s of study.splits) {
      expect(ArtifactSchema.safeParse(s.input).success).toBe(true);
      expect(CorpusSchema.safeParse(s.input).success).toBe(false);
    }
  });
});
