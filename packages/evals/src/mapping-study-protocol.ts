import { z } from "zod";
import { MappingStudySplitSchema } from "@weavetrail/contracts";
import { sha256Canonical } from "@weavetrail/replay-engine";
import { sha256 } from "./mapping-corpus-generator";

export const StudyHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const Id = z.string().trim().min(1).max(256);
export const StudyCountSchema = z
  .object({
    numerator: z.string().regex(/^-?(0|[1-9][0-9]*)$/u),
    denominator: z.string().regex(/^[1-9][0-9]*$/u),
  })
  .strict();
const Stack = z
  .object({
    adapterVersion: Id,
    promptVersion: Id,
    outputSchemaVersion: z.literal("mapping-fields/2"),
    validatorVersion: z.literal("mapping-validator/3"),
  })
  .strict();
export const MappingStudyProtocolSchema = z
  .object({
    version: z.literal("mapping-study-protocol/1"),
    status: z.enum(["PLANNED", "AUDITED"]),
    // These are content bindings, not dates inferred from a result.
    registrationHash: StudyHashSchema,
    auditHash: StudyHashSchema.nullable(),
    selectionRule: z.literal("mapping-study-selection/1"),
    routingPolicy: z.literal("mapping-routing/1"),
    routingPair: z
      .object({
        primary: Id,
        escalation: Id,
        selectionDecisionHash: StudyHashSchema,
      })
      .strict()
      .nullable(),
    liveSampleDialectIds: z.array(Id),
    routeTimeoutMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    repeats: z.number().int().positive().max(100),
    candidates: z
      .array(
        z
          .object({
            id: Id,
            provider: Id,
            requestedModel: Id,
            stack: Stack,
          })
          .strict(),
      )
      .min(1)
      .max(4),
    sources: z
      .array(
        z
          .object({
            split: MappingStudySplitSchema,
            inputsHash: StudyHashSchema,
            goldHash: StudyHashSchema,
            familiesHash: StudyHashSchema,
            driftRelationsHash: StudyHashSchema.optional(),
            seal: z
              .object({
                status: z.enum(["UNSEALED", "SEALED"]),
                independentReviewHash: StudyHashSchema.nullable(),
              })
              .strict(),
          })
          .strict(),
      )
      .min(1)
      .max(3),
    pricesHash: StudyHashSchema,
    references: z
      .object({
        b0ConfigurationHash: StudyHashSchema,
        b1ConfigurationHash: StudyHashSchema,
        devHash: StudyHashSchema,
      })
      .strict(),
    analysis: z
      .object({
        version: z.literal("family-bootstrap/1"),
        seed: Id,
        resamples: z.number().int().min(100).max(100_000),
        tailProbability: StudyCountSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      p.routingPair &&
      (p.routingPair.primary === p.routingPair.escalation ||
        [p.routingPair.primary, p.routingPair.escalation].some(
          (id) => !p.candidates.some((c) => c.id === id),
        ))
    )
      ctx.addIssue({
        code: "custom",
        path: ["routingPair"],
        message: "Routing requires two distinct declared candidates",
      });
    if (new Set(p.liveSampleDialectIds).size !== p.liveSampleDialectIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["liveSampleDialectIds"],
        message: "Duplicate live sample dialect",
      });
    if (p.candidates.some((c) => ["B0", "B1", "ROUTED"].includes(c.id)))
      ctx.addIssue({
        code: "custom",
        path: ["candidates"],
        message: "Reserved reference/route identity",
      });
    for (const [path, values] of [
      ["candidates", p.candidates.map((c) => c.id)],
      [
        "candidateModels",
        p.candidates.map((c) => JSON.stringify([c.provider, c.requestedModel])),
      ],
      ["sources", p.sources.map((s) => s.split)],
    ] as const)
      if (new Set(values).size !== values.length)
        ctx.addIssue({
          code: "custom",
          path: [path],
          message: "Duplicate protocol identity",
        });
    const tail = p.analysis.tailProbability;
    if (
      BigInt(tail.numerator) <= 0n ||
      2n * BigInt(tail.numerator) >= BigInt(tail.denominator)
    )
      ctx.addIssue({
        code: "custom",
        path: ["analysis"],
        message: "Tail probability must be between zero and one half",
      });
    if (p.status === "AUDITED" && p.auditHash === null)
      ctx.addIssue({
        code: "custom",
        path: ["auditHash"],
        message: "Audited protocol requires an audit binding",
      });
    for (const [i, source] of p.sources.entries()) {
      if (source.driftRelationsHash && source.split !== "DRIFT")
        ctx.addIssue({
          code: "custom",
          path: ["sources", i, "driftRelationsHash"],
          message: "Drift relations require a DRIFT source",
        });
      if (
        source.seal.status === "SEALED" &&
        source.seal.independentReviewHash === null
      )
        ctx.addIssue({
          code: "custom",
          path: ["sources", i, "seal"],
          message: "Seal requires independent review binding",
        });
    }
  });
export type MappingStudyProtocol = z.infer<typeof MappingStudyProtocolSchema>;
export function readStudyProtocol(input: unknown) {
  const protocol = MappingStudyProtocolSchema.parse(input);
  return { protocol, hash: sha256Canonical(protocol) };
}
export type StudyBytes = { bytes: string; sha256: string };
export function checkedStudyJson(source: StudyBytes): unknown {
  if (sha256(source.bytes) !== source.sha256)
    throw new Error("Study byte hash mismatch");
  return JSON.parse(source.bytes);
}
