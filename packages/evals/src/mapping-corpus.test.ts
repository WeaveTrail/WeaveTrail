import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateMappingStructure } from "@weavetrail/ai-harness/server";
import {
  replayApproved,
  validateReplayApprovals,
} from "@weavetrail/replay-engine";
import {
  ArtifactSchema,
  ProviderProjectionSchema,
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
