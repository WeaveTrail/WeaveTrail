import { z } from "zod";

import { ApprovalRecordSchema } from "./approval-record";
import { RuleConfigurationSchema } from "./rule-parameters";

const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const SECONDS_PER_DAY = 86_400n;
const CASE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const CaseEventTimeSchema = z.iso
  .datetime({ offset: true })
  .regex(CASE_TIME_PATTERN);

function daysFromCivil(year: number, month: number, day: number): number {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;

  return era * 146_097 + dayOfEra - 719_468;
}

function caseTimeToEpochNanoseconds(value: string): bigint | undefined {
  const match = CASE_TIME_PATTERN.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fractionalNanoseconds = BigInt((match[7] ?? "").padEnd(9, "0"));
  const offsetSeconds =
    match[8] === "Z"
      ? 0
      : (match[9] === "-" ? -1 : 1) *
        (Number(match[10]) * 3_600 + Number(match[11]) * 60);
  const localSeconds =
    BigInt(daysFromCivil(year, month, day)) * SECONDS_PER_DAY +
    BigInt(hour * 3_600 + minute * 60 + second);

  return (
    (localSeconds - BigInt(offsetSeconds)) * NANOSECONDS_PER_SECOND +
    fractionalNanoseconds
  );
}

function caseWindowIsOrdered(hypothesis: {
  startTime: string;
  endTime: string;
}): boolean {
  const startTime = caseTimeToEpochNanoseconds(hypothesis.startTime);
  const endTime = caseTimeToEpochNanoseconds(hypothesis.endTime);
  return (
    startTime !== undefined && endTime !== undefined && startTime <= endTime
  );
}

export const CasePatternSchema = z.enum([
  "RAPID_PRICE_LIFT",
  "CROSS_MARKET_SESSION_REVERSAL",
]);

export const CASE_PATTERN_PARTICIPANT_REQUIREMENT = {
  RAPID_PRICE_LIFT: "REQUIRED",
  CROSS_MARKET_SESSION_REVERSAL: "OPTIONAL",
} as const satisfies Record<
  z.infer<typeof CasePatternSchema>,
  "REQUIRED" | "OPTIONAL"
>;

const SharedCaseManifestFields = {
  caseId: z.string().min(1),
  canonicalDatasetHash: z.string().regex(/^[a-f0-9]{64}$/),
  rules: z.array(RuleConfigurationSchema),
  aiTrace: z
    .object({
      provider: z.string().min(1),
      model: z.string().min(1),
      promptVersion: z.string().min(1),
      confidence: z.number().min(0).max(1),
      referencedEventIds: z.array(z.string().min(1)),
    })
    .strict(),
} as const;

const LegacyHypothesisSchema = z
  .object({
    pattern: z.literal("RAPID_PRICE_LIFT"),
    instrumentId: z.string().min(1),
    actorIds: z.array(z.string().min(1)).min(1),
    startTime: CaseEventTimeSchema,
    endTime: CaseEventTimeSchema,
  })
  .strict();

const MultiInstrumentHypothesisSchema = z
  .object({
    pattern: CasePatternSchema,
    instrumentIds: z
      .array(z.string().min(1))
      .min(1)
      .refine(
        (instrumentIds) => new Set(instrumentIds).size === instrumentIds.length,
        { message: "Declared instrument identifiers must be unique" },
      ),
    actorIds: z.array(z.string().min(1)),
    startTime: CaseEventTimeSchema,
    endTime: CaseEventTimeSchema,
  })
  .strict();

const LegacyCaseManifestProposalSchema = z
  .object({
    manifestVersion: z.literal("1.3"),
    ...SharedCaseManifestFields,
    hypothesis: LegacyHypothesisSchema,
  })
  .strict();

const MultiInstrumentCaseManifestProposalSchema = z
  .object({
    manifestVersion: z.literal("1.4"),
    ...SharedCaseManifestFields,
    hypothesis: MultiInstrumentHypothesisSchema,
  })
  .strict();

function validateCaseManifestPolicy(
  manifest: {
    manifestVersion: "1.3" | "1.4";
    hypothesis: {
      pattern: z.infer<typeof CasePatternSchema>;
      actorIds: string[];
      startTime: string;
      endTime: string;
    };
  },
  context: z.RefinementCtx,
) {
  if (!caseWindowIsOrdered(manifest.hypothesis)) {
    context.addIssue({
      code: "custom",
      message: "The case start time must not be after its end time",
    });
  }
  if (
    manifest.manifestVersion === "1.4" &&
    CASE_PATTERN_PARTICIPANT_REQUIREMENT[manifest.hypothesis.pattern] ===
      "REQUIRED" &&
    manifest.hypothesis.actorIds.length === 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["hypothesis", "actorIds"],
      message: `${manifest.hypothesis.pattern} requires at least one participant identifier`,
    });
  }
}

export const VersionedCaseManifestProposalSchema = z
  .discriminatedUnion("manifestVersion", [
    LegacyCaseManifestProposalSchema,
    MultiInstrumentCaseManifestProposalSchema,
  ])
  .superRefine(validateCaseManifestPolicy);

const LegacyCaseManifestSchema = LegacyCaseManifestProposalSchema.extend({
  approval: ApprovalRecordSchema,
}).strict();
const MultiInstrumentCaseManifestSchema =
  MultiInstrumentCaseManifestProposalSchema.extend({
    approval: ApprovalRecordSchema,
  }).strict();

export const VersionedCaseManifestSchema = z
  .discriminatedUnion("manifestVersion", [
    LegacyCaseManifestSchema,
    MultiInstrumentCaseManifestSchema,
  ])
  .superRefine(validateCaseManifestPolicy);

// Stable 1.3 entry points remain directly reachable and keep their prior types.
export const CaseManifestProposalSchema =
  LegacyCaseManifestProposalSchema.superRefine(validateCaseManifestPolicy);
export const CaseManifestSchema = LegacyCaseManifestSchema.superRefine(
  validateCaseManifestPolicy,
);

export const CaseManifestV14ProposalSchema =
  MultiInstrumentCaseManifestProposalSchema.superRefine(
    validateCaseManifestPolicy,
  );
export const CaseManifestV14Schema =
  MultiInstrumentCaseManifestSchema.superRefine(validateCaseManifestPolicy);

export type CaseManifestProposal = z.infer<typeof CaseManifestProposalSchema>;
export type CaseManifest = z.infer<typeof CaseManifestSchema>;
export type CaseManifestV14Proposal = z.infer<
  typeof CaseManifestV14ProposalSchema
>;
export type CaseManifestV14 = z.infer<typeof CaseManifestV14Schema>;
export type VersionedCaseManifestProposal = z.infer<
  typeof VersionedCaseManifestProposalSchema
>;
export type VersionedCaseManifest = z.infer<typeof VersionedCaseManifestSchema>;
