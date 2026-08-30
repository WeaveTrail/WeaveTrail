import { z } from "zod";

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const NormalizedEventTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}Z$/);

export const DatasetProfileSchema = z
  .object({
    canonicalDatasetHash: HashSchema,
    instrumentIds: z.array(z.string().min(1)),
    actorIds: z.array(z.string().min(1)),
    earliestEventTime: NormalizedEventTimeSchema,
    latestEventTime: NormalizedEventTimeSchema,
  })
  .strict();

export type DatasetProfile = z.infer<typeof DatasetProfileSchema>;
