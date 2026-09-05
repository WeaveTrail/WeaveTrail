import { describe, expect, it } from "vitest";

import type {
  ApprovalRecord,
  CaseManifest,
  SchemaMappingProposal,
} from "@weavetrail/contracts";
import { sha256Canonical } from "@weavetrail/replay-engine";
import {
  committedReplayScenarios,
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
  rapidPriceLiftScenarios,
} from "@weavetrail/scenarios";

import { ReplayReviewResponseSchema } from "@weavetrail/contracts";
import { POST as handlePost } from "./route";

// Exercise every rejection against the exact serialized request, including own
// properties and array bounds. No production path helper is used in this oracle.
async function POST(request: Request) {
  const raw = await request.clone().text();
  const response = await handlePost(request);
  if (response.status === 422) {
    const result = ReplayReviewResponseSchema.parse(
      await response.clone().json(),
    );
    for (const key of ["replay", "evaluation", "canonicalResultHash"]) {
      expect(result).not.toHaveProperty(key);
    }
    for (const issue of result.issues) {
      if (issue.code === "INVALID_JSON") {
        expect(issue.path).toEqual([]);
        continue;
      }
      let value: unknown = JSON.parse(raw);
      for (const segment of issue.path) {
        expect(value).not.toBeNull();
        expect(typeof value).toBe("object");
        if (Array.isArray(value)) {
          expect(typeof segment).toBe("number");
          expect(Number.isInteger(segment)).toBe(true);
          expect(segment).toBeGreaterThanOrEqual(0);
          expect(segment).toBeLessThan(value.length);
        } else {
          expect(typeof segment).toBe("string");
        }
        expect(Object.hasOwn(value as object, segment)).toBe(true);
        value = (value as Record<string | number, unknown>)[segment];
      }
    }
  }
  return response;
}

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

function rapidBody() {
  const rapidScenario = "rapid-price-lift-supported.csv" as const;
  const fixture = committedReplayScenarios[rapidScenario];
  return {
    scenario: rapidScenario,
    mutation: "baseline" as const,
    rows: fixture.rows,
    mappingApproval: approval(fixture.mappingProposal),
    caseManifest: fixture.manifest,
  };
}

describe("POST /api/replay approved mapping boundary", () => {
  it("replays dialect A with an empty override list to the golden hash", async () => {
    const response = await POST(request(validBody()));
    const result = await response.json();

    expect(validBody().mappingApproval.overrides).toEqual([]);
    expect(response.status).toBe(200);
    expect(result.workflowState).toBe("MAPPING_APPROVED");
    expect(result.replay.canonicalResultHash).toBe(
      "8ecbc17157e5d95bc204e9b44425b7a0b2cbee402a906de75619a689c81b13ff",
    );
    expect(result).not.toHaveProperty("evaluation");
  });

  it("returns an approved rapid price lift result", async () => {
    const response = await POST(request(rapidBody()));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.workflowState).toBe("REPLAYED");
    expect(result).toMatchObject({
      evaluation: {
        ruleId: "RAPID_PRICE_LIFT",
        ruleVersion: "1.1",
        result: "SUPPORTED",
        findings: expect.arrayContaining([
          expect.objectContaining({ gate: "PRICE_CHANGE", passed: true }),
          expect.objectContaining({
            gate: "REMOVAL_SENSITIVITY",
            passed: true,
          }),
        ]),
        sensitivity: { comparison: "MECHANICAL_METRIC_COMPARISON" },
      },
    });
  });

  it.each(Object.entries(rapidPriceLiftScenarios))(
    "replays declared scenario %s to its expected result",
    async (scenarioName, fixture) => {
      const response = await POST(
        request({
          scenario: scenarioName,
          mutation: "baseline",
          rows: fixture.rows,
          mappingApproval: approval(fixture.mappingProposal),
          caseManifest: fixture.manifest,
        }),
      );
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.workflowState).toBe("REPLAYED");
      expect(result.evaluation.result).toBe(fixture.expectedResult);
      expect(result).not.toHaveProperty("issues");
    },
  );

  it("replays insufficient evidence as an inconclusive result without review issues", async () => {
    const scenarioName = "rapid-price-lift-insufficient-evidence.csv";
    const fixture = rapidPriceLiftScenarios[scenarioName];
    const response = await POST(
      request({
        scenario: scenarioName,
        mutation: "baseline",
        rows: fixture.rows,
        mappingApproval: approval(fixture.mappingProposal),
        caseManifest: fixture.manifest,
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.workflowState).toBe("REPLAYED");
    expect(result.evaluation).toMatchObject({
      result: "INCONCLUSIVE",
      reason: "REMOVAL_LEAVES_INSUFFICIENT_EVENTS",
      findings: [],
      sensitivity: null,
    });
    expect(result).not.toHaveProperty("issues");
  });

  it("rejects an approved manifest actor outside the dataset profile before evaluation", async () => {
    const body = rapidBody();
    const proposal = {
      ...body.caseManifest,
      hypothesis: {
        ...body.caseManifest.hypothesis,
        actorIds: ["participant-absent"],
      },
    };
    const { approval: _, ...artifact } = proposal;
    void _;
    const caseManifest: CaseManifest = {
      ...proposal,
      approval: {
        ...body.caseManifest.approval,
        approvedArtifactHash: sha256Canonical(artifact),
      },
    };
    const response = await POST(request({ ...body, caseManifest }));
    const result = await response.json();

    expect(response.status).toBe(422);
    expect(result).toMatchObject({
      workflowState: "CASE_REVIEW_REQUIRED",
      issues: [{ code: "ACTOR_OUTSIDE_DATASET_PROFILE" }],
    });
    expect(result).not.toHaveProperty("evaluation");
  });

  it("assigns a case approval hash mismatch to case review", async () => {
    const body = rapidBody();
    const response = await POST(
      request({
        ...body,
        caseManifest: {
          ...body.caseManifest,
          approval: {
            ...body.caseManifest.approval,
            approvedArtifactHash: "f".repeat(64),
          },
        },
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(422);
    expect(result).toMatchObject({
      workflowState: "CASE_REVIEW_REQUIRED",
      issues: [{ code: "APPROVED_ARTIFACT_HASH_MISMATCH" }],
    });
    expect(result).not.toHaveProperty("replay");
  });

  it("rejects an approved manifest window outside the dataset profile before evaluation", async () => {
    const body = rapidBody();
    const proposal = {
      ...body.caseManifest,
      hypothesis: {
        ...body.caseManifest.hypothesis,
        endTime: "2026-09-01T00:00:06Z",
      },
    };
    const { approval: _, ...artifact } = proposal;
    void _;
    const caseManifest: CaseManifest = {
      ...proposal,
      approval: {
        ...body.caseManifest.approval,
        approvedArtifactHash: sha256Canonical(artifact),
      },
    };
    const response = await POST(request({ ...body, caseManifest }));
    const result = await response.json();

    expect(response.status).toBe(422);
    expect(result).toMatchObject({
      issues: [{ code: "TIME_WINDOW_OUTSIDE_DATASET_PROFILE" }],
    });
    expect(result).not.toHaveProperty("evaluation");
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
      workflowState: "MAPPING_REVIEW_REQUIRED",
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
    expect(result.workflowState).toBe("INPUT_REVIEW_REQUIRED");
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
    expect(result.workflowState).toBe("INPUT_REVIEW_REQUIRED");
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
        path: ["rows"],
      }),
      expect.objectContaining({
        code: "SOURCE_ROW_MISSING",
        path: ["rows"],
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
        path: ["rows", 0, "values"],
        message: expect.stringContaining("Approved source column"),
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
        path: ["mappingApproval", "overrides"],
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
      "8ecbc17157e5d95bc204e9b44425b7a0b2cbee402a906de75619a689c81b13ff",
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
        path: ["mappingApproval", "overrides"],
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
      workflowState: "INPUT_REVIEW_REQUIRED",
      issues: [{ code: "INVALID_JSON" }],
    });
    const response = await POST(request({ ...validBody(), events: [] }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      workflowState: "INPUT_REVIEW_REQUIRED",
      issues: [{ code: "INVALID_REQUEST" }],
    });
  });
});

describe("request-relative review paths", () => {
  it.each([
    ["missing row", "SOURCE_ROW_MISSING", ["rows"]],
    ["changed value", "SOURCE_ROW_MISMATCH", ["rows", 0, "values", "px"]],
    ["omitted column", "APPROVED_SOURCE_COLUMN_MISSING", ["rows", 0, "values"]],
    [
      "foreign artifact",
      "SOURCE_ARTIFACT_NOT_APPROVED",
      ["rows", 0, "coordinate", "sourceArtifactHash"],
    ],
    [
      "override required",
      "MAPPING_OVERRIDE_REQUIRED",
      ["mappingApproval", "overrides"],
    ],
  ] as const)(
    "addresses %s in the submitted request",
    async (kind, code, path) => {
      const body = structuredClone(validBody());
      if (kind === "missing row") body.rows.pop();
      if (kind === "changed value") body.rows[0]!.values.px = "999.99";
      if (kind === "omitted column") delete body.rows[0]!.values.actor;
      if (kind === "foreign artifact")
        body.rows[0]!.coordinate.sourceArtifactHash = "f".repeat(64);
      const submitted =
        kind === "override required"
          ? {
              ...body,
              scenario: "concentrated-buy-dialect-b.jsonl",
              rows: committedReplayScenarios["concentrated-buy-dialect-b.jsonl"]
                .rows,
              mappingApproval: approval(concentratedBuyDialectBProposal),
            }
          : body;
      const response = await POST(request(submitted));
      expect(response.status).toBe(422);
      expect((await response.json()).issues).toEqual([
        expect.objectContaining({ code, path }),
      ]);
    },
  );

  it.each([0, 1, 3])(
    "tracks the same source row at submitted index %i for different failures",
    async (index) => {
      const original = structuredClone(validBody());
      const row = original.rows.shift()!;
      original.rows.splice(index, 0, row);
      for (const kind of ["changed", "missing"] as const) {
        const body = structuredClone(original);
        if (kind === "changed") body.rows[index]!.values.px = "999.99";
        else delete body.rows[index]!.values.actor;
        const response = await POST(request(body));
        expect(response.status).toBe(422);
        expect((await response.json()).issues).toEqual([
          expect.objectContaining({
            code:
              kind === "changed"
                ? "SOURCE_ROW_MISMATCH"
                : "APPROVED_SOURCE_COLUMN_MISSING",
            path:
              kind === "changed"
                ? ["rows", index, "values", "px"]
                : ["rows", index, "values"],
            message: expect.stringContaining(row.coordinate.sourceArtifactHash),
          }),
        ]);
      }
    },
  );

  it.each([
    [
      "missing scenario",
      [],
      (body: Record<string, unknown>) => {
        delete body.scenario;
      },
    ],
    [
      "wrong rows type",
      ["rows"],
      (body: Record<string, unknown>) => {
        body.rows = false;
      },
    ],
    [
      "missing coordinate child",
      ["rows", 0, "coordinate"],
      (body: Record<string, unknown>) => {
        body.rows = [{ coordinate: { rowNumber: "2" }, values: {} }];
      },
    ],
    [
      "missing mapping approval",
      [],
      (body: Record<string, unknown>) => {
        delete body.mappingApproval;
      },
    ],
    [
      "missing overrides",
      ["mappingApproval"],
      (body: Record<string, unknown>) => {
        delete (body.mappingApproval as Record<string, unknown>).overrides;
      },
    ],
    [
      "rejected approval",
      ["mappingApproval", "decision"],
      (body: Record<string, unknown>) => {
        (body.mappingApproval as Record<string, unknown>).decision = "REJECTED";
      },
    ],
    [
      "forged approval",
      ["mappingApproval", "approvedArtifactHash"],
      (body: Record<string, unknown>) => {
        (body.mappingApproval as Record<string, unknown>).approvedArtifactHash =
          "f".repeat(64);
      },
    ],
    [
      "duplicate coordinate",
      ["rows"],
      (body: Record<string, unknown>) => {
        const rows = body.rows as unknown[];
        rows.push(rows[0]);
      },
    ],
  ] as const)("resolves %s", async (_, path, change) => {
    const body = structuredClone(validBody());
    change(body);
    const response = await POST(request(body));
    expect(response.status).toBe(422);
    expect((await response.json()).issues).toEqual([
      expect.objectContaining({ path }),
    ]);
  });

  it.each([null, false, [], "invalid"])(
    "rejects non-object request %j at the root",
    async (body) => {
      const response = await POST(request(body));
      expect(response.status).toBe(422);
      expect((await response.json()).issues).toEqual([
        expect.objectContaining({ code: "INVALID_REQUEST", path: [] }),
      ]);
    },
  );

  it.each([
    ["hash", ["caseManifest", "approval", "approvedArtifactHash"]],
    ["rejected", ["caseManifest", "approval", "decision"]],
    ["missing approval", ["caseManifest"]],
    ["instrument", ["caseManifest", "hypothesis", "instrumentId"]],
    ["actor", ["caseManifest", "hypothesis", "actorIds", 0]],
    ["dataset", ["caseManifest", "canonicalDatasetHash"]],
    ["window", ["caseManifest", "hypothesis"]],
    ["rules", ["caseManifest", "rules"]],
  ] as const)(
    "scopes case %s to the submitted manifest",
    async (kind, path) => {
      const body = structuredClone(rapidBody());
      if (kind === "instrument")
        body.caseManifest.hypothesis.instrumentId = "WT-OTHER";
      if (kind === "actor")
        body.caseManifest.hypothesis.actorIds = ["participant-absent"];
      if (kind === "dataset")
        body.caseManifest.canonicalDatasetHash = "f".repeat(64);
      if (kind === "window")
        body.caseManifest.hypothesis.endTime = "2026-09-01T00:00:06Z";
      if (kind === "rules") body.caseManifest.rules = [];
      const { approval: _, ...artifact } = body.caseManifest;
      void _;
      body.caseManifest.approval.approvedArtifactHash =
        sha256Canonical(artifact);
      if (kind === "hash")
        body.caseManifest.approval.approvedArtifactHash = "f".repeat(64);
      if (kind === "rejected") body.caseManifest.approval.decision = "REJECTED";
      if (kind === "missing approval")
        Reflect.deleteProperty(body.caseManifest, "approval");
      const response = await POST(request(body));
      expect(response.status).toBe(422);
      const result = await response.json();
      expect(result.workflowState).toBe(
        kind === "missing approval"
          ? "INPUT_REVIEW_REQUIRED"
          : "CASE_REVIEW_REQUIRED",
      );
      expect(result.issues).toEqual([expect.objectContaining({ path })]);
    },
  );
});
