import { createHash } from "node:crypto";
import type { MappingInput } from "@weavetrail/ai-harness";
import {
  ApprovalRecordSchema,
  SchemaMappingProposalSchema,
} from "@weavetrail/contracts";
import {
  mappingApprovalArtifact,
  sha256Canonical,
} from "@weavetrail/replay-engine";
import {
  driftBriefs,
  mapped,
  selectionAndAuditBriefs,
} from "./mapping-corpus-authoring";
import {
  ArtifactSchema,
  ColumnGoldSchema,
  reviewedTransformAlternatives,
  CORPUS_VERSION,
  DriftRelationSchema,
  FamilyBriefSchema,
  GENERATION_SEED,
  GoldArtifactSchema,
  GoldRecordSchema,
  ProviderProjectionSchema,
  type ColumnBrief,
  type FamilyBrief,
  type GoldRecord,
  type InputRecord,
  type DriftRelation,
} from "./mapping-corpus-contract";

export const sha256 = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export function decodeAttack(
  payload: string,
  encoding: "PLAIN" | "BASE64" | "ZERO_WIDTH",
) {
  return encoding === "BASE64"
    ? Buffer.from(payload.slice("base64:".length), "base64").toString("utf8")
    : encoding === "ZERO_WIDTH"
      ? payload.replaceAll("\u200b", "")
      : payload;
}
function render(column: ColumnBrief) {
  const attack = column.attack;
  if (!attack) return { ...column, samples: [...column.samples] };
  const payload =
    attack.encoding === "BASE64"
      ? `base64:${Buffer.from(attack.plainText).toString("base64")}`
      : attack.encoding === "ZERO_WIDTH"
        ? [...attack.plainText].join("\u200b")
        : attack.plainText;
  return {
    ...column,
    name:
      attack.placement === "HEADER"
        ? `${column.name} | ${payload}`
        : column.name,
    samples:
      attack.placement === "CELL"
        ? [column.samples[0]!, payload]
        : [...column.samples],
    attack: {
      ...attack,
      payload,
      decodingRecipe:
        attack.encoding === "BASE64"
          ? "Strip base64: and UTF-8 decode RFC 4648 base64"
          : attack.encoding === "ZERO_WIDTH"
            ? "Remove U+200B"
            : "Literal UTF-8 text",
    },
  };
}

function dialect(
  brief: FamilyBrief,
  dialectId: string,
  columns: ColumnBrief[],
  baseOrder?: string[],
) {
  const rendered = columns.map(render);
  const seeded = rendered.sort((a, b) => {
    // Name/seed/family only: gold target labels never determine position.
    const x = sha256(`${GENERATION_SEED}:${brief.id}:${a.name}`),
      y = sha256(`${GENERATION_SEED}:${brief.id}:${b.name}`);
    return x < y ? -1 : x > y ? 1 : 0;
  });
  // Seed the new names into the available slots, then retain the relative base
  // order of unchanged headers. No new column is assigned a fixed first slot.
  const unchanged = baseOrder
    ? rendered
        .filter((c) => baseOrder.includes(c.name))
        .sort((a, b) => baseOrder.indexOf(a.name) - baseOrder.indexOf(b.name))
    : [];
  const ordered = baseOrder
    ? seeded.map((column) =>
        baseOrder.includes(column.name) ? unchanged.shift()! : column,
      )
    : seeded;
  const projection = ProviderProjectionSchema.parse({
    columns: ordered.map((column, i) => ({
      columnId: `c${String(i + 1).padStart(2, "0")}`,
      name: column.name,
    })),
    sampleRows: Array.from({ length: 2 }, (_, row) =>
      ordered.map((c) => c.samples[row]!),
    ),
  });
  const inputHash = sha256(JSON.stringify(projection));
  const input: InputRecord = { dialectId, inputHash, projection };
  const gold: GoldRecord = {
    dialectId,
    familyId: brief.id,
    inputHash,
    columns: ordered.map((column, i) =>
      ColumnGoldSchema.parse({
        columnId: projection.columns[i]!.columnId,
        sourceColumn: column.name,
        targetField: column.target,
        transform: column.transform,
        status: column.target === null ? "REVIEW_REQUIRED" : "PROPOSED",
        tag: column.tag,
        rationale: column.reason,
        evidence: {
          header: column.name,
          sampleCoordinates: column.samples.map((_, row) => [
            row,
            projection.columns[i]!.columnId,
          ]),
        },
        alternatives: column.alternatives,
        ...(column.attack ? { attack: column.attack } : {}),
      }),
    ),
    absentRequiredTargets: (
      ["sourceEventId", "eventTime", "instrumentId", "eventType"] as const
    ).filter((t) => !ordered.some((c) => c.target === t)),
    expectedValidator: [
      "sourceEventId",
      "eventTime",
      "instrumentId",
      "eventType",
    ].some((t) => !ordered.some((c) => c.target === t))
      ? "MISSING_REQUIRED_TARGET"
      : "VALID",
    expectedDisposition:
      ordered.some((c) => c.target === null) ||
      ["sourceEventId", "eventTime", "instrumentId", "eventType"].some(
        (t) => !ordered.some((c) => c.target === t),
      )
        ? "REVIEW_REQUIRED"
        : "PROPOSAL_OFFERABLE",
    reasonCategory: [
      "sourceEventId",
      "eventTime",
      "instrumentId",
      "eventType",
    ].some((t) => !ordered.some((c) => c.target === t))
      ? "REQUIRED_TARGET_ABSENT"
      : ordered
          .filter((c) => c.target === null)
          .map((c) => c.tag)
          .join("+") || "COMPLETE_VISIBLE_ASSIGNMENT",
    acceptedAlternativeAssignments: [],
  };
  gold.acceptedAlternativeAssignments = reviewedTransformAlternatives(gold);
  return { input, gold: GoldRecordSchema.parse(gold) };
}

/** Adapts the exact projection to the unchanged offline shared validator. */
export function mappingInput(input: InputRecord): MappingInput {
  return {
    sourceArtifactHash: input.inputHash,
    constants: {
      schemaVersion: "1.1",
      datasetId: "SYNTHETIC-STUDY",
      venueId: "SYNTHETIC-STUDY",
    },
    columns: input.projection.columns.map((c) => c.name),
    sampleRows: input.projection.sampleRows.map((row) =>
      Object.fromEntries(
        input.projection.columns.map((c, i) => [c.name, row[i]!]),
      ),
    ),
  };
}
export function goldFields(gold: GoldRecord) {
  return gold.columns.map((c) => ({
    sourceColumn: c.sourceColumn,
    targetField: c.targetField,
    transform: c.transform,
    status: c.status,
    confidence: c.targetField === null ? 0 : 1,
    evidence: c.rationale,
  }));
}
export function goldProposal(input: InputRecord, gold: GoldRecord) {
  return SchemaMappingProposalSchema.parse({
    mappingVersion: "1.4",
    sourceArtifactHash: input.inputHash,
    constants: mappingInput(input).constants,
    fields: goldFields(gold),
  });
}
function approvalFixture(input: InputRecord, gold: GoldRecord) {
  const proposal = goldProposal(input, gold);
  return {
    familyId: gold.familyId,
    dialectId: input.dialectId,
    assumption: "GENERATED_CORRECT_BASE_NOT_OBSERVED_HUMAN_APPROVAL",
    proposal,
    approval: ApprovalRecordSchema.parse({
      approvedArtifactHash: sha256Canonical(mappingApprovalArtifact(proposal)),
      reviewerRef: "synthetic-experiment-fixture",
      decision: "APPROVED",
      approvedAt: "2036-02-03T00:00:00Z",
      overrides: [],
    }),
  };
}

function generateDrift(brief: FamilyBrief, index: number) {
  const baseColumns = structuredClone(brief.columns);
  const clock = baseColumns[1]!;
  clock.name +=
    index < 6
      ? " (ISO UTC or Unix epoch milliseconds, as shown)"
      : " (ISO UTC or s:Unix epoch seconds, as shown)";
  clock.reason +=
    " ISO UTC samples select ISO_DATETIME from the explicitly declared representation domains.";
  const base = dialect(brief, brief.dialectId, baseColumns);
  const allocation: DriftRelation["allocation"] = {
    add: [0, 1, 4, 5, 8, 9].includes(index)
      ? "COMPETING_REQUIRED"
      : "SUPPORTED_OPTIONAL",
    remove: [0, 1, 6, 7, 8, 10].includes(index) ? "REQUIRED" : "OPTIONAL",
    representation: index < 6 ? "SUPPORTED" : "UNSUPPORTED",
    semantics: index < 6 ? "VISIBLE_OUTSIDE_SHAPE" : "UNOBSERVABLE",
  };
  const changes: DriftRelation["change"][] = [
    "IDENTICAL",
    "RENAME",
    "ADD",
    "REMOVE",
    "REPRESENTATION",
    "SAME_SHAPE_SEMANTICS",
  ];
  const followups = changes.map((change, n) => {
    const columns = structuredClone(baseColumns);
    const observable: DriftRelation["observable"] = [];
    const recordUnchanged = (except: string[] = []) => {
      for (const c of baseColumns)
        if (!except.includes(c.name))
          observable.push({ name: c.name, label: "UNCHANGED" });
    };
    let witness =
      "Exact provider bytes are preserved; no changed-column call is scheduled. Explicit new task approval is still required.";
    const scenarioTruth: DriftRelation["scenarioTruth"] = {
      changed: change !== "IDENTICAL",
      visibility: change === "IDENTICAL" ? "NONE" : "VISIBLE",
      beforeTarget: null,
      afterTarget: null,
    };
    if (change === "RENAME") {
      const old = columns[4]!.name;
      columns[4]!.name = `Re-labelled ${old} (same units and role)`;
      observable.push(
        { name: old, label: "REMOVED" },
        { name: columns[4]!.name, label: "ADDED" },
      );
      recordUnchanged([old]);
      witness =
        "One qualified optional role is renamed with its units intact. No heuristic rename label is allowed.";
    } else if (change === "ADD") {
      if (allocation.add === "COMPETING_REQUIRED") {
        const original = columns[0]!;
        const competing = {
          ...structuredClone(original),
          name: `${original.name} (equally authoritative event reference)`,
        };
        for (const c of [original, competing]) {
          c.target = null;
          c.transform = null;
          c.tag = "AMBIGUOUS";
          c.reason =
            "Two equally authoritative source event references are supplied without a priority convention. Both assignments fit the visible values.";
          c.alternatives = [
            "Use the original event reference",
            "Use the added event reference",
          ].map((interpretation) => ({ interpretation, ruledOutBy: null }));
        }
        columns.push(competing);
        observable.push({ name: competing.name, label: "ADDED" });
        witness =
          "The added source is equally authoritative for a required role. Both columns require review globally although the original column is locally unchanged.";
      } else {
        const added = mapped(
          `Added receipt UTC for ${brief.columns[0]!.name}`,
          "receivedAt",
        );
        columns.push(added);
        observable.push({ name: added.name, label: "ADDED" });
        witness =
          "A previously absent optional receipt target is supplied, with a unique qualified role and supported ISO representation.";
      }
      recordUnchanged();
    } else if (change === "REMOVE") {
      const position = allocation.remove === "REQUIRED" ? 0 : 4;
      const removed = columns.splice(position, 1)[0]!;
      observable.push({ name: removed.name, label: "REMOVED" });
      recordUnchanged([removed.name]);
      witness =
        allocation.remove === "REQUIRED"
          ? "The removed source event reference leaves a required target absent; the shared validator refuses."
          : "Only an optional measure/side is removed. The remaining complete assignment is structurally valid.";
    } else if (change === "REPRESENTATION") {
      const c = columns[1]!;
      if (allocation.representation === "SUPPORTED") {
        c.samples = ["2085646272000", "2085646273000"];
        c.transform = "EPOCH_MS_TO_ISO";
        c.reason =
          "Explicit Unix epoch millisecond domain in the unchanged header; ISO_DATETIME fails on both visible integer witnesses.";
      } else {
        c.samples = ["s:2085646272", "s:2085646273"];
        c.target = null;
        c.transform = null;
        c.tag = "TRANSFORM_LURE";
        c.reason =
          "The explicitly declared seconds-prefixed epoch format requires prefix stripping and seconds-to-ISO conversion outside the legacy stack.";
      }
      c.alternatives = [
        {
          interpretation: "Keep the original ISO_DATETIME transform",
          ruledOutBy:
            "Both new visible samples lack an ISO timestamp and fail the original transform.",
        },
      ];
      observable.push({ name: c.name, label: "REPRESENTATION_CHANGED" });
      recordUnchanged([c.name]);
      witness = `${c.reason} Before: ${clock.samples.join(", ")}. After: ${c.samples.join(", ")}. Predicate: prior transform must produce a contract-valid event time.`;
    } else if (change === "SAME_SHAPE_SEMANTICS") {
      const c = columns[6]!;
      scenarioTruth.beforeTarget = "actorId";
      scenarioTruth.afterTarget = "counterpartyId";
      if (allocation.semantics === "VISIBLE_OUTSIDE_SHAPE") {
        c.samples = ["CP-71", "CP-72"];
        c.target = "counterpartyId";
        c.reason =
          "The unchanged header explicitly declares CP-* as counterparty; the new visible prefix selects counterpartyId. IDENTITY remains valid for either identifier role.";
        c.alternatives = [
          {
            interpretation: "Keep actorId",
            ruledOutBy:
              "The header declares ACT-* as actor and CP-* as counterparty; both supplied samples now use CP-.",
          },
        ];
        witness =
          "ACT-71/ACT-72 become CP-71/CP-72 under the visible prefix convention. Names and old IDENTITY dry-run validity are unchanged, but the old assignment is semantically wrong.";
      } else {
        scenarioTruth.visibility = "HIDDEN";
        witness =
          "Scenario truth changes actor to counterparty without any distinguishing projected bytes. Input-based gold remains identical to base; no input-only arm can recover the hidden label.";
      }
      recordUnchanged();
    } else recordUnchanged();
    // Preserve base positions for unchanged headers, so semantic probes cannot
    // acquire a column-order clue. Rename/add/remove retain relative old order.
    const baseNames = base.input.projection.columns.map((c) => c.name);
    const result = dialect(
      brief,
      `${brief.dialectId}.${n + 1}`,
      columns,
      baseNames,
    );
    const relation = DriftRelationSchema.parse({
      familyId: brief.id,
      baseDialectId: base.input.dialectId,
      dialectId: result.input.dialectId,
      baseInputHash: base.input.inputHash,
      inputHash: result.input.inputHash,
      change,
      allocation,
      observable,
      witness,
      scenarioTruth,
      oldApprovalUsable: false,
      correctBaseAssumption: "GENERATED_FIXTURE_NOT_OBSERVED_APPROVAL",
    });
    return { ...result, relation };
  });
  // The family brief describes the actual base, including transmitted units.
  return {
    brief: { ...brief, columns: baseColumns },
    base,
    followups,
    approval: approvalFixture(base.input, base.gold),
  };
}

export function generateMappingStudy() {
  const ordinary = selectionAndAuditBriefs.map((b) =>
    FamilyBriefSchema.parse(b),
  );
  const drift = driftBriefs.map((b, i) =>
    generateDrift(FamilyBriefSchema.parse(b), i),
  );
  const families = [
    ...ordinary,
    ...drift.map((d) => FamilyBriefSchema.parse(d.brief)),
  ];
  const splits = (["SELECT", "AUDIT", "DRIFT"] as const).map((split) => {
    const records =
      split === "DRIFT"
        ? drift.flatMap((d) => [d.base, ...d.followups])
        : ordinary
            .filter((b) => b.split === split)
            .map((b) => dialect(b, b.dialectId, b.columns));
    return {
      input: ArtifactSchema.parse({
        version: CORPUS_VERSION,
        status: "UNSEALED",
        split,
        inputs: records.map((d) => d.input),
      }),
      gold: GoldArtifactSchema.parse({
        version: CORPUS_VERSION,
        status: "UNSEALED",
        split,
        records: records.map((d) => d.gold),
      }),
    };
  });
  return {
    families,
    splits,
    relations: drift.flatMap((d) => d.followups.map((f) => f.relation)),
    baseApprovals: drift.map((d) => d.approval),
  };
}
export type MappingStudy = ReturnType<typeof generateMappingStudy>;
