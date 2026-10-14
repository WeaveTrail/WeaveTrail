import { z } from "zod";
import { MappingRunRecordV2Schema } from "./mapping-run-record";

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const Id = z.string().trim().min(1).max(256);
const Integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const MappingStudySplitSchema = z.enum(["SELECT", "AUDIT", "DRIFT"]);
const Context = {
  schemaVersion: z.literal("mapping-study-run/1"),
  protocolHash: Hash,
  sessionId: Id,
  phase: z.enum(["GRID", "LIVE_ROUTE"]),
  candidateId: Id,
  familyId: Id,
  inputHash: Hash,
  evaluationSet: z
    .object({
      version: z.literal("mapping-study-inputs/1"),
      split: MappingStudySplitSchema,
      sha256: Hash,
    })
    .strict(),
};
/** Separate from historical mapping-run/1 and /2; their bytes and gates remain valid. */
export const MappingStudyRunRecordSchema = z.discriminatedUnion("outcome", [
  z
    .object({ ...MappingRunRecordV2Schema.options[0].shape, ...Context })
    .strict(),
  z
    .object({ ...MappingRunRecordV2Schema.options[1].shape, ...Context })
    .strict()
    .refine(
      (r) => r.failureClass === "OUTPUT_CONTRACT" || r.parsedOutput === null,
      {
        path: ["parsedOutput"],
        message: "Unparseable or non-retainable output must be null",
      },
    ),
  z
    .object({ ...MappingRunRecordV2Schema.options[2].shape, ...Context })
    .strict(),
]);
export type MappingStudyRunRecord = z.infer<typeof MappingStudyRunRecordSchema>;

/** Hash references only. No approvals, model envelopes, credentials or gold. */
export const MappingStudyRouteRecordSchema = z
  .object({
    schemaVersion: z.literal("mapping-study-route/1"),
    protocolHash: Hash,
    sessionId: Id,
    split: z.literal("AUDIT"),
    familyId: Id,
    dialectId: Id,
    inputHash: Hash,
    repeat: Integer.refine((n) => n > 0),
    mode: z.enum(["SYNTHETIC", "LIVE_SAMPLE"]),
    primaryRunHash: Hash,
    escalationRunHash: Hash.nullable(),
    selectedRunHash: Hash.nullable(),
    reason: z.enum([
      "PRIMARY_OFFERABLE",
      "PRIMARY_PROVIDER_FAILED",
      "PRIMARY_REJECTED",
      "PRIMARY_REVIEW_REQUIRED",
    ]),
    stop: z.enum(["NONE", "DEADLINE", "LIMIT", "STORE_FAILED"]),
    attemptedCalls: Integer.max(2),
    reservations: Integer.max(2),
    latencyMs: Integer,
    finalStatus: z.enum(["PROPOSAL_OFFERABLE", "REVIEW_REQUIRED"]),
  })
  .strict();
export type MappingStudyRouteRecord = z.infer<
  typeof MappingStudyRouteRecordSchema
>;
