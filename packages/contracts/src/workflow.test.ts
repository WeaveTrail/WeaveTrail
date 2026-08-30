import { describe, expect, it } from "vitest";

import {
  applyTransition,
  WORKFLOW_TRANSITIONS,
  WorkflowStateSchema,
} from "./workflow";

describe("workflow transitions", () => {
  const states = WorkflowStateSchema.options;

  for (const from of states) {
    for (const to of states) {
      const isLegal = (
        WORKFLOW_TRANSITIONS[from] as readonly string[]
      ).includes(to);

      it(`${from} -> ${to} is ${isLegal ? "accepted" : "rejected"}`, () => {
        const result = applyTransition(from, to);

        if (isLegal) {
          expect(result).toEqual({ accepted: true, state: to });
        } else {
          expect(result).toEqual({
            accepted: false,
            code: "ILLEGAL_WORKFLOW_TRANSITION",
            from,
            to,
          });
        }
      });
    }
  }

  it("routes every pre-replay state to input review and blocks replay there", () => {
    const preReplayStates = states.filter(
      (state) =>
        !["INPUT_REVIEW_REQUIRED", "REPLAYED", "EXPORTED"].includes(state),
    );

    for (const state of preReplayStates) {
      expect(applyTransition(state, "INPUT_REVIEW_REQUIRED")).toEqual({
        accepted: true,
        state: "INPUT_REVIEW_REQUIRED",
      });
    }

    expect(applyTransition("INPUT_REVIEW_REQUIRED", "REPLAYED")).toEqual({
      accepted: false,
      code: "ILLEGAL_WORKFLOW_TRANSITION",
      from: "INPUT_REVIEW_REQUIRED",
      to: "REPLAYED",
    });
    expect(applyTransition("INPUT_REVIEW_REQUIRED", "UPLOADED")).toEqual({
      accepted: true,
      state: "UPLOADED",
    });
  });
});
