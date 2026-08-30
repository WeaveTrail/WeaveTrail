import { z } from "zod";

export const WorkflowStateSchema = z.enum([
  "UPLOADED",
  "MAPPING_PROPOSED",
  "MAPPING_REVIEW_REQUIRED",
  "MAPPING_APPROVED",
  "CASE_PROPOSED",
  "CASE_REVIEW_REQUIRED",
  "CASE_APPROVED",
  "INPUT_REVIEW_REQUIRED",
  "REPLAYED",
  "EXPORTED",
]);

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

export const WORKFLOW_TRANSITIONS = {
  UPLOADED: ["MAPPING_PROPOSED", "INPUT_REVIEW_REQUIRED"],
  MAPPING_PROPOSED: [
    "MAPPING_REVIEW_REQUIRED",
    "MAPPING_APPROVED",
    "INPUT_REVIEW_REQUIRED",
  ],
  MAPPING_REVIEW_REQUIRED: ["MAPPING_PROPOSED", "INPUT_REVIEW_REQUIRED"],
  MAPPING_APPROVED: ["CASE_PROPOSED", "INPUT_REVIEW_REQUIRED"],
  CASE_PROPOSED: [
    "CASE_REVIEW_REQUIRED",
    "CASE_APPROVED",
    "INPUT_REVIEW_REQUIRED",
  ],
  CASE_REVIEW_REQUIRED: ["CASE_PROPOSED", "INPUT_REVIEW_REQUIRED"],
  CASE_APPROVED: ["REPLAYED", "INPUT_REVIEW_REQUIRED"],
  INPUT_REVIEW_REQUIRED: ["UPLOADED"],
  REPLAYED: ["EXPORTED"],
  EXPORTED: [],
} as const satisfies Record<WorkflowState, readonly WorkflowState[]>;

export type WorkflowTransitionResult =
  | { accepted: true; state: WorkflowState }
  | {
      accepted: false;
      code: "ILLEGAL_WORKFLOW_TRANSITION";
      from: WorkflowState;
      to: WorkflowState;
    };

export function applyTransition(
  from: WorkflowState,
  to: WorkflowState,
): WorkflowTransitionResult {
  const legalTargets: readonly WorkflowState[] = WORKFLOW_TRANSITIONS[from];

  if (legalTargets.includes(to)) {
    return { accepted: true, state: to };
  }

  return {
    accepted: false,
    code: "ILLEGAL_WORKFLOW_TRANSITION",
    from,
    to,
  };
}
