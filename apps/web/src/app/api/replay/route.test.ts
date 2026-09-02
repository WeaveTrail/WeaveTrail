import { describe, expect, it } from "vitest";

import type {
  ApprovalRecord,
  SchemaMappingProposal,
} from "@weavetrail/contracts";
import { sha256Canonical } from "@weavetrail/replay-engine";
import {
  committedReplayScenarios,
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
} from "@weavetrail/scenarios";

import { POST } from "./route";

const scenario = "concentrated-buy-dialect-a.csv" as const;

function request(body: unknown): Request {
  return new Request("http://localhost/api/replay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function approval(
  proposal: SchemaMappingProposal,
  overrides: ApprovalRecord["overrides"] = [],
): ApprovalRecord {
  return {
    approvedArtifactHash: sha256Canonical(proposal),
    reviewerRef: "reviewer:test",
    decision: "APPROVED",
    overrides,
    approvedAt: "2026-08-31T00:00:00Z",
  };
}

function reviewFieldIndex(
  proposal: SchemaMappingProposal,
  sourceColumn: string,
): number {
  const index = proposal.fields.findIndex(
    (field) => field.sourceColumn === sourceColumn,
  );
  expect(proposal.fields[index]).toMatchObject({
    sourceColumn,
    status: "REVIEW_REQUIRED",
  });
  return index;
}

function validBody() {
  return {
    scenario,
    mutation: "baseline" as const,
    rows: committedReplayScenarios[scenario].rows,
    mappingApproval: approval(concentratedBuyDialectAProposal),
  };
}

describe("POST /api/replay approved mapping boundary", () => {
  it("replays dialect A with an empty override list to the golden hash", async () => {
    const response = await POST(request(validBody()));
    const result = await response.json();

    expect(validBody().mappingApproval.overrides).toEqual([]);
    expect(response.status).toBe(200);
    expect(result.replay.canonicalResultHash).toBe(
      "27c4b5a36f4ba37fe35dd6b40f203e176f9ff097f1fbb85f5372a461287a52b5",
    );
  });

  it.each(["baseline", "shuffle", "duplicate"] as const)(
    "re-derives approved rows with mutation %s",
    async (mutation) => {
      const response = await POST(request({ ...validBody(), mutation }));
      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result).toMatchObject({
        mode: "fixture",
        scenario,
        mutation,
        replay: {
          canonicalResultHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      });
      expect(result.replay).not.toHaveProperty("events");
    },
  );

  it("requires a mapping approval", async () => {
    const { mappingApproval: _, ...body } = validBody();
    void _;
    const response = await POST(request(body));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      issues: [{ code: "APPROVAL_RECORD_REQUIRED" }],
    });
  });

  it("rejects a rejected approval", async () => {
    const rejected = validBody();
    rejected.mappingApproval = {
      ...rejected.mappingApproval,
      decision: "REJECTED",
    };
    expect(await (await POST(request(rejected))).json()).toMatchObject({
      issues: [{ code: "APPROVAL_REJECTED" }],
    });
  });

  it("rejects a forged approval", async () => {
    const forged = validBody();
    forged.mappingApproval = {
      ...forged.mappingApproval,
      approvedArtifactHash: "f".repeat(64),
    };
    expect(await (await POST(request(forged))).json()).toMatchObject({
      issues: [{ code: "APPROVED_ARTIFACT_HASH_MISMATCH" }],
    });
  });

  it("rejects rows from another artifact without a result hash", async () => {
    const body = {
      ...validBody(),
      rows: committedReplayScenarios["concentrated-buy-dialect-b.jsonl"].rows,
    };
    const response = await POST(request(body));
    const result = await response.json();
    expect(response.status).toBe(422);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SOURCE_ARTIFACT_NOT_APPROVED" }),
      ]),
    );
    expect(result).not.toHaveProperty("canonicalResultHash");
  });

  it("rejects a changed value that claims a committed source coordinate", async () => {
    const base = validBody();
    const body = {
      ...base,
      rows: [
        {
          ...base.rows[0]!,
          values: { ...base.rows[0]!.values, px: "999.99" },
        },
      ],
    };
    const response = await POST(request(body));
    const result = await response.json();
    expect(response.status).toBe(422);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SOURCE_ROW_MISMATCH",
          path: ["rows", 0, "values", "px"],
          message: expect.stringContaining(
            `Source row ${base.rows[0]!.coordinate.rowNumber} column px`,
          ),
        }),
      ]),
    );
    expect(result).not.toHaveProperty("replay");
  });

  it("rejects omitted declared rows without returning a result hash", async () => {
    const base = validBody();
    const response = await POST(
      request({ ...base, rows: [base.rows[0]!, base.rows[2]!] }),
    );
    const result = await response.json();

    expect(response.status).toBe(422);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "SOURCE_ROW_MISSING",
        path: ["rows", 3],
      }),
      expect.objectContaining({
        code: "SOURCE_ROW_MISSING",
        path: ["rows", 5],
      }),
    ]);
    expect(result).not.toHaveProperty("canonicalResultHash");
    expect(result).not.toHaveProperty("replay");
  });

  it("rejects an omitted approved column with its row and column", async () => {
    const base = validBody();
    const values = { ...base.rows[0]!.values };
    delete values.actor;
    const response = await POST(
      request({
        ...base,
        rows: [{ ...base.rows[0]!, values }, ...base.rows.slice(1)],
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(422);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "APPROVED_SOURCE_COLUMN_MISSING",
        path: ["rows", 2, "values", "actor"],
      }),
    ]);
    expect(result).not.toHaveProperty("canonicalResultHash");
    expect(result).not.toHaveProperty("replay");
  });

  it("replays both committed dialects to the same result hash", async () => {
    const dialectA = await POST(request(validBody()));
    const dialectBScenario = "concentrated-buy-dialect-b.jsonl" as const;
    const sourceNoteIndex = reviewFieldIndex(
      concentratedBuyDialectBProposal,
      "source_note",
    );
    const dialectB = await POST(
      request({
        scenario: dialectBScenario,
        mutation: "baseline",
        rows: committedReplayScenarios[dialectBScenario].rows,
        mappingApproval: approval(concentratedBuyDialectBProposal, [
          {
            fieldPath: `fields.${sourceNoteIndex}`,
            reason: "Reviewed the source note as intentionally unmapped.",
          },
        ]),
      }),
    );
    expect(dialectA.status).toBe(200);
    expect(dialectB.status).toBe(200);
    expect((await dialectA.json()).replay.canonicalResultHash).toBe(
      (await dialectB.json()).replay.canonicalResultHash,
    );
  });

  it("requires a field override before replaying dialect B", async () => {
    const dialectBScenario = "concentrated-buy-dialect-b.jsonl" as const;
    const sourceNoteIndex = reviewFieldIndex(
      concentratedBuyDialectBProposal,
      "source_note",
    );
    const response = await POST(
      request({
        scenario: dialectBScenario,
        mutation: "baseline",
        rows: committedReplayScenarios[dialectBScenario].rows,
        mappingApproval: approval(concentratedBuyDialectBProposal),
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(422);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "MAPPING_OVERRIDE_REQUIRED",
        path: ["fields", sourceNoteIndex],
      }),
    ]);
    expect(result).not.toHaveProperty("canonicalResultHash");
    expect(result).not.toHaveProperty("replay");
  });

  it("replays dialect B after a justified source_note override", async () => {
    const dialectBScenario = "concentrated-buy-dialect-b.jsonl" as const;
    const sourceNoteIndex = reviewFieldIndex(
      concentratedBuyDialectBProposal,
      "source_note",
    );
    const response = await POST(
      request({
        scenario: dialectBScenario,
        mutation: "baseline",
        rows: committedReplayScenarios[dialectBScenario].rows,
        mappingApproval: approval(concentratedBuyDialectBProposal, [
          {
            fieldPath: `fields.${sourceNoteIndex}`,
            reason: "Reviewed the source note as intentionally unmapped.",
          },
        ]),
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.replay.canonicalResultHash).toBe(
      "27c4b5a36f4ba37fe35dd6b40f203e176f9ff097f1fbb85f5372a461287a52b5",
    );
  });

  it("rejects a whitespace-only source_note override", async () => {
    const dialectBScenario = "concentrated-buy-dialect-b.jsonl" as const;
    const sourceNoteIndex = reviewFieldIndex(
      concentratedBuyDialectBProposal,
      "source_note",
    );
    const response = await POST(
      request({
        scenario: dialectBScenario,
        mutation: "baseline",
        rows: committedReplayScenarios[dialectBScenario].rows,
        mappingApproval: approval(concentratedBuyDialectBProposal, [
          {
            fieldPath: `fields.${sourceNoteIndex}`,
            reason: "   ",
          },
        ]),
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(422);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "MAPPING_OVERRIDE_REQUIRED",
        path: ["fields", sourceNoteIndex],
      }),
    ]);
    expect(result).not.toHaveProperty("canonicalResultHash");
    expect(result).not.toHaveProperty("replay");
  });

  it("rejects invalid JSON and caller-authored events", async () => {
    const invalidJson = await POST(
      new Request("http://localhost/api/replay", { method: "POST", body: "{" }),
    );
    expect(await invalidJson.json()).toMatchObject({
      issues: [{ code: "INVALID_JSON" }],
    });
    const response = await POST(request({ ...validBody(), events: [] }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      issues: [{ code: "INVALID_REQUEST" }],
    });
  });
});
