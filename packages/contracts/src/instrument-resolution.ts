import { z } from "zod";
import {
  permissionWasReviewedBy,
  PublicSourceSchema,
  SnapshotHashSchema,
  SnapshotReferenceSchema,
} from "./service-snapshot";

const TextSchema = z.string().trim().min(1);
const DateSchema = z.iso.date();

export const ListingSourceReferenceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("committed"),
      artifactId: TextSchema,
      sha256: SnapshotHashSchema,
      originalBytes: z
        .array(
          z
            .object({
              path: TextSchema,
              sha256: SnapshotHashSchema,
            })
            .strict(),
        )
        .min(1),
    })
    .strict(),
  SnapshotReferenceSchema.extend({ kind: z.literal("service") }).strict(),
]);

export const ListingSourceSchema = z
  .object({
    sourceId: TextSchema,
    reference: ListingSourceReferenceSchema,
    provenanceRecordUrl: z.url(),
    source: PublicSourceSchema,
    retrievedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!permissionWasReviewedBy(value.source, value.retrievedAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["source", "licence", "checkedAt"],
        message: "Permission must be reviewed before retrieval",
      });
    }
  });

export const InstrumentIdentifierKindSchema = z.enum([
  "SHORT_CODE",
  "ISIN",
  "KOREAN_NAME",
  "ENGLISH_NAME",
  "ABBREVIATION",
  "FORMER_NAME",
]);

export const InstrumentIdentifierSchema = z
  .object({
    kind: InstrumentIdentifierKindSchema,
    value: TextSchema,
    validFrom: DateSchema,
    validThrough: DateSchema,
    evidence: z
      .object({
        sourceId: TextSchema,
        rowNumber: z.string().regex(/^[1-9]\d*$/),
        column: TextSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((identifier, ctx) => {
    if (identifier.validThrough < identifier.validFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["validThrough"],
        message: "Identifier validity must not run backwards",
      });
    }
    if (
      identifier.kind === "ISIN" &&
      !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(identifier.value)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Expected a 12-character ISIN",
      });
    }
  });

export const ListedInstrumentSchema = z
  .object({
    instrumentId: TextSchema,
    kind: z.enum(["INSTRUMENT", "INDEX"]),
    identifiers: z.array(InstrumentIdentifierSchema).min(1),
  })
  .strict();

export const InstrumentListingSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    listingId: TextSchema,
    sources: z.array(ListingSourceSchema).min(1),
    instruments: z.array(ListedInstrumentSchema).min(1),
  })
  .strict()
  .superRefine((listing, ctx) => {
    const sourceIds = new Set(listing.sources.map(({ sourceId }) => sourceId));
    if (sourceIds.size !== listing.sources.length) {
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: "Listing source identities must be unique",
      });
    }
    if (
      new Set(listing.instruments.map(({ instrumentId }) => instrumentId))
        .size !== listing.instruments.length
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["instruments"],
        message:
          "Instrument identities must be unique; combine their dated names explicitly",
      });
    }
    listing.instruments.forEach((instrument, index) => {
      instrument.identifiers.forEach((identifier, identifierIndex) => {
        if (!sourceIds.has(identifier.evidence.sourceId)) {
          ctx.addIssue({
            code: "custom",
            path: [
              "instruments",
              index,
              "identifiers",
              identifierIndex,
              "evidence",
              "sourceId",
            ],
            message: "Identifier must reference a supplied listing source",
          });
        }
      });
    });
  });

export const InstrumentResolutionRequestSchema = z
  .object({
    query: TextSchema.max(256),
    eventDate: DateSchema,
  })
  .strict();

export const DailyQuoteBindingSchema = z
  .object({
    datasetId: TextSchema,
    instrumentId: TextSchema,
    source: ListingSourceSchema,
    availableDates: z
      .array(DateSchema)
      .min(1)
      .refine(
        (dates) => new Set(dates).size === dates.length,
        "Quote dates must be unique",
      ),
  })
  .strict();

const CandidateSchema = z
  .object({
    instrumentId: TextSchema,
    kind: z.enum(["INSTRUMENT", "INDEX"]),
    reasons: z.array(InstrumentIdentifierSchema).min(1),
  })
  .strict();

const ResolutionBaseSchema = InstrumentResolutionRequestSchema.extend({
  schemaVersion: z.literal("1.0"),
  resolverVersion: z.literal("exact-dated-identifiers-v1"),
  listing: z
    .object({
      listingId: TextSchema,
      sha256: SnapshotHashSchema,
      sources: z.array(ListingSourceSchema).min(1),
    })
    .strict(),
});

export const InstrumentResolutionSchema = z.discriminatedUnion("status", [
  ResolutionBaseSchema.extend({
    status: z.literal("RESOLVED"),
    candidate: CandidateSchema,
    quotes: z.discriminatedUnion("status", [
      z
        .object({
          status: z.literal("LINKED"),
          links: z.array(DailyQuoteBindingSchema).min(1),
        })
        .strict(),
      z
        .object({
          status: z.literal("UNAVAILABLE"),
          reason: z.literal("NO_ADMITTED_QUOTES_ON_EVENT_DATE"),
        })
        .strict(),
    ]),
  }).strict(),
  ResolutionBaseSchema.extend({
    status: z.literal("REVIEW_REQUIRED"),
    reason: z.literal("AMBIGUOUS_NAME"),
    candidates: z.array(CandidateSchema).min(2),
  }).strict(),
  ResolutionBaseSchema.extend({
    status: z.literal("UNRESOLVED"),
    reason: z.enum(["NO_EXACT_MATCH", "NAME_NOT_VALID_ON_EVENT_DATE"]),
  }).strict(),
]);

export type ListingSource = z.infer<typeof ListingSourceSchema>;
export type InstrumentIdentifier = z.infer<typeof InstrumentIdentifierSchema>;
export type ListedInstrument = z.infer<typeof ListedInstrumentSchema>;
export type InstrumentListing = z.infer<typeof InstrumentListingSchema>;
export type InstrumentResolutionRequest = z.infer<
  typeof InstrumentResolutionRequestSchema
>;
export type DailyQuoteBinding = z.infer<typeof DailyQuoteBindingSchema>;
export type InstrumentResolution = z.infer<typeof InstrumentResolutionSchema>;
