import { createHash } from "node:crypto";
import { z } from "zod";
import {
  DecimalStringSchema,
  MappedTargetFieldSchema,
  MappingRunRecordV2Schema,
  SchemaMappingProposalSchema,
} from "@weavetrail/contracts";
import type { MappingInput } from "@weavetrail/ai-harness";
import {
  mappingColumnIds,
  validateColumnIdStructure,
  MAPPING_COLUMN_ID_VALIDATOR_VERSION,
} from "@weavetrail/ai-harness/validator";
import { canonicalJson, sha256Canonical } from "@weavetrail/replay-engine";
import { CorpusSchema } from "./mapping-scorer";
import type { MappingRunContext } from "./mapping-model-runner";

export const STRONG_BASELINE_VERSION = "strong-baseline/1";
export const STRONG_BASELINE_PROVIDER = "deterministic-strong-reference";
export const STRONG_NORMALIZATION_VERSION =
  "unicode-names-ordered-ascii-tokens/1";
const Transform = z.enum(["IDENTITY", "ISO_DATETIME", "DECIMAL_STRING"]);
const Answer = z.object({
  targetField: MappedTargetFieldSchema,
  transform: Transform,
});
const Token = z.string().regex(/^[a-z][a-z0-9]*$/);
const Rule = Answer.extend({
  slots: z.array(z.array(Token).min(1)).length(2),
  witnesses: z.array(z.string().min(1)).min(1),
}).strict();
export const StrongBaselineConfigSchema = z
  .object({
    version: z.literal(STRONG_BASELINE_VERSION),
    normalizationVersion: z.literal(STRONG_NORMALIZATION_VERSION),
    devSha256: z.string().regex(/^[a-f0-9]{64}$/),
    entries: z.array(Answer.extend({ key: z.string().min(1) }).strict()),
    blockedKeys: z.array(z.string().min(1)),
    rules: z.array(Rule),
  })
  .strict();
export type StrongBaselineConfig = z.infer<typeof StrongBaselineConfigSchema>;

/** A whole name only: no substring, decoding, instruction stripping or NFKC. */
export function strongNameKey(name: string): string | null {
  return name.length <= 256 && /^[\p{L}][\p{L}\p{N}_./ -]*$/u.test(name)
    ? name.toLowerCase().replace(/[_. /-]/g, "")
    : null;
}

/** Preserve order and consume the entire ASCII name, including every modifier. */
export function strongNameTokens(name: string): string[] | null {
  if (strongNameKey(name) === null || !/^[A-Za-z][A-Za-z0-9_./ -]*$/.test(name))
    return null;
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[_. /-]+/);
}

// Authored on v4 DEV. Each alternative must have a same-target, same-position
// witness in that DEV source. These finite products are not a token-bag heuristic.
const ruleTemplates = [
  {
    targetField: "eventTime",
    transform: "ISO_DATETIME",
    slots: [
      ["trade", "fill"],
      ["ts", "time"],
    ],
  },
  {
    targetField: "price",
    transform: "DECIMAL_STRING",
    slots: [
      ["deal", "fill", "unit"],
      ["price", "px"],
    ],
  },
  {
    targetField: "quantity",
    transform: "DECIMAL_STRING",
    slots: [
      ["dl", "fill"],
      ["qty", "q"],
    ],
  },
  {
    targetField: "instrumentId",
    transform: "IDENTITY",
    slots: [["product"], ["code", "symbol"]],
  },
  {
    targetField: "actorId",
    transform: "IDENTITY",
    slots: [["dealer"], ["id", "code"]],
  },
] as const;

/** Offline authoring only. Refuse non-DEV sources before reading any labels. */
export function buildStrongBaselineConfig(
  bytes: string,
  sha256: string,
): StrongBaselineConfig {
  if (createHash("sha256").update(bytes).digest("hex") !== sha256)
    throw new Error("DEV seal mismatch");
  const raw: unknown = JSON.parse(bytes);
  if (
    !raw ||
    typeof raw !== "object" ||
    !("split" in raw) ||
    raw.split !== "DEV"
  )
    throw new Error("Strong baseline requires DEV only");
  const corpus = CorpusSchema.parse(raw);
  if (corpus.version !== "schema-dialects/4")
    throw new Error("Strong baseline authoring requires schema-dialects/4 DEV");
  const decisions = new Map<string, Set<string>>();
  const observations: {
    name: string;
    targetField: string;
    transform: string;
  }[] = [];
  for (const dialect of corpus.dialects) {
    if (
      new Set(dialect.input.columns.map((c) => c.name)).size !==
      dialect.input.columns.length
    )
      throw new Error("Duplicate DEV column");
    if (dialect.gold.length !== dialect.input.columns.length)
      throw new Error("DEV label coverage mismatch");
    for (const column of dialect.input.columns) {
      const labels = dialect.gold.filter((g) => g.sourceColumn === column.name);
      if (labels.length !== 1)
        throw new Error("Missing or duplicate DEV label");
      const gold = labels[0]!;
      const key = strongNameKey(column.name);
      if (key === null) continue;
      const answer =
        gold.status === "PROPOSED" &&
        gold.targetField !== null &&
        Transform.safeParse(gold.transform).success
          ? {
              targetField: gold.targetField,
              transform: Transform.parse(gold.transform),
            }
          : null;
      const values = decisions.get(key) ?? new Set<string>();
      values.add(canonicalJson(answer));
      decisions.set(key, values);
      if (answer) observations.push({ name: column.name, ...answer });
    }
  }
  const entries: StrongBaselineConfig["entries"] = [];
  const blockedKeys: string[] = [];
  for (const [key, values] of [...decisions].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    if (values.size !== 1 || values.has("null")) blockedKeys.push(key);
    else entries.push({ key, ...Answer.parse(JSON.parse([...values][0]!)) });
  }
  const rules = ruleTemplates.map((template) => {
    const witnesses = [
      ...new Set(
        observations
          .filter((o) => {
            if (blockedKeys.includes(strongNameKey(o.name)!)) return false;
            const tokens = strongNameTokens(o.name);
            return (
              o.targetField === template.targetField &&
              o.transform === template.transform &&
              tokens?.length === template.slots.length &&
              template.slots.every((slot, i) =>
                (slot as readonly string[]).includes(tokens[i]!),
              )
            );
          })
          .map((o) => o.name),
      ),
    ].sort();
    for (const [i, slot] of template.slots.entries())
      for (const token of slot)
        if (!witnesses.some((name) => strongNameTokens(name)![i] === token))
          throw new Error("Token rule lacks an unambiguous DEV witness");
    return { ...template, witnesses };
  });
  return StrongBaselineConfigSchema.parse({
    version: STRONG_BASELINE_VERSION,
    normalizationVersion: STRONG_NORMALIZATION_VERSION,
    devSha256: sha256,
    entries,
    blockedKeys,
    rules,
  });
}

function sampleFits(transform: z.infer<typeof Transform>, value: unknown) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (transform === "DECIMAL_STRING")
    return DecimalStringSchema.safeParse(value).success;
  if (transform === "ISO_DATETIME")
    return z.iso.datetime({ offset: true }).safeParse(value).success;
  return true;
}

/** Runtime sees only the same input projection as a model and a frozen config. */
export function proposeStrongMapping(
  input: MappingInput,
  configuration: StrongBaselineConfig,
) {
  const config = StrongBaselineConfigSchema.parse(configuration);
  const fields = input.columns.map((sourceColumn) => {
    const key = strongNameKey(sourceColumn);
    const tokens = strongNameTokens(sourceColumn);
    const matches =
      key === null || config.blockedKeys.includes(key)
        ? []
        : [
            ...config.entries.filter((e) => e.key === key),
            ...config.rules.filter(
              (r) =>
                tokens?.length === r.slots.length &&
                r.slots.every((slot, i) => slot.includes(tokens[i]!)),
            ),
          ];
    // Resolve semantic ambiguity BEFORE looking at values. Samples can disqualify
    // a unique answer, but cannot choose between competing meanings/transforms.
    const answers = new Map(
      matches.map((m) => [canonicalJson([m.targetField, m.transform]), m]),
    );
    const candidate = answers.size === 1 ? [...answers.values()][0] : undefined;
    const known =
      candidate &&
      input.sampleRows.length > 0 &&
      input.sampleRows.every(
        (row) =>
          Object.hasOwn(row, sourceColumn) &&
          sampleFits(candidate.transform, row[sourceColumn]),
      );
    return {
      sourceColumn,
      targetField: known ? candidate.targetField : null,
      transform: known ? candidate.transform : null,
      confidence: known ? 1 : 0,
      status: known ? ("PROPOSED" as const) : ("REVIEW_REQUIRED" as const),
      evidence: known
        ? "Frozen DEV whole-name alias or ordered token rule; every sample fits the registered transform."
        : "No unique compatible frozen DEV answer; human review required.",
    };
  });
  const targets = fields.map((f) => f.targetField);
  for (const field of fields)
    if (
      field.targetField !== null &&
      targets.filter((t) => t === field.targetField).length > 1
    ) {
      field.targetField = null;
      field.transform = null;
      field.confidence = 0;
      field.status = "REVIEW_REQUIRED";
      field.evidence =
        "Competing columns match one target; human review required.";
    }
  return SchemaMappingProposalSchema.parse({
    mappingVersion: "1.4",
    sourceArtifactHash: input.sourceArtifactHash,
    constants: input.constants,
    fields,
  });
}

/** No model, network, clock or approval. Zero latency is a sentinel. */
export function runStrongMapping(
  input: MappingInput,
  context: MappingRunContext,
  config: StrongBaselineConfig,
) {
  const proposal = proposeStrongMapping(input, config);
  const ids = mappingColumnIds(input);
  const fields = proposal.fields.map(({ sourceColumn, ...field }) => ({
    columnId: ids[input.columns.indexOf(sourceColumn)]!,
    ...field,
  }));
  const validation = validateColumnIdStructure(
    { kind: "fields", value: { fields } },
    input,
  );
  return MappingRunRecordV2Schema.parse({
    ...context,
    schemaVersion: "mapping-run/2",
    provider: STRONG_BASELINE_PROVIDER,
    requestedModel: STRONG_BASELINE_VERSION,
    reportedModel: null,
    adapterVersion: STRONG_BASELINE_VERSION,
    promptVersion: "non-model/no-prompt/1",
    outputSchemaVersion: "mapping-fields/2",
    validatorVersion: MAPPING_COLUMN_ID_VALIDATOR_VERSION,
    temperature: "0",
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
    outcome: validation.status === "VALID" ? "VALID" : "CONTRACT_REJECTED",
    failureClass: validation.status === "VALID" ? null : "OUTPUT_CONTRACT",
    validatorReasons: validation.reasons,
    parsedOutput: {
      fields: fields.map((field, i) => ({
        ...field,
        sourceColumn: input.columns[i]!,
      })),
    },
  });
}

export function strongBaselineDefinition(config: StrongBaselineConfig) {
  const parsed = StrongBaselineConfigSchema.parse(config);
  return {
    version: parsed.version,
    normalizationVersion: parsed.normalizationVersion,
    devSha256: parsed.devSha256,
    configurationHash: sha256Canonical(parsed),
    selectable: false as const,
  };
}
