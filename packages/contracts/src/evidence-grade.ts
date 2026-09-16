import { z } from "zod";

import { DecimalStringSchema } from "./decimal-string";

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const IdentifierSchema = z.string().trim().min(1);
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const DisplayedTextSchema = z
  .string()
  .refine((value) => value.trim().length > 0, "Displayed text is required");

/** Closed set and canonical display order for sentence evidence. */
export const EVIDENCE_GRADES = [
  "QUOTED",
  "COMPUTED",
  "DIFFERS",
  "UNCONFIRMABLE",
  "INTERPRETATION",
] as const;

export const EvidenceGradeSchema = z.enum(EVIDENCE_GRADES);
export type EvidenceGrade = z.infer<typeof EvidenceGradeSchema>;

export const EvidenceSourceRowReferenceSchema = z
  .object({
    eventId: IdentifierSchema,
    rawRowHash: HashSchema,
  })
  .strict();

/**
 * A stable calculation reference plus every canonical row needed to resolve
 * it. The calculation itself stays owned by versioned code rather than being
 * accepted as executable input from a model.
 */
export const EvidenceCalculationReferenceSchema = z
  .object({
    calculationId: IdentifierSchema,
    calculationVersion: VersionSchema,
    sourceRows: z.array(EvidenceSourceRowReferenceSchema).min(1),
    computedValue: DecimalStringSchema,
  })
  .strict();

const NonemptyRangeSchema = z
  .object({
    start: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    end: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .refine(({ start, end }) => end > start, {
    path: ["end"],
    message: "The range end must follow its start",
  });

export const UnconfirmableReasonCodeSchema = z.enum([
  "DAILY_QUOTES_HAVE_NO_TIME_OF_DAY",
]);
export type UnconfirmableReasonCode = z.infer<
  typeof UnconfirmableReasonCodeSchema
>;

export const MissingEvidenceCheckReferenceSchema = z
  .object({
    checkId: IdentifierSchema,
    checkVersion: VersionSchema,
    approvedDatasetHash: HashSchema,
  })
  .strict();

const EvidenceSentenceBase = {
  evidenceVersion: z.literal("1.0"),
  sentenceId: IdentifierSchema,
  text: DisplayedTextSchema,
} as const;

const QuotedEvidenceSentenceSchema = z
  .object({
    ...EvidenceSentenceBase,
    grade: z.literal("QUOTED"),
    evidence: z
      .object({
        sourceArtifactHash: HashSchema,
        byteRange: NonemptyRangeSchema,
      })
      .strict(),
  })
  .strict();

const ComputedEvidenceSentenceSchema = z
  .object({
    ...EvidenceSentenceBase,
    grade: z.literal("COMPUTED"),
    evidence: z
      .object({
        reportedValue: DecimalStringSchema,
        displayedValueRange: NonemptyRangeSchema,
        calculation: EvidenceCalculationReferenceSchema,
      })
      .strict(),
  })
  .strict();

const DiffersEvidenceSentenceSchema = z
  .object({
    ...EvidenceSentenceBase,
    grade: z.literal("DIFFERS"),
    evidence: z
      .object({
        reportedValue: DecimalStringSchema,
        displayedValueRange: NonemptyRangeSchema,
        calculation: EvidenceCalculationReferenceSchema,
      })
      .strict(),
  })
  .strict();

const UnconfirmableEvidenceSentenceSchema = z
  .object({
    ...EvidenceSentenceBase,
    grade: z.literal("UNCONFIRMABLE"),
    evidence: z
      .object({
        reasonCode: UnconfirmableReasonCodeSchema,
        missingEvidenceCheck: MissingEvidenceCheckReferenceSchema,
      })
      .strict(),
  })
  .strict();

const InterpretationEvidenceSentenceSchema = z
  .object({
    ...EvidenceSentenceBase,
    grade: z.literal("INTERPRETATION"),
    evidence: z.discriminatedUnion("basis", [
      z
        .object({
          basis: z.literal("MODEL_AUTHORED"),
          proposalRef: IdentifierSchema,
        })
        .strict(),
      z.object({ basis: z.literal("NOT_A_DATA_QUESTION") }).strict(),
    ]),
  })
  .strict();

/** One displayed sentence with exactly one grade and grade-specific evidence. */
export const EvidenceGradedSentenceSchema = z
  .discriminatedUnion("grade", [
    QuotedEvidenceSentenceSchema,
    ComputedEvidenceSentenceSchema,
    DiffersEvidenceSentenceSchema,
    UnconfirmableEvidenceSentenceSchema,
    InterpretationEvidenceSentenceSchema,
  ])
  .superRefine((sentence, context) => {
    if (sentence.grade === "COMPUTED" || sentence.grade === "DIFFERS") {
      const { start, end } = sentence.evidence.displayedValueRange;
      const displayedValue =
        end <= sentence.text.length
          ? DecimalStringSchema.safeParse(sentence.text.slice(start, end))
          : undefined;
      if (
        !displayedValue?.success ||
        displayedValue.data !== sentence.evidence.reportedValue
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidence", "displayedValueRange"],
          message:
            "The displayed value range must resolve the reported decimal in the sentence",
        });
      }
    }
    if (
      sentence.grade === "COMPUTED" &&
      sentence.evidence.reportedValue !==
        sentence.evidence.calculation.computedValue
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidence", "reportedValue"],
        message: "A recomputed value must equal the reported value",
      });
    }
    if (
      sentence.grade === "DIFFERS" &&
      sentence.evidence.reportedValue ===
        sentence.evidence.calculation.computedValue
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidence", "reportedValue"],
        message: "A differing value must not equal the recomputed value",
      });
    }
  });

export type EvidenceGradedSentence = z.infer<
  typeof EvidenceGradedSentenceSchema
>;
export type QuotedEvidenceSentence = Extract<
  EvidenceGradedSentence,
  { grade: "QUOTED" }
>;
export type CalculatedEvidenceSentence = Extract<
  EvidenceGradedSentence,
  { grade: "COMPUTED" | "DIFFERS" }
>;
export type UnconfirmableEvidenceSentence = Extract<
  EvidenceGradedSentence,
  { grade: "UNCONFIRMABLE" }
>;
export type EvidenceSourceRowReference = z.infer<
  typeof EvidenceSourceRowReferenceSchema
>;

/** A page declaration cannot silently grade the same sentence twice. */
export const EvidenceGradedPageSchema = z
  .object({
    evidenceVersion: z.literal("1.0"),
    sentences: z.array(EvidenceGradedSentenceSchema),
  })
  .strict()
  .superRefine((page, context) => {
    const seen = new Set<string>();
    for (const [index, sentence] of page.sentences.entries()) {
      if (seen.has(sentence.sentenceId)) {
        context.addIssue({
          code: "custom",
          path: ["sentences", index, "sentenceId"],
          message: "A sentence ID may have only one evidence grade",
        });
      }
      seen.add(sentence.sentenceId);
    }
  });

export type EvidenceGradedPage = z.infer<typeof EvidenceGradedPageSchema>;
