import { z } from "zod";
import type { MappingInput } from "@weavetrail/ai-harness";
import { validateMappingOutput } from "@weavetrail/ai-harness/validator";
import { mappingInput, goldFields, sha256 } from "./mapping-corpus-generator";
import {
  ArtifactSchema,
  GoldArtifactSchema,
  FamilyBriefSchema,
  DriftRelationSchema,
} from "./mapping-corpus-contract";
import {
  checkedStudyJson,
  type MappingStudyProtocol,
  type StudyBytes,
} from "./mapping-study-protocol";

const Status = z.enum(["UNSEALED", "SEALED"]);
const Inputs = ArtifactSchema.extend({ status: Status });
const Gold = GoldArtifactSchema.extend({ status: Status });
const Families = z
  .object({
    version: z.literal("mapping-study-inputs/1"),
    status: Status,
    records: z.array(FamilyBriefSchema).min(1),
  })
  .strict();
const DriftRelations = z
  .object({
    version: z.literal("mapping-study-inputs/1"),
    status: Status,
    records: z.array(DriftRelationSchema),
  })
  .strict();
export type StudySource = {
  inputs: StudyBytes;
  gold: StudyBytes;
  families: StudyBytes;
  driftRelations?: StudyBytes;
};
export function bindStudySource(
  protocol: MappingStudyProtocol,
  source: StudySource,
) {
  const inputs = Inputs.parse(checkedStudyJson(source.inputs));
  const gold = Gold.parse(checkedStudyJson(source.gold));
  const families = Families.parse(checkedStudyJson(source.families));
  const declared = protocol.sources.find((s) => s.split === inputs.split);
  if (
    !declared ||
    declared.inputsHash !== source.inputs.sha256 ||
    declared.goldHash !== source.gold.sha256 ||
    declared.familiesHash !== source.families.sha256 ||
    inputs.split !== gold.split ||
    [inputs.status, gold.status, families.status].some(
      (s) => s !== declared.seal.status,
    )
  )
    throw new Error("Undeclared study source binding");
  if (
    source.driftRelations?.sha256 !== declared.driftRelationsHash ||
    (source.driftRelations && inputs.split !== "DRIFT")
  )
    throw new Error("Undeclared study drift relation binding");
  const relations = source.driftRelations
    ? DriftRelations.parse(checkedStudyJson(source.driftRelations))
    : undefined;
  if (relations && relations.status !== declared.seal.status)
    throw new Error("Study drift relation status mismatch");
  const relationByDialect = new Map(
    relations?.records.map((r) => [r.dialectId, r]),
  );
  if (relationByDialect.size !== (relations?.records.length ?? 0))
    throw new Error("Duplicate study drift relation");
  for (const [label, ids] of [
    ["input", inputs.inputs.map((i) => i.dialectId)],
    ["gold", gold.records.map((g) => g.dialectId)],
    ["family", families.records.map((f) => f.id)],
  ] as const)
    if (new Set(ids).size !== ids.length)
      throw new Error(`Duplicate study ${label}`);
  if (inputs.inputs.length !== gold.records.length)
    throw new Error("Study input/gold coverage mismatch");
  if (!inputs.inputs.length) throw new Error("Study requires nonempty inputs");
  for (const relation of relationByDialect.values()) {
    const family = families.records.find((f) => f.id === relation.familyId);
    const base = inputs.inputs.find(
      (i) => i.dialectId === relation.baseDialectId,
    );
    const followup = inputs.inputs.find(
      (i) => i.dialectId === relation.dialectId,
    );
    const baseGold = gold.records.find(
      (g) => g.dialectId === relation.baseDialectId,
    );
    const followupGold = gold.records.find(
      (g) => g.dialectId === relation.dialectId,
    );
    if (
      !family ||
      !base ||
      !followup ||
      family.split !== "DRIFT" ||
      family.dialectId !== relation.baseDialectId ||
      relation.dialectId === relation.baseDialectId ||
      baseGold?.familyId !== family.id ||
      followupGold?.familyId !== family.id ||
      relation.baseInputHash !== base.inputHash ||
      relation.inputHash !== followup.inputHash
    )
      throw new Error("Study drift relation mismatch");
  }
  const dialects = inputs.inputs.map((input) => {
    const truth = gold.records.find((g) => g.dialectId === input.dialectId);
    const family = families.records.find((f) => f.id === truth?.familyId);
    if (
      !truth ||
      !family ||
      family.split !== inputs.split ||
      (family.dialectId !== input.dialectId &&
        (inputs.split !== "DRIFT" ||
          relationByDialect.get(input.dialectId)?.familyId !== family.id)) ||
      input.inputHash !== truth.inputHash ||
      input.inputHash !== sha256(JSON.stringify(input.projection))
    )
      throw new Error("Study family/input/gold mismatch");
    if (
      truth.columns.length !== input.projection.columns.length ||
      truth.columns.some(
        (g, i) =>
          g.columnId !== input.projection.columns[i]?.columnId ||
          g.sourceColumn !== input.projection.columns[i]?.name,
      )
    )
      throw new Error("Study gold column projection mismatch");
    const ready = validateMappingOutput(
      { kind: "fields", value: { fields: goldFields(truth) } },
      mappingInput(input),
    );
    if (
      (ready.status === "VALID") !==
      (truth.expectedDisposition === "PROPOSAL_OFFERABLE")
    )
      throw new Error("Study gold disposition mismatch");
    return { input, gold: truth, family };
  });
  const scopedFamilies = families.records.filter(
    (f) => f.split === inputs.split,
  );
  if (scopedFamilies.some((f) => !dialects.some((d) => d.family.id === f.id)))
    throw new Error("Missing study family");
  if (
    inputs.split === "AUDIT" &&
    protocol.liveSampleDialectIds.some(
      (id) => !dialects.some((d) => d.input.dialectId === id),
    )
  )
    throw new Error("Unknown study live sample dialect");
  return {
    split: inputs.split,
    status: inputs.status,
    hash: source.inputs.sha256,
    dialects,
  };
}
export type BoundStudySource = ReturnType<typeof bindStudySource>;
export type StudyDialect = BoundStudySource["dialects"][number];
/** Only supplied columns and rows reach validation or a future provider adapter. */
export function studyMappingInput(
  dialect: Pick<StudyDialect, "input">,
): MappingInput {
  return mappingInput(dialect.input);
}
/** Shared scorer's gold shape; no fabricated facts or altered strict assignments. */
export function studyMetricDialect(d: StudyDialect) {
  return {
    id: d.input.dialectId,
    namingFamily: d.family.id,
    input: {
      columns: d.input.projection.columns.map((c, i) => ({
        name: c.name,
        samples: d.input.projection.sampleRows.map((r) => r[i]!),
      })),
      constants: {},
    },
    gold: d.gold.columns.map((g) => ({
      sourceColumn: g.sourceColumn,
      targetField: g.targetField,
      transform: g.transform,
      status: g.status,
      tags: [g.tag],
      rationale: g.rationale,
      ...(g.attack ? { injectedTarget: g.attack.injectedTarget } : {}),
    })),
  };
}
