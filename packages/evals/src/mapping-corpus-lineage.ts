import { createHash } from "node:crypto";
import type { FamilyBrief } from "./mapping-corpus-contract";

export const LINEAGE_PROJECTION_VERSION = "mapping-study-family-lineage/1";

/** The reviewed source convention/evidence, excluding N4 explanatory prose. */
export function familyLineageProjection(family: FamilyBrief) {
  return {
    id: family.id,
    dialectId: family.dialectId,
    split: family.split,
    cell: family.cell,
    stratum: family.stratum,
    specification: family.specification,
    lineageId: family.lineageId,
    parents: family.parents,
    eventKinds: family.eventKinds,
    problem: family.problem,
    namingConvention: family.namingConvention,
    independence: family.independence,
    author: family.author,
    columns: family.columns.map((column) => ({
      name: column.name,
      samples: column.samples,
      target: column.target,
      transform: column.transform,
      tag: column.tag,
      ...(column.attack ? { attack: column.attack } : {}),
    })),
  };
}

export function familyLineageSha256(family: FamilyBrief) {
  return createHash("sha256")
    .update(JSON.stringify(familyLineageProjection(family)))
    .digest("hex");
}
