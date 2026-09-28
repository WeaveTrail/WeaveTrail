import { z } from "zod";
import { ListingSourceSchema } from "./instrument-resolution";

const Text = z.string().trim().min(1);
const Version = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const unique = <T>(values: T[]) => new Set(values).size === values.length;

export const CoverageWindowSchema = z
  .object({ start: z.iso.date(), endInclusive: z.iso.date() })
  .strict()
  .refine(
    (window) => window.start <= window.endInclusive,
    "Invalid date window",
  );

export const CoverageResolutionSchema = z.enum(["DAILY", "INTRADAY"]);
export const CoverageDatasetSchema = z
  .object({
    datasetId: Text,
    acquisitionRecord: Text,
    acquisitionScope: z.enum(["bounded-window", "complete-series"]),
    instrumentFamily: z
      .object({
        kind: z.enum([
          "market",
          "index",
          "index-family",
          "instrument-family",
          "series",
        ]),
        value: Text,
      })
      .strict(),
    fields: z.array(Text).min(1).refine(unique, "Duplicate fields"),
    dateWindow: CoverageWindowSchema,
    resolution: z.literal("DAILY"),
    source: ListingSourceSchema,
    observations: z
      .array(
        z
          .object({
            instrumentId: Text,
            date: z.iso.date(),
            rowNumber: z.string().regex(/^[1-9]\d*$/),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((dataset, ctx) => {
    if (
      dataset.source.sourceId !== dataset.datasetId ||
      dataset.source.reference.kind !== "committed"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["source"],
        message: "Expected this dataset's committed source",
      });
    }
    const identities = new Set<string>();
    const rowNumbers = new Set<string>();
    for (const observation of dataset.observations) {
      const identity = JSON.stringify([
        observation.instrumentId,
        observation.date,
      ]);
      if (identities.has(identity) || rowNumbers.has(observation.rowNumber)) {
        ctx.addIssue({
          code: "custom",
          path: ["observations"],
          message: "Conflicting or duplicate observation identity",
        });
      }
      identities.add(identity);
      rowNumbers.add(observation.rowNumber);
      if (
        observation.date < dataset.dateWindow.start ||
        observation.date > dataset.dateWindow.endInclusive
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["observations"],
          message: "Observation outside declared date window",
        });
      }
    }
  });

/** Derived from pinned acquisition records; never a promise of live coverage. */
export const CoverageManifestSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    derivationVersion: z.literal("published-coverage-v1"),
    asOf: z.iso.datetime(),
    datasets: z.array(CoverageDatasetSchema).min(1),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const newest = [
      ...manifest.datasets.map((dataset) => dataset.source.retrievedAt),
    ]
      .sort((a, b) => Date.parse(a) - Date.parse(b))
      .at(-1);
    if (manifest.asOf !== newest) {
      ctx.addIssue({
        code: "custom",
        path: ["asOf"],
        message: "asOf must be the newest recorded retrieval",
      });
    }
    for (const key of ["datasetId", "acquisitionRecord"] as const) {
      if (!unique(manifest.datasets.map((dataset) => dataset[key]))) {
        ctx.addIssue({
          code: "custom",
          path: ["datasets"],
          message: `Duplicate ${key}`,
        });
      }
    }
    const artifacts = manifest.datasets.map(
      (dataset) => dataset.source.reference,
    );
    if (
      !unique(
        artifacts.map((ref) =>
          ref.kind === "committed" ? ref.artifactId : ref.snapshotId,
        ),
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["datasets"],
        message: "Duplicate artifact",
      });
    }
  });

export const CoverageReasonCodeSchema = z.enum([
  "OUTSIDE_COVERAGE",
  "RESOLUTION_TOO_COARSE",
  "DEFINITION_NOT_BOUND",
]);

/** Canonical identity comes from the exact dated resolver, never fuzzy matching. */
export const ClaimCoverageRequestSchema = z
  .object({
    instrumentId: Text,
    dateWindow: CoverageWindowSchema,
    field: Text,
    resolution: CoverageResolutionSchema,
    definition: z
      .object({ definitionId: Text, version: Version })
      .strict()
      .optional(),
  })
  .strict();

/** Supplied by trusted computation code, not by a model or a request. */
export const ClaimCoverageDefinitionSchema = z
  .object({
    definitionId: Text,
    version: Version,
    field: Text,
    resolution: CoverageResolutionSchema,
  })
  .strict();

export type CoverageManifest = z.infer<typeof CoverageManifestSchema>;
export type CoverageDataset = z.infer<typeof CoverageDatasetSchema>;
export type CoverageReasonCode = z.infer<typeof CoverageReasonCodeSchema>;
export type ClaimCoverageRequest = z.infer<typeof ClaimCoverageRequestSchema>;
export type ClaimCoverageDefinition = z.infer<
  typeof ClaimCoverageDefinitionSchema
>;

const ResultBase = {
  coverage: z
    .object({
      schemaVersion: z.literal("1.0"),
      derivationVersion: z.literal("published-coverage-v1"),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  request: ClaimCoverageRequestSchema,
};

export const ClaimCoverageResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      ...ResultBase,
      status: z.literal("UNCONFIRMABLE"),
      reasonCode: CoverageReasonCodeSchema,
    })
    .strict(),
  z
    .object({
      ...ResultBase,
      status: z.literal("READY"),
      definition: ClaimCoverageDefinitionSchema,
      sources: z
        .array(
          z
            .object({
              datasetId: Text,
              source: ListingSourceSchema,
              observations: CoverageDatasetSchema.shape.observations,
            })
            .strict(),
        )
        .min(1),
    })
    .strict(),
]);
export type ClaimCoverageResult = z.infer<typeof ClaimCoverageResultSchema>;
