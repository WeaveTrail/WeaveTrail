import { readFileSync } from "node:fs";
import { corpusReview } from "./mapping-corpus-review";
import {
  validateMappingOutput,
  validateMappingStructure,
} from "@weavetrail/ai-harness/server";
import {
  validateReplayApprovals,
  applyApprovedMapping,
  approvedSourceMapping,
} from "@weavetrail/replay-engine";
import {
  cells,
  CORPUS_VERSION,
  GENERATION_SEED,
  GENERATOR_VERSION,
  GoldRecordSchema,
  tags,
} from "./mapping-corpus-contract";
import {
  decodeAttack,
  goldFields,
  goldProposal,
  mappingInput,
  sha256,
  type MappingStudy,
} from "./mapping-corpus-generator";

export function requireInvariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(`Mapping corpus preflight: ${message}`);
}
export const previousFiles = [
  "schema-dialects-v1/DEV.json",
  "schema-dialects-v1/HELD_OUT.json",
  "schema-dialects-v2/DEV.json",
  "schema-dialects-v2/HELD_OUT.json",
  "schema-dialects-v3/HELD_OUT.json",
  "schema-dialects-v4/DEV.json",
] as const;
type PriorCorpus = {
  dialects: {
    id: string;
    namingFamily: string;
    input: { columns: { name: string; samples: string[] }[] };
    gold: {
      injection?: {
        payload: string;
        encoding: "PLAIN" | "BASE64" | "ZERO_WIDTH";
      };
    }[];
  }[];
};
export function priorMaterial() {
  // Explicit allowlist: v4 HELD_OUT remains unused and is never opened here.
  return previousFiles.map((file) => {
    const bytes = readFileSync(
      new URL(`../fixtures/${file}`, import.meta.url),
      "utf8",
    );
    return {
      file,
      hash: sha256(bytes),
      corpus: JSON.parse(bytes) as PriorCorpus,
    };
  });
}
const normalized = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\u200b/gu, "")
    .replace(/[\p{P}\p{Z}\s_]+/gu, " ")
    .trim();
const headerName = (s: string) => normalized(s.split(" | ")[0]!);
function groups(entries: { id: string; key: string }[]) {
  const grouped = new Map<string, string[]>();
  for (const { id, key } of entries)
    grouped.set(key, [...(grouped.get(key) ?? []), id]);
  return [...grouped]
    .filter(([, ids]) => new Set(ids).size > 1)
    .map(([signature, ids]) => ({ signature, members: [...new Set(ids)] }));
}

export function overlapReport(study: MappingStudy) {
  const prior = priorMaterial();
  const baseIds = new Set(study.families.map((f) => f.dialectId));
  const current = study.splits.flatMap((s) =>
    s.input.inputs.map((input) => ({
      input,
      gold: s.gold.records.find((g) => g.dialectId === input.dialectId)!,
    })),
  );
  const bases = current.filter((d) => baseIds.has(d.input.dialectId));
  const headerEntries = bases.flatMap((d) =>
    d.input.projection.columns.map((c) => ({
      id: d.gold.familyId,
      key: headerName(c.name),
    })),
  );
  const priorHeaderEntries = prior.flatMap((p) =>
    p.corpus.dialects.flatMap((d) =>
      d.input.columns.map((c) => ({
        id: `${p.file}:${d.id}`,
        key: headerName(c.name),
      })),
    ),
  );
  const priorTuples = prior.flatMap((p) =>
    p.corpus.dialects.map((d) => ({
      id: `${p.file}:${d.id}`,
      key: d.input.columns
        .map((c) => headerName(c.name))
        .sort()
        .join("\0"),
    })),
  );
  const priorAttacks = prior.flatMap((p) =>
    p.corpus.dialects.flatMap((d) =>
      d.gold.flatMap((g) =>
        g.injection
          ? [
              {
                id: `${p.file}:${d.id}`,
                key: normalized(
                  decodeAttack(g.injection.payload, g.injection.encoding),
                ),
              },
            ]
          : [],
      ),
    ),
  );
  const newAttacks = bases.flatMap((d) =>
    d.gold.columns.flatMap((g) =>
      g.attack
        ? [
            {
              id: d.gold.familyId,
              key: normalized(
                decodeAttack(g.attack.payload, g.attack.encoding),
              ),
            },
          ]
        : [],
    ),
  );
  const newIds = new Set(study.families.map((f) => f.id));
  const mixedGroups = (entries: { id: string; key: string }[]) =>
    groups(entries).filter((g) => g.members.some((id) => newIds.has(id)));
  const priorInputHashes = prior.flatMap((p) =>
    p.corpus.dialects.map((d) => ({
      id: `${p.file}:${d.id}`,
      key: sha256(
        JSON.stringify({
          columns: d.input.columns.map((c, i) => ({
            columnId: `c${String(i + 1).padStart(2, "0")}`,
            name: c.name,
          })),
          sampleRows: Array.from(
            {
              length: Math.min(
                8,
                Math.max(...d.input.columns.map((c) => c.samples.length)),
              ),
            },
            (_, row) => d.input.columns.map((c) => c.samples[row]),
          ),
        }),
      ),
    })),
  );
  const hashes = mixedGroups([
    ...current.map((d) => ({ id: d.gold.familyId, key: d.input.inputHash })),
    ...priorInputHashes,
  ]);
  return {
    version: "mapping-study-overlap/1",
    status: "AUTHOR_DIAGNOSTICS_NOT_INDEPENDENCE_CERTIFICATION",
    comparedPriorBytes: prior.map((p) => ({ path: p.file, sha256: p.hash })),
    comparedPriorInputHashes: priorInputHashes,
    excluded: ["schema-dialects-v4/HELD_OUT.json (unused)"],
    crossFamilyExactInputs: hashes,
    normalizedHeaderTuples: mixedGroups([
      ...bases.map((d) => ({
        id: d.gold.familyId,
        key: d.input.projection.columns
          .map((c) => headerName(c.name))
          .sort()
          .join("\0"),
      })),
      ...priorTuples,
    ]),
    sharedNormalizedHeaders: mixedGroups([
      ...headerEntries,
      ...priorHeaderEntries,
    ]),
    decodedAttackText: mixedGroups([...newAttacks, ...priorAttacks]),
    lineage: groups(
      study.families.map((f) => ({ id: f.id, key: f.lineageId })),
    ),
    semanticSlotStructure: groups(
      bases.map((d) => ({
        id: d.gold.familyId,
        key: d.gold.columns
          .map((c) => `${c.targetField}/${c.transform}/${c.tag}`)
          .sort()
          .join(" | "),
      })),
    ),
    namingGrammar: groups(
      study.families.map((f) => ({
        id: f.id,
        key: f.columns
          .map((c) =>
            /[가-힣]/u.test(c.name)
              ? "korean"
              : c.name.includes("(")
                ? "words-with-qualified-domain"
                : "qualified-words",
          )
          .sort()
          .join(" | "),
      })),
    ),
    authoredProblems: study.families.map((f) => ({
      familyId: f.id,
      problem: f.problem,
      parentTemplates: f.parents,
      review: "PENDING",
    })),
    withinFamilyEqualInputExemptions: study.relations
      .filter((r) => r.baseInputHash === r.inputHash)
      .map((r) => ({
        familyId: r.familyId,
        base: r.baseDialectId,
        followup: r.dialectId,
        reason: r.change,
      })),
    reviewRequirement:
      "Review shared slot/grammar signatures, semantic evidence relationships and lineage manually; redesign or revise independent count before sealing. Distinct strings and hashes alone do not prove independence or lack of training exposure.",
  };
}

export function preflight(study: MappingStudy) {
  const familyIds = study.families.map((f) => f.id);
  requireInvariant(
    familyIds.length === 96 && new Set(familyIds).size === 96,
    "96 unique proposed families required",
  );
  const dialects = study.splits.flatMap((s) => s.input.inputs);
  requireInvariant(
    new Set(dialects.map((d) => d.dialectId)).size === 168,
    "168 unique scenario IDs required",
  );
  const inventory = study.splits.map((split) => {
    const families = study.families.filter(
      (f) => f.split === split.input.split,
    );
    const expected =
      split.input.split === "SELECT"
        ? 24
        : split.input.split === "AUDIT"
          ? 60
          : 12;
    requireInvariant(
      families.length === expected,
      `${split.input.split} family count`,
    );
    const tagCounts = Object.fromEntries(
      tags.map((tag) => [
        tag,
        {
          families: families.filter((f) => f.columns.some((c) => c.tag === tag))
            .length,
          columns: families
            .flatMap((f) => f.columns)
            .filter((c) => c.tag === tag).length,
        },
      ]),
    );
    const attacks = families.flatMap((f) =>
      f.columns.flatMap((c) =>
        c.attack ? [{ family: f.id, ...c.attack }] : [],
      ),
    );
    const attackCounts = Object.fromEntries(
      (
        ["EN", "KO", "PLAIN", "BASE64", "ZERO_WIDTH", "HEADER", "CELL"] as const
      ).map((label) => [
        label,
        {
          families: new Set(
            attacks
              .filter((a) =>
                [a.language, a.encoding, a.placement].includes(label),
              )
              .map((a) => a.family),
          ).size,
          columns: attacks.filter((a) =>
            [a.language, a.encoding, a.placement].includes(label),
          ).length,
        },
      ]),
    );
    if (split.input.split !== "DRIFT") {
      for (const cell of cells.filter((c) => c !== "D_BASE"))
        requireInvariant(
          families.filter((f) => f.cell === cell).length === expected / 12,
          `${split.input.split}/${cell} allocation`,
        );
      for (const tag of tags)
        requireInvariant(
          tagCounts[tag]!.families >= 5,
          `${split.input.split}/${tag} five-family coverage`,
        );
      for (const [label, count] of Object.entries(attackCounts))
        requireInvariant(
          count.families >= 2,
          `${split.input.split}/${label} two-family attack coverage`,
        );
      for (const kind of ["TRADE", "ORDER_NEW", "ORDER_CANCEL"])
        requireInvariant(
          families.filter((f) => f.eventKinds.includes(kind as FamilyKind))
            .length >= 2,
          `${split.input.split}/${kind} coverage`,
        );
    }
    const validatorCounts = {
      VALID: 0,
      MISSING_REQUIRED_TARGET: 0,
      TRANSFORM_FAILED: 0,
    };
    for (const input of split.input.inputs) {
      const gold = split.gold.records.find(
        (g) => g.dialectId === input.dialectId,
      );
      requireInvariant(
        gold && gold.inputHash === input.inputHash,
        `${input.dialectId} input/gold binding`,
      );
      requireInvariant(
        sha256(JSON.stringify(input.projection)) === input.inputHash,
        `${input.dialectId} input hash`,
      );
      requireInvariant(
        gold.columns.length === input.projection.columns.length &&
          gold.columns.every(
            (g, i) =>
              g.sourceColumn === input.projection.columns[i]!.name &&
              g.columnId === input.projection.columns[i]!.columnId,
          ),
        `${input.dialectId} ordered gold coverage`,
      );
      GoldRecordSchema.parse(gold);
      const output = {
        kind: "fields" as const,
        value: { fields: goldFields(gold) },
      };
      const result = validateMappingStructure(output, mappingInput(input));
      const outcome =
        result.status === "VALID" ? "VALID" : result.reasons[0].code;
      requireInvariant(
        outcome === gold.expectedValidator,
        `${input.dialectId} expected ${gold.expectedValidator}, received ${outcome}`,
      );
      const rows = input.projection.sampleRows.map((row, i) => ({
        coordinate: {
          sourceArtifactHash: input.inputHash,
          rowNumber: String(i + 1),
        },
        values: Object.fromEntries(
          input.projection.columns.map((c, index) => [c.name, row[index]!]),
        ),
      }));
      const canonicalNormalized =
        gold.expectedDisposition === "PROPOSAL_OFFERABLE"
          ? JSON.stringify(
              applyApprovedMapping(
                rows,
                approvedSourceMapping(goldProposal(input, gold)),
              ),
            )
          : undefined;
      for (const [
        assignmentIndex,
        assignment,
      ] of gold.acceptedAlternativeAssignments.entries()) {
        const alternateGold = {
          ...gold,
          columns: assignment.map((tuple, i) => ({
            ...gold.columns[i]!,
            transform: tuple[2],
          })),
        };
        const alternateResult = validateMappingStructure(
          { kind: "fields", value: { fields: goldFields(alternateGold) } },
          mappingInput(input),
        );
        requireInvariant(
          (alternateResult.status === "VALID"
            ? "VALID"
            : alternateResult.reasons[0].code) === outcome,
          `${input.dialectId} alternative ${assignmentIndex} shared-validator witness`,
        );
        for (const [i, tuple] of assignment.entries()) {
          const canonical = gold.columns[i]!;
          if (tuple[2] === canonical.transform) continue;
          const values = input.projection.sampleRows.map((row) => row[i]!);
          if (canonical.targetField === "eventType")
            requireInvariant(
              values.every((v) =>
                ["TRADE", "ORDER_NEW", "ORDER_CANCEL"].includes(v),
              ),
              `${input.dialectId} alternative event-type domain witness`,
            );
          if (canonical.targetField === "side")
            requireInvariant(
              values.every((v) =>
                (canonical.transform === "BUY_SELL_CODE"
                  ? ["buy", "sell"]
                  : ["BUY", "SELL"]
                ).includes(v),
              ),
              `${input.dialectId} alternative side domain witness`,
            );
        }
        if (gold.expectedDisposition === "PROPOSAL_OFFERABLE") {
          requireInvariant(
            canonicalNormalized ===
              JSON.stringify(
                applyApprovedMapping(
                  rows,
                  approvedSourceMapping(goldProposal(input, alternateGold)),
                ),
              ),
            `${input.dialectId} alternative ${assignmentIndex} normalized-event equivalence`,
          );
        }
      }
      validatorCounts[gold.expectedValidator]++;
      const ready = validateMappingOutput(output, mappingInput(input));
      requireInvariant(
        (ready.status === "VALID") ===
          (gold.expectedDisposition === "PROPOSAL_OFFERABLE"),
        `${input.dialectId} disposition witness`,
      );
      for (const g of gold.columns) {
        requireInvariant(
          g.evidence.sampleCoordinates.every(
            ([row, id]) =>
              row < input.projection.sampleRows.length && id === g.columnId,
          ),
          `${input.dialectId} visible evidence coordinates`,
        );
        if (g.attack) {
          requireInvariant(
            decodeAttack(g.attack.payload, g.attack.encoding) ===
              g.attack.plainText,
            `${input.dialectId} attack decoding`,
          );
          requireInvariant(
            JSON.stringify(input.projection).includes(
              JSON.stringify(g.attack.payload).slice(1, -1),
            ),
            `${input.dialectId} attack inside projection`,
          );
        }
      }
    }
    return {
      split: split.input.split,
      families: families.length,
      inputs: split.input.inputs.length,
      inputColumnDecisions: split.gold.records.flatMap((g) => g.columns).length,
      tagCoverageScope:
        "AUTHORED_FAMILY_BRIEFS; DRIFT base coverage only, follow-up decisions remain in DRIFT.gold.json",
      strata: Object.fromEntries(
        ["RESOLVABLE", "HARD_RESOLVABLE", "MUST_REVIEW"].map((s) => [
          s,
          families.filter((f) => f.stratum === s).length,
        ]),
      ),
      tags: tagCounts,
      attacks: attackCounts,
      validatorCounts,
    };
  });
  for (const relation of study.relations) {
    const split = study.splits.find((s) => s.input.split === "DRIFT")!;
    const base = split.input.inputs.find(
      (d) => d.dialectId === relation.baseDialectId,
    )!;
    const followup = split.input.inputs.find(
      (d) => d.dialectId === relation.dialectId,
    )!;
    const baseGold = split.gold.records.find(
      (g) => g.dialectId === base.dialectId,
    )!;
    const fixture = study.baseApprovals.find(
      (a) => a.familyId === relation.familyId,
    )!;
    requireInvariant(
      relation.baseInputHash === base.inputHash &&
        relation.inputHash === followup.inputHash,
      `${relation.dialectId} parent-relative binding`,
    );
    if (
      relation.change === "SAME_SHAPE_SEMANTICS" ||
      relation.change === "IDENTICAL"
    ) {
      requireInvariant(
        JSON.stringify(base.projection.columns) ===
          JSON.stringify(followup.projection.columns),
        `${relation.dialectId} unchanged headers and positions`,
      );
      requireInvariant(
        validateMappingStructure(
          { kind: "fields", value: { fields: goldFields(baseGold) } },
          mappingInput(followup),
        ).status === "VALID",
        `${relation.dialectId} old dry-run shape remains valid`,
      );
      if (
        relation.scenarioTruth.visibility === "HIDDEN" ||
        relation.change === "IDENTICAL"
      ) {
        requireInvariant(
          base.inputHash === followup.inputHash,
          `${relation.dialectId} indistinguishable input`,
        );
        const followupGold = split.gold.records.find(
          (g) => g.dialectId === followup.dialectId,
        )!;
        requireInvariant(
          JSON.stringify(baseGold.columns) ===
            JSON.stringify(followupGold.columns),
          `${relation.dialectId} identical observable gold`,
        );
      }
    }
    if (relation.change === "REPRESENTATION")
      requireInvariant(
        validateMappingStructure(
          { kind: "fields", value: { fields: goldFields(baseGold) } },
          mappingInput(followup),
        ).reasons[0]?.code === "TRANSFORM_FAILED",
        `${relation.dialectId} prior transform fails on visible samples`,
      );
    if (base.inputHash !== followup.inputHash) {
      const followupGold = split.gold.records.find(
        (g) => g.dialectId === followup.dialectId,
      )!;
      const checked = validateReplayApprovals(
        goldProposal(followup, followupGold),
        fixture.approval,
        undefined,
      );
      requireInvariant(
        !checked.accepted &&
          checked.issues.some(
            (i) => i.code === "APPROVED_ARTIFACT_HASH_MISMATCH",
          ),
        `${relation.dialectId} stale base approval refuses new artifact`,
      );
    }
  }
  const overlap = overlapReport(study);
  requireInvariant(
    overlap.crossFamilyExactInputs.length === 0 &&
      overlap.normalizedHeaderTuples.length === 0 &&
      overlap.decodedAttackText.length === 0 &&
      overlap.lineage.length === 0,
    "no duplicate inputs/header tuples/decoded attacks/declared lineage across families or prior material",
  );
  const review = corpusReview(study);
  const replacementFamilyIds = review.records
    .filter((record) => record.changedDialectIds.length)
    .map((record) => record.familyId);
  return {
    version: "mapping-study-preflight/1",
    corpusVersion: CORPUS_VERSION,
    status: "PASS_AUTHOR_PREFLIGHT_UNSEALED",
    generatorVersion: GENERATOR_VERSION,
    seed: GENERATION_SEED,
    inventory,
    relations: study.relations.length,
    independentGoldReview: review.status,
    replacementGoldReview: {
      status: replacementFamilyIds.length
        ? "PENDING_INDEPENDENT_REVIEW"
        : "NOT_REQUIRED",
      familyIds: replacementFamilyIds,
    },
    independentFamilyCount: "NOT_ESTABLISHED",
    limitations: [
      "Automated witnesses verify consistency with authored gold, not independent correctness.",
      "Slot/grammar overlap requires independent semantic and lineage review before sealing.",
      "Opaque IDs and shuffled positions remove an authored fixed target slot, not every possible positional correlation.",
      "Reused/new-field assembly, wrong-base propagation and new-task approval for byte-identical input remain separate reuse implementation probes; generated base approvals are favorable synthetic fixtures.",
      "No models, routing, reuse performance, human time or statistical power were measured.",
    ],
  };
}
type FamilyKind = "TRADE" | "ORDER_NEW" | "ORDER_CANCEL";
