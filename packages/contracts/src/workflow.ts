import { z } from "zod";

export const WorkflowStateSchema = z.enum([
  "UPLOADED",
  "MAPPING_PROPOSED",
  "MAPPING_APPROVED",
  "CASE_PROPOSED",
  "CASE_APPROVED",
  "REPLAYED",
  "EXPORTED",
]);

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;
