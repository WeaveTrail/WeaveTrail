import { z } from "zod";
import { SchemaMappingProposalSchema } from "./schema-mapping";

export const MappingReceiptSchema = z
  .string()
  .min(1)
  .max(100_000)
  .regex(/^[A-Za-z0-9_-]+$/);

// Provider model identifiers and raw traces are deliberately absent.
export const MappingResponseSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("fixture"),
      proposal: SchemaMappingProposalSchema,
    })
    .strict(),
  z
    .object({
      mode: z.literal("ai"),
      proposal: SchemaMappingProposalSchema,
      mappingReceipt: MappingReceiptSchema,
    })
    .strict(),
]);

export type MappingResponse = z.infer<typeof MappingResponseSchema>;
