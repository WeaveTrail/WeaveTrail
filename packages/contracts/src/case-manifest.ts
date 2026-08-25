import { z } from "zod";

export const CaseManifestSchema = z
  .object({
    manifestVersion: z.literal("1.0"),
    caseId: z.string().min(1),
    datasetHash: z.string().regex(/^[a-f0-9]{64}$/),
    hypothesis: z
      .object({
        pattern: z.literal("RAPID_PRICE_LIFT"),
        instrumentId: z.string().min(1),
        actorIds: z.array(z.string().min(1)),
        startTime: z.iso.datetime({ offset: true }),
        endTime: z.iso.datetime({ offset: true }),
      })
      .strict(),
    rules: z.array(
      z
        .object({
          ruleId: z.string().min(1),
          ruleVersion: z.string().min(1),
          parameters: z.record(z.string(), z.string()),
        })
        .strict(),
    ),
    aiTrace: z
      .object({
        provider: z.string().min(1),
        model: z.string().min(1),
        promptVersion: z.string().min(1),
        confidence: z.number().min(0).max(1),
        referencedEventIds: z.array(z.string().min(1)),
      })
      .strict(),
    status: z.enum(["PROPOSED", "REVIEW_REQUIRED", "APPROVED"]),
  })
  .strict()
  .refine(
    ({ hypothesis }) =>
      Date.parse(hypothesis.startTime) <= Date.parse(hypothesis.endTime),
    { message: "The case start time must not be after its end time" },
  );

export type CaseManifest = z.infer<typeof CaseManifestSchema>;
