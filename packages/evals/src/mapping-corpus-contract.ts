import { z } from "zod";

export const CORPUS_VERSION = "mapping-study-inputs/1";
export const GENERATOR_VERSION = "mapping-study-generator/1";
export const GENERATION_SEED = "weavetrail-study-2036-a";
export const cells = [
  "R_IDENTITY",
  "R_CLOCKS",
  "R_PARTIES",
  "R_MEASURES",
  "H_NAMES",
  "H_PAIRS",
  "H_CONVERSIONS",
  "H_HOSTILE",
  "M_AMBIGUOUS",
  "M_ABSENT",
  "M_UNSUPPORTED",
  "M_HOSTILE",
  "D_BASE",
] as const;
export const tags = [
  "CLEAR",
  "ABBREVIATED",
  "SYNONYM",
  "AMBIGUOUS",
  "ABSENT_LURE",
  "TRANSFORM_LURE",
  "INJECTION",
] as const;
const targets = [
  "sourceEventId",
  "eventTime",
  "instrumentId",
  "eventType",
  "receivedAt",
  "sequence",
  "side",
  "actorId",
  "counterpartyId",
  "orderId",
  "price",
  "quantity",
] as const;
const transforms = [
  "IDENTITY",
  "ISO_DATETIME",
  "EPOCH_MS_TO_ISO",
  "UPPERCASE",
  "DECIMAL_STRING",
  "BUY_SELL_CODE",
  "EVENT_TYPE_CODE",
] as const;
const TargetSchema = z.enum(targets);
const TransformSchema = z.enum(transforms);
const IdSchema = z.string().regex(/^[fd]-\d{3}$/u);
export const AttackSchema = z
  .object({
    plainText: z.string().min(1),
    language: z.enum(["EN", "KO"]),
    encoding: z.enum(["PLAIN", "BASE64", "ZERO_WIDTH"]),
    placement: z.enum(["HEADER", "CELL"]),
    injectedTarget: TargetSchema,
    benignMeaning: z.string().min(1),
  })
  .strict();
export const ColumnBriefSchema = z
  .object({
    name: z.string().min(1),
    samples: z.array(z.string()).min(2).max(8),
    target: TargetSchema.nullable(),
    transform: TransformSchema.nullable(),
    tag: z.enum(tags),
    reason: z.string().min(1),
    alternatives: z
      .array(
        z
          .object({
            interpretation: z.string().min(1),
            ruledOutBy: z.string().min(1).nullable(),
          })
          .strict(),
      )
      .min(1),
    attack: AttackSchema.optional(),
  })
  .strict()
  .superRefine((column, ctx) => {
    if ((column.target === null) !== (column.transform === null))
      ctx.addIssue({
        code: "custom",
        message: "Target/transform nulls must agree",
      });
    if (
      column.tag === "AMBIGUOUS" &&
      column.alternatives.filter((a) => a.ruledOutBy === null).length < 2
    )
      ctx.addIssue({
        code: "custom",
        message: "Ambiguity requires two compatible alternatives",
      });
    if ((column.tag === "INJECTION") !== (column.attack !== undefined))
      ctx.addIssue({
        code: "custom",
        message: "Injection tag requires an authored attack",
      });
    if (column.attack?.injectedTarget === column.target)
      ctx.addIssue({
        code: "custom",
        message: "Attack must request a wrong target",
      });
  });
export const FamilyBriefSchema = z
  .object({
    id: IdSchema,
    dialectId: IdSchema,
    split: z.enum(["SELECT", "AUDIT", "DRIFT"]),
    cell: z.enum(cells),
    stratum: z.enum(["RESOLVABLE", "HARD_RESOLVABLE", "MUST_REVIEW"]),
    specification: z.literal("mapping-corpus-spec/1"),
    lineageId: IdSchema,
    parents: z.array(IdSchema),
    eventKinds: z.array(z.enum(["TRADE", "ORDER_NEW", "ORDER_CANCEL"])).min(1),
    problem: z.string().min(1),
    namingConvention: z.string().min(1),
    columns: z.array(ColumnBriefSchema).min(4),
    independence: z.string().min(1),
    author: z.string().min(1),
    review: z
      .object({
        status: z.literal("PENDING"),
        reviewer: z.null(),
        reviewedAt: z.null(),
      })
      .strict(),
  })
  .strict();
export type Cell = (typeof cells)[number];
export type ColumnBrief = z.infer<typeof ColumnBriefSchema>;
export type FamilyBrief = z.infer<typeof FamilyBriefSchema>;

// This projection is the entire task-specific input. No offline identifier,
// split, label, truth, or constant derived from gold is transmitted.
export const ProviderProjectionSchema = z
  .object({
    columns: z
      .array(
        z
          .object({
            columnId: z.string().regex(/^c\d{2}$/u),
            name: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    sampleRows: z.array(z.array(z.string())).min(1).max(8),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (
      input.columns.some(
        (c, i) => c.columnId !== `c${String(i + 1).padStart(2, "0")}`,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Column IDs must be opaque supplied-order IDs",
      });
    if (new Set(input.columns.map((c) => c.name)).size !== input.columns.length)
      ctx.addIssue({ code: "custom", message: "Column names must be unique" });
    if (input.sampleRows.some((row) => row.length !== input.columns.length))
      ctx.addIssue({
        code: "custom",
        message: "Rows must cover exactly the supplied columns",
      });
  });
export const ColumnGoldSchema = z
  .object({
    columnId: z.string(),
    sourceColumn: z.string(),
    targetField: TargetSchema.nullable(),
    transform: TransformSchema.nullable(),
    status: z.enum(["PROPOSED", "REVIEW_REQUIRED"]),
    tag: z.enum(tags),
    rationale: z.string().min(1),
    evidence: z
      .object({
        header: z.string(),
        sampleCoordinates: z
          .array(z.tuple([z.number().int().nonnegative(), z.string()]))
          .min(1),
      })
      .strict(),
    alternatives: ColumnBriefSchema.shape.alternatives,
    attack: AttackSchema.extend({
      payload: z.string(),
      decodingRecipe: z.string(),
    })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (g) =>
      g.targetField === null
        ? g.transform === null && g.status === "REVIEW_REQUIRED"
        : g.transform !== null && g.status === "PROPOSED",
    "Gold target/transform/status must agree",
  );
export const InputRecordSchema = z
  .object({
    dialectId: z.string(),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/u),
    projection: ProviderProjectionSchema,
  })
  .strict();
export const GoldRecordSchema = z
  .object({
    dialectId: z.string(),
    familyId: IdSchema,
    inputHash: z.string(),
    columns: z.array(ColumnGoldSchema),
    absentRequiredTargets: z.array(TargetSchema),
    expectedValidator: z.enum([
      "VALID",
      "MISSING_REQUIRED_TARGET",
      "TRANSFORM_FAILED",
    ]),
    expectedDisposition: z.enum(["PROPOSAL_OFFERABLE", "REVIEW_REQUIRED"]),
    reasonCategory: z.string(),
    // Canonical strict tuples are authoritative. No unreviewed equivalences.
    acceptedAlternativeAssignments: z.array(z.array(ColumnGoldSchema)).max(0),
  })
  .strict();
export type ProviderProjection = z.infer<typeof ProviderProjectionSchema>;
export type InputRecord = z.infer<typeof InputRecordSchema>;
export type GoldRecord = z.infer<typeof GoldRecordSchema>;
export const ArtifactSchema = z
  .object({
    version: z.literal(CORPUS_VERSION),
    status: z.literal("UNSEALED"),
    split: z.enum(["SELECT", "AUDIT", "DRIFT"]),
    inputs: z.array(InputRecordSchema),
  })
  .strict();
export const GoldArtifactSchema = z
  .object({
    version: z.literal(CORPUS_VERSION),
    status: z.literal("UNSEALED"),
    split: z.enum(["SELECT", "AUDIT", "DRIFT"]),
    records: z.array(GoldRecordSchema),
  })
  .strict();
export const DriftRelationSchema = z
  .object({
    familyId: IdSchema,
    baseDialectId: z.string(),
    dialectId: z.string(),
    baseInputHash: z.string(),
    inputHash: z.string(),
    change: z.enum([
      "IDENTICAL",
      "RENAME",
      "ADD",
      "REMOVE",
      "REPRESENTATION",
      "SAME_SHAPE_SEMANTICS",
    ]),
    allocation: z
      .object({
        add: z.enum(["COMPETING_REQUIRED", "SUPPORTED_OPTIONAL"]),
        remove: z.enum(["REQUIRED", "OPTIONAL"]),
        representation: z.enum(["SUPPORTED", "UNSUPPORTED"]),
        semantics: z.enum(["VISIBLE_OUTSIDE_SHAPE", "UNOBSERVABLE"]),
      })
      .strict(),
    observable: z.array(
      z
        .object({
          name: z.string(),
          label: z.enum([
            "UNCHANGED",
            "ADDED",
            "REMOVED",
            "REPRESENTATION_CHANGED",
          ]),
        })
        .strict(),
    ),
    witness: z.string().min(1),
    scenarioTruth: z
      .object({
        changed: z.boolean(),
        visibility: z.enum(["VISIBLE", "HIDDEN", "NONE"]),
        beforeTarget: TargetSchema.nullable(),
        afterTarget: TargetSchema.nullable(),
      })
      .strict(),
    oldApprovalUsable: z.literal(false),
    correctBaseAssumption: z.literal("GENERATED_FIXTURE_NOT_OBSERVED_APPROVAL"),
  })
  .strict();
export type DriftRelation = z.infer<typeof DriftRelationSchema>;
