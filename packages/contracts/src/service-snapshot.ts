import { z } from "zod";

export const SnapshotHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

const PublicUrlSchema = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    url.protocol === "https:" && !url.username && !url.password && !url.hash
  );
}, "Use a credential-free HTTPS URL without a fragment");

// Operator-reviewed admission evidence, not a model's assessment of permission.
export const PublicSourceSchema = z
  .object({
    originUrl: PublicUrlSchema,
    publisher: z.string().trim().min(1),
    licence: z
      .object({
        label: z.string().trim().min(1),
        termsUrl: PublicUrlSchema,
        checkedAt: z.iso.datetime(),
        attributionRequirements: z.string().trim().min(1),
        attribution: z.string().trim().min(1),
        permitsStorage: z.literal(true),
        permitsModification: z.literal(true),
        permitsRedistribution: z.literal(true),
      })
      .strict(),
    collectorVersion: z.string().trim().min(1),
  })
  .strict();

export const ServiceSnapshotSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    source: PublicSourceSchema,
    retrievedAt: z.iso.datetime(),
    sha256: SnapshotHashSchema,
    previousSnapshotId: SnapshotHashSchema.nullable(),
  })
  .strict();

export const SnapshotReferenceSchema = z
  .object({
    snapshotId: SnapshotHashSchema,
    sha256: SnapshotHashSchema,
  })
  .strict();

export const ServiceDerivedResultSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    kind: z.enum(["event", "conclusion", "check"]),
    computationVersion: z.string().trim().min(1),
    inputs: z.array(SnapshotReferenceSchema).min(1),
    value: z.json(),
  })
  .strict()
  .superRefine((result, ctx) => {
    if (
      new Set(result.inputs.map((input) => input.snapshotId)).size !==
      result.inputs.length
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["inputs"],
        message: "Snapshot references must be unique",
      });
    }
  });

export type PublicSource = z.infer<typeof PublicSourceSchema>;
export type ServiceSnapshot = z.infer<typeof ServiceSnapshotSchema>;
export type SnapshotReference = z.infer<typeof SnapshotReferenceSchema>;
export type ServiceDerivedResult = z.infer<typeof ServiceDerivedResultSchema>;
