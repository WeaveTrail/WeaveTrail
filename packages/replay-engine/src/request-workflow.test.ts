import { describe, expect, it } from "vitest";

import { RequestWorkflow } from "./request-workflow";

describe("request workflow", () => {
  it("rejects an illegal transition without changing state or history", () => {
    const workflow = new RequestWorkflow();

    expect(workflow.transition("REPLAYED")).toEqual({
      accepted: false,
      code: "ILLEGAL_WORKFLOW_TRANSITION",
      from: "UPLOADED",
      to: "REPLAYED",
    });
    expect(workflow.state).toBe("UPLOADED");
    expect(workflow.history).toEqual(["UPLOADED"]);
  });
});
