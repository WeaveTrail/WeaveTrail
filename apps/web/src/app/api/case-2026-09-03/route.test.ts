import { describe, expect, it } from "vitest";

import { sha256Canonical } from "@weavetrail/replay-engine";

import { publishedCaseProposal } from "../../../lib/published-case";
import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/case-2026-09-03", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const approval = (hash: string) => ({
  approvedArtifactHash: hash,
  reviewerRef: "reviewer:local-lab",
  decision: "APPROVED" as const,
  overrides: [],
  approvedAt: "2026-09-07T00:00:00Z",
});

describe("the published case route", () => {
  it("runs the case for an approval that covers this exact scope", async () => {
    const { proposal } = publishedCaseProposal();
    const response = await POST(
      request({ approval: approval(sha256Canonical(proposal)) }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.evaluation.result).toBe("SUPPORTED");
    expect(body.evaluation.analysis.rank).toMatchObject({
      position: "1",
      populationSize: "45",
      interpretation: "POSITION_WITHIN_DECLARED_RANGE_NOT_PROBABILITY",
    });
    expect(body.canonicalResultHash).toBe(
      "159ffac0f1845b89239ab905b3f5ab1f81ad7212e1ccbbf8ea74b3474b696a89",
    );
    expect(body.sourceTrace.length).toBeGreaterThan(0);
  });

  it("refuses an approval bound to a different artifact", async () => {
    const response = await POST(
      request({ approval: approval("f".repeat(64)) }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.state).toBe("CASE_REVIEW_REQUIRED");
    expect(body).not.toHaveProperty("canonicalResultHash");
  });

  it("refuses a request that carries no approval", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("APPROVAL_REQUIRED");
  });
});
