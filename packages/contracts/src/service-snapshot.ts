import { z } from "zod";

export const SnapshotHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

const PublicUrlSchema = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !value.includes("#")
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

function isoDatetimeIsAfter(left: string, right: string): boolean {
  const split = (value: string) => {
    const match = /^(.*?)(?:\.(\d+))?Z$/.exec(value);
    if (!match?.[1]) throw new Error("Expected a validated UTC ISO datetime");
    return { seconds: match[1], fraction: match[2] ?? "" };
  };
  const leftParts = split(left);
  const rightParts = split(right);
  if (leftParts.seconds !== rightParts.seconds) {
    return leftParts.seconds > rightParts.seconds;
  }
  const precision = Math.max(
    leftParts.fraction.length,
    rightParts.fraction.length,
  );
  return (
    leftParts.fraction.padEnd(precision, "0") >
    rightParts.fraction.padEnd(precision, "0")
  );
}

export function permissionWasReviewedBy(
  source: z.infer<typeof PublicSourceSchema>,
  instant: string,
): boolean {
  return !isoDatetimeIsAfter(source.licence.checkedAt, instant);
}

export const ServiceSnapshotSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    source: PublicSourceSchema,
    retrievedAt: z.iso.datetime(),
    sha256: SnapshotHashSchema,
    previousSnapshotId: SnapshotHashSchema.nullable(),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    if (!permissionWasReviewedBy(snapshot.source, snapshot.retrievedAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["source", "licence", "checkedAt"],
        message: "Permission must be reviewed no later than retrieval",
      });
    }
  });

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
