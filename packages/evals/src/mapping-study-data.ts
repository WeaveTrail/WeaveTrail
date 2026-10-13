import { z } from "zod";
import type { MappingInput } from "@weavetrail/ai-harness";
import { mappingInput, sha256 } from "./mapping-corpus-generator";
import {
  ArtifactSchema,
  GoldArtifactSchema,
  FamilyBriefSchema,
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
export type StudySource = {
  inputs: StudyBytes;
  gold: StudyBytes;
  families: StudyBytes;
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
  const dialects = inputs.inputs.map((input) => {
    const truth = gold.records.find((g) => g.dialectId === input.dialectId);
    const family = families.records.find((f) => f.id === truth?.familyId);
    if (
      !truth ||
      !family ||
      family.split !== inputs.split ||
      family.dialectId !== input.dialectId ||
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
    return { input, gold: truth, family };
  });
  const scopedFamilies = families.records.filter(
    (f) => f.split === inputs.split,
  );
  if (scopedFamilies.some((f) => !dialects.some((d) => d.family.id === f.id)))
    throw new Error("Missing study family");
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
