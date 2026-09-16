import { z } from "zod";

import { DecimalStringSchema } from "./decimal-string";

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const IdentifierSchema = z.string().trim().min(1);
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

const SourceRowReferenceSchema = z
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
    calculationRef: IdentifierSchema,
    sourceRows: z.array(SourceRowReferenceSchema).min(1),
    computedValue: DecimalStringSchema,
  })
  .strict();

const ByteRangeSchema = z
  .object({
    start: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    end: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .refine(({ start, end }) => end > start, {
    path: ["end"],
    message: "The byte range end must follow its start",
  });

const forbiddenReasonLanguage = [
  "의심",
  "이상거래",
  "때문에 올랐다",
  "AI가 판단했다",
  "틀렸다",
  "오류",
  "가짜",
  "허위",
] as const;

const ReasonFragmentSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => !/[.!?。！？]$/.test(value),
    "A reason fragment must not include terminal punctuation",
  )
  .refine(
    (value) => forbiddenReasonLanguage.every((term) => !value.includes(term)),
    "Evidence reasons must use neutral evidence language",
  );

export const LocalizedEvidenceReasonSchema = z
  .object({
    ko: ReasonFragmentSchema,
    en: ReasonFragmentSchema,
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
        byteRange: ByteRangeSchema,
      })
      .strict(),
  })
  .strict();

const ComputedEvidenceSentenceSchema = z
  .object({
    ...EvidenceSentenceBase,
    grade: z.literal("COMPUTED"),
    evidence: EvidenceCalculationReferenceSchema,
  })
  .strict();

const DiffersEvidenceSentenceSchema = z
  .object({
    ...EvidenceSentenceBase,
    grade: z.literal("DIFFERS"),
    evidence: z
      .object({
        reportedValue: DecimalStringSchema,
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
        missing: LocalizedEvidenceReasonSchema,
        wouldSettle: LocalizedEvidenceReasonSchema,
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
