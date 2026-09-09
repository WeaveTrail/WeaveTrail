import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import {
  EvidenceBundleSchema,
  EvidenceBundleV13Schema,
  SchemaMappingProposalSchema,
  requiresMappingOverride,
  type ApprovalRecord,
  type CaseManifest,
  type EvidenceBundleV13,
  type SchemaMappingProposal,
} from "@weavetrail/contracts";
import {
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
  committedReplayScenarios,
  publishedExecutionFixProposal,
  publishedExecutionFixRows,
  publishedExecutionH0stcnt0Proposal,
  publishedExecutionH0stcnt0Rows,
  publishedExecutionManifest,
  rapidPriceLiftScenarios,
} from "@weavetrail/scenarios";
import { publishedReplaySources } from "@weavetrail/published-data";

import {
  caseManifestProposal,
  mappingApprovalArtifact,
  replayApproved,
} from "./approval-validation";
import { sha256Canonical } from "./canonical-hash";
import { canonicalJson, type CanonicalJsonInput } from "./canonical-json";
import {
  CANONICAL_EVENT_FIELDS,
  COLLECTION_METADATA_FIELDS,
  OHLC_DAILY_CANONICAL_EVENT_FIELDS,
} from "./canonicalize";
import { canonicalDatasetHash } from "./canonical-dataset";
import { evidenceBundleHash } from "./evidence-bundle-hash";
import { canonicalReplayResultHash, ENGINE_VERSION } from "./replay-foundation";
import { RequestWorkflow } from "./request-workflow";
import type { SourceRow } from "./source-ingest";
import { syntheticDailyQuoteSpecimen } from "./testing/daily-quotes";

const document = readFileSync(
  new URL("../../../docs/EVIDENCE_HASH_SCOPES.md", import.meta.url),
  "utf8",
);
const tableText = document
  .split("<!-- hash-scope-table:start -->")[1]!
  .split("<!-- hash-scope-table:end -->")[0]!;
const table = [
  ...tableText.matchAll(/\|\s*`([^`]+)`\s*\|\s*([PN])\s*\|\s*([PN])\s*\|/g),
].map(([, path, result, bundle]) => ({ path: path!, result, bundle }));

// Independently enumerate all schema branches, including optional members.
type JsonSchema = {
  $ref?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
};
function schemaLeaves(input: unknown, path = ""): string[] {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new Error(`Unvisited schema at ${path}`);
  const schema = input as JsonSchema;
  if (schema.$ref)
    throw new Error(`Unvisited schema reference: ${schema.$ref}`);
  const branches = schema.anyOf ?? schema.oneOf;
  if (branches) return branches.flatMap((branch) => schemaLeaves(branch, path));
  if (schema.properties) {
    return Object.entries(schema.properties).flatMap(([key, child]) =>
      schemaLeaves(child, path ? `${path}.${key}` : key),
    );
  }
  if (schema.items) return schemaLeaves(schema.items, `${path}[]`);
  return [path];
}

// This projector reads only the published table, never production allowlists.
function tableProjection(
  value: CanonicalJsonInput,
  scope: "result" | "bundle",
  path = "",
): CanonicalJsonInput {
  const protectedPath = (candidate: string) =>
    table.some((row) => row.path === candidate && row[scope] === "P");
  if (Array.isArray(value)) {
    if (table.some((row) => row.path === path)) {
      return protectedPath(path) ? value : undefined;
    }
    if (
      !table.some(
        (row) => row.path.startsWith(`${path}[]`) && row[scope] === "P",
      )
    )
      return undefined;
    return value.map((child) => tableProjection(child, scope, `${path}[]`));
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).flatMap(([key, child]) => {
      const projected = tableProjection(
        child,
        scope,
        path ? `${path}.${key}` : key,
      );
      return projected === undefined ? [] : [[key, projected]];
    });
    return entries.length === 0 ? undefined : Object.fromEntries(entries);
  }
  return protectedPath(path) ? value : undefined;
}

function tableResultPreimage(bundle: EvidenceBundleV13): CanonicalJsonInput {
  const projected = tableProjection(bundle, "result") as
    { replay?: CanonicalJsonInput } | undefined;
  return projected?.replay;
}

function approvalFor(proposal: SchemaMappingProposal): ApprovalRecord {
  return {
    approvedArtifactHash: sha256Canonical(mappingApprovalArtifact(proposal)),
    reviewerRef: "hash-scope-test-reviewer",
    decision: "APPROVED",
    approvedAt: "2026-09-06T00:00:00Z",
    overrides: [
      ...proposal.fields.flatMap((field, index) =>
        requiresMappingOverride(field)
          ? [{ fieldPath: `fields.${index}`, reason: field.evidence }]
          : [],
      ),
      ...("unmappedFields" in proposal
        ? proposal.unmappedFields.flatMap((field, index) =>
            requiresMappingOverride(field)
              ? [
                  {
                    fieldPath: `unmappedFields.${index}`,
                    reason: field.evidence,
                  },
                ]
              : [],
          )
        : []),
    ],
  };
}

// Test declarations only; no production bundle assembler is introduced.
function specimen(
  rows: readonly SourceRow[],
  proposal: SchemaMappingProposal,
  manifest?: CaseManifest,
): EvidenceBundleV13 {
  const approval = approvalFor(proposal);
  const workflow = new RequestWorkflow();
  const result = replayApproved(
    rows,
    rows,
    proposal,
    approval,
    manifest,
    "baseline",
    workflow,
  );
  if (!("canonicalResultHash" in result))
    throw new Error("Expected approved normalization");
  return EvidenceBundleV13Schema.parse({
    bundleVersion: "1.3",
    sourceArtifacts: [{ sourceArtifactHash: proposal.sourceArtifactHash }],
    mappings: [{ proposal, approval }],
    ...(manifest
      ? {
          case: {
            proposal: caseManifestProposal(manifest),
            approval: manifest.approval,
          },
        }
      : {}),
    workflowState: workflow.state,
    replay: {
      engineVersion: result.engineVersion,
      canonicalDatasetHash: canonicalDatasetHash(result.events),
      events: result.events,
      ...("evaluation" in result ? { evaluation: result.evaluation } : {}),
      canonicalResultHash: result.canonicalResultHash,
    },
    bundleHash: "0".repeat(64),
  });
}

const cases = Object.entries(rapidPriceLiftScenarios).map(
  ([name, scenario]) => ({
    name,
    bundle: specimen(
      scenario.rows,
      scenario.mappingProposal,
      scenario.manifest,
    ),
  }),
);
const daily = syntheticDailyQuoteSpecimen();
const syntheticDaily = specimen(daily.rows, daily.proposal);
const fsc = publishedReplaySources["real/fsc-stock-quotes-20260903.jsonl"];
const fscBundle = specimen(fsc.rows, fsc.mappingProposal);
const ohlcCompositeFsc =
  publishedReplaySources["real/fsc-kospi-index-family-20260903/source.jsonl"];
const compositeFsc = {
  ...ohlcCompositeFsc,
  mappingProposal: SchemaMappingProposalSchema.parse({
    mappingVersion: "1.6",
    sourceArtifactHash: ohlcCompositeFsc.sourceArtifactHash,
    constants: {
      schemaVersion: "1.2",
      datasetId: ohlcCompositeFsc.mappingProposal.constants.datasetId,
      venueId: ohlcCompositeFsc.mappingProposal.constants.venueId,
      eventType: "DAILY_QUOTE",
    },
    compositeSourceEventId: {
      sourceColumns: ["basDt", "idxNm"],
      transform: "NUL_JOIN",
      confidence: 1,
      status: "PROPOSED",
      evidence:
        "The publisher natural key is the ordered pair (basDt, idxNm). NUL cannot occur in admitted values and makes the join injective without modifying source rows.",
    },
    fields: ohlcCompositeFsc.mappingProposal.fields.map((field) => {
      if (field.targetField === "closePrice") {
        return { ...field, targetField: "price", transform: "DECIMAL_STRING" };
      }
      if (
        ["openPrice", "highPrice", "lowPrice", "netChange"].includes(
          field.targetField ?? "",
        )
      ) {
        return { ...field, targetField: null, transform: null };
      }
      return field;
    }),
  }),
};
const compositeFscBundle = specimen(
  compositeFsc.rows,
  compositeFsc.mappingProposal,
);
const ohlcFsc =
  publishedReplaySources[
    "real/fsc-kospi-200-baseline-20260701-20260903/source.jsonl"
  ];
const ohlcFscBundle = specimen(ohlcFsc.rows, ohlcFsc.mappingProposal);
const publishedExecutionBundle = specimen(
  publishedExecutionFixRows,
  publishedExecutionFixProposal,
  publishedExecutionManifest,
);
const publishedExecutionReviewBundle = specimen(
  publishedExecutionH0stcnt0Rows,
  publishedExecutionH0stcnt0Proposal,
);
const dialects = [
  ["concentrated-buy-dialect-a.csv", concentratedBuyDialectAProposal],
  ["concentrated-buy-dialect-b.jsonl", concentratedBuyDialectBProposal],
] as const;
const committed = [
  ...cases,
  ...dialects.map(([name, proposal]) => ({
    name,
    bundle: specimen(committedReplayScenarios[name].rows, proposal),
  })),
  {
    name: "published-execution-fix44.csv",
    bundle: publishedExecutionBundle,
  },
  ...Object.entries(publishedReplaySources).map(([name, source]) => ({
    name,
    bundle: specimen(source.rows, source.mappingProposal),
  })),
];

function resultHash(bundle: EvidenceBundleV13): string | undefined {
  return bundle.replay
    ? canonicalReplayResultHash(bundle.replay.events, bundle.replay.evaluation)
    : undefined;
}

describe("published Evidence Bundle 1.3 hash scopes", () => {
  it("accounts for every schema field across all versions and result branches", () => {
    const paths = schemaLeaves(
      EvidenceBundleV13Schema.toJSONSchema({ io: "input" }),
    );
    expect(table.map(({ path }) => path).sort()).toEqual(
      [...new Set(paths)].sort(),
    );
    expect(new Set(table.map(({ path }) => path)).size).toBe(table.length);
    const eventRows = table.filter(({ path }) =>
      path.startsWith("replay.events[]."),
    );
    expect(
      eventRows
        .filter(({ result }) => result === "P")
        .map(({ path }) => path.split(".").at(-1))
        .sort(),
    ).toEqual(
      [...CANONICAL_EVENT_FIELDS, ...OHLC_DAILY_CANONICAL_EVENT_FIELDS].sort(),
    );
    expect(
      eventRows
        .filter(({ result }) => result === "N")
        .map(({ path }) => path.split(".").at(-1))
        .sort(),
    ).toEqual([...COLLECTION_METADATA_FIELDS].sort());
    expect(CANONICAL_EVENT_FIELDS).toHaveLength(15);
    expect(OHLC_DAILY_CANONICAL_EVENT_FIELDS).toHaveLength(6);
    expect(COLLECTION_METADATA_FIELDS).toHaveLength(2);
    expect(
      table.filter(({ bundle }) => bundle === "N").map(({ path }) => path),
    ).toEqual(["bundleHash"]);
  });

  it.each(committed)(
    "matches both actual preimages for $name",
    ({ bundle }) => {
      expect(bundle.replay!.engineVersion).toBe(ENGINE_VERSION);
      expect(resultHash(bundle)).toBe(
        sha256Canonical(tableResultPreimage(bundle)),
      );
      expect(resultHash(bundle)).toBe(bundle.replay!.canonicalResultHash);
      expect(evidenceBundleHash(bundle)).toBe(
        sha256Canonical(tableProjection(bundle, "bundle")),
      );
    },
  );

  it("retains the actual FSC stopping point without inventing a case or evaluation", () => {
    expect(fscBundle.workflowState).toBe("MAPPING_APPROVED");
    expect(fscBundle).not.toHaveProperty("case");
    expect(fscBundle.replay).not.toHaveProperty("evaluation");
    expect(
      fscBundle.replay!.events.every((event) => event.schemaVersion === "1.2"),
    ).toBe(true);
    expect(fscBundle.mappings[0]!.proposal.mappingVersion).toBe("1.5");
    expect(resultHash(fscBundle)).toBe(fscBundle.replay!.canonicalResultHash);
  });

  it("hashes declarations before normalization without claiming a result hash", () => {
    const pending = EvidenceBundleV13Schema.parse({
      bundleVersion: "1.3",
      sourceArtifacts: fscBundle.sourceArtifacts,
      mappings: [{ proposal: fsc.mappingProposal }],
      workflowState: "MAPPING_REVIEW_REQUIRED",
      bundleHash: "0".repeat(64),
    });
    expect(pending).not.toHaveProperty("replay");
    expect(resultHash(pending)).toBeUndefined();
    expect(tableResultPreimage(pending)).toBeUndefined();
    expect(evidenceBundleHash(pending)).toBe(
      sha256Canonical(tableProjection(pending, "bundle")),
    );
    const rejected = EvidenceBundleV13Schema.parse({
      ...pending,
      mappings: [
        {
          proposal: fsc.mappingProposal,
          approval: {
            ...approvalFor(fsc.mappingProposal),
            decision: "REJECTED" as const,
          },
        },
      ],
    });
    expect(EvidenceBundleV13Schema.safeParse(rejected).success).toBe(true);
    expect(evidenceBundleHash(rejected)).not.toBe(evidenceBundleHash(pending));
    expect(resultHash(rejected)).toBeUndefined();
    const uploaded = EvidenceBundleV13Schema.parse({
      ...pending,
      workflowState: "UPLOADED",
      mappings: [],
    });
    expect(evidenceBundleHash(uploaded)).toBe(
      sha256Canonical(tableProjection(uploaded, "bundle")),
    );
    expect(resultHash(uploaded)).toBeUndefined();
  });

  it("keeps a reapproved identical evaluation stable while binding its new case declaration", () => {
    const scenario = rapidPriceLiftScenarios["rapid-price-lift-supported.csv"];
    const manifest = structuredClone(scenario.manifest);
    manifest.caseId = "synthetic-reapproved-case";
    manifest.approval.approvedAt = "2026-09-06T01:00:00Z";
    manifest.approval.reviewerRef = "another-test-reviewer";
    manifest.approval.approvedArtifactHash = sha256Canonical(
      caseManifestProposal(manifest),
    );
    const original = specimen(
      scenario.rows,
      scenario.mappingProposal,
      scenario.manifest,
    );
    const changed = specimen(scenario.rows, scenario.mappingProposal, manifest);
    expect(changed.replay!.evaluation).toEqual(original.replay!.evaluation);
    expect(changed.replay!.canonicalResultHash).toBe(
      original.replay!.canonicalResultHash,
    );
    expect(evidenceBundleHash(changed)).not.toBe(evidenceBundleHash(original));
  });

  it("preserves gates and null sensitivity using the complete result schema", () => {
    expect(
      new Set(cases.map(({ bundle }) => bundle.replay!.evaluation!.result)),
    ).toEqual(new Set(["SUPPORTED", "NOT_SUPPORTED", "INCONCLUSIVE"]));
    for (const { bundle } of cases) {
      const evaluation = bundle.replay!.evaluation!;
      if (evaluation.result === "INCONCLUSIVE") {
        expect(evaluation.sensitivity).toBeNull();
        expect(evaluation.findings).toEqual([]);
        expect(evaluation.reason).toBeTruthy();
      } else {
        expect(evaluation.findings).toHaveLength(5);
        expect(
          evaluation.findings.every((finding) => finding.gate.length > 0),
        ).toBe(true);
        expect(evaluation.sensitivity.comparison).toBe(
          "MECHANICAL_METRIC_COMPARISON",
        );
      }
    }
  });

  it("keeps 1.2 opt-in separate and rejects unknown or mixed declaration shapes", () => {
    expect(EvidenceBundleSchema.safeParse(fscBundle).success).toBe(false);
    for (const candidate of [
      { ...fscBundle, bundleVersion: "1.2" },
      { ...fscBundle, runId: "not-a-declared-field" },
      { ...fscBundle, exportedAt: "2026-09-06T00:00:00Z" },
      { ...fscBundle, replay: { ...fscBundle.replay, result: "INCONCLUSIVE" } },
      {
        ...fscBundle,
        mappings: [{ ...fscBundle.mappings[0], unexpected: true }],
      },
    ])
      expect(EvidenceBundleV13Schema.safeParse(candidate).success).toBe(false);
  });

  it("rejects lossy findings, a missing replay hash and mismatched sensitivity branches", () => {
    const supported = cases.find(
      ({ bundle }) => bundle.replay!.evaluation!.result === "SUPPORTED",
    )!.bundle;
    const inconclusive = cases.find(
      ({ bundle }) => bundle.replay!.evaluation!.result === "INCONCLUSIVE",
    )!.bundle;
    const evaluation = supported.replay!.evaluation!;
    const candidate = (
      bundle: EvidenceBundleV13,
      changes: Record<string, unknown>,
    ) => ({
      ...bundle,
      replay: {
        ...bundle.replay,
        evaluation: { ...bundle.replay!.evaluation, ...changes },
      },
    });
    for (const input of [
      candidate(supported, {
        findings: evaluation.findings.map((finding) => ({
          ...finding,
          gate: undefined,
        })),
      }),
      candidate(supported, { sensitivity: null }),
      candidate(inconclusive, { sensitivity: evaluation.sensitivity }),
      {
        ...fscBundle,
        replay: { ...fscBundle.replay, canonicalResultHash: undefined },
      },
      { ...fscBundle, replay: { ...fscBundle.replay, evaluation: null } },
    ])
      expect(EvidenceBundleV13Schema.safeParse(input).success).toBe(false);
  });
});

type Leaf = {
  path: string;
  segments: (string | number)[];
  value: CanonicalJsonInput;
};
function valueLeaves(
  value: CanonicalJsonInput,
  path = "",
  segments: Leaf["segments"] = [],
): Leaf[] {
  if (Array.isArray(value) && table.some((row) => row.path === path)) {
    return [{ path, segments, value }];
  }
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      valueLeaves(child, `${path}[]`, [...segments, index]),
    );
  if (value !== null && typeof value === "object")
    return Object.entries(value).flatMap(([key, child]) =>
      valueLeaves(child, path ? `${path}.${key}` : key, [...segments, key]),
    );
  return [{ path, segments, value }];
}

// Populate optional fields only on a synthetic scope probe. These declarations
// test serialization, not source/approval consistency; mutations may violate
// domain validation deliberately, e.g. changing a literal schema version.
const probe = structuredClone(cases[0]!.bundle);
Object.assign(probe.replay!.events[0]!, {
  counterpartyId: "synthetic-counterparty",
  orderId: "synthetic-order",
  receivedAt: "2026-09-06T00:00:00Z",
});
probe.mappings[0]!.approval!.overrides = [
  { fieldPath: "fields.0", reason: "Synthetic scope probe" },
];
probe.case!.approval!.overrides = [
  { fieldPath: "hypothesis", reason: "Synthetic scope probe" },
];
probe.case!.proposal.aiTrace.referencedEventIds = [
  probe.replay!.events[0]!.eventId,
];
const probes = [
  probe,
  syntheticDaily,
  compositeFscBundle,
  ohlcFscBundle,
  publishedExecutionBundle,
  publishedExecutionReviewBundle,
  ...cases.map(({ bundle }) => bundle),
];

describe("each published field's serialization boundary", () => {
  it.each(table)("enforces $path (result=$result, bundle=$bundle)", (row) => {
    const located = probes.flatMap((bundle) =>
      valueLeaves(bundle)
        .filter(({ path }) => path === row.path)
        .map((leaf) => ({ bundle, leaf })),
    )[0];
    expect(located, `Missing scope probe for ${row.path}`).toBeDefined();
    const { bundle, leaf } = located!;
    const mutated = structuredClone(bundle);
    let parent: unknown = mutated;
    for (const segment of leaf.segments.slice(0, -1))
      parent = (parent as Record<string | number, unknown>)[segment];
    (parent as Record<string | number, unknown>)[leaf.segments.at(-1)!] =
      typeof leaf.value === "number"
        ? leaf.value + 1
        : typeof leaf.value === "boolean"
          ? !leaf.value
          : `${leaf.value ?? "null"}#probe`;
    expect(evidenceBundleHash(mutated) !== evidenceBundleHash(bundle)).toBe(
      row.bundle === "P",
    );
    if (row.path === "replay.engineVersion") {
      // The actual result function takes the fixed constant, not this claim.
      expect(bundle.replay!.engineVersion).toBe(ENGINE_VERSION);
      expect(EvidenceBundleV13Schema.safeParse(mutated).success).toBe(false);
      expect(sha256Canonical(tableResultPreimage(mutated))).not.toBe(
        resultHash(bundle),
      );
      return;
    }
    expect(resultHash(mutated) !== resultHash(bundle)).toBe(row.result === "P");
    expect(resultHash(mutated)).toBe(
      sha256Canonical(tableResultPreimage(mutated)),
    );
    expect(evidenceBundleHash(mutated)).toBe(
      sha256Canonical(tableProjection(mutated, "bundle")),
    );
  });

  it("preserves array order and distinguishes omission from null", () => {
    const reversed = structuredClone(probe);
    reversed.mappings[0]!.proposal.fields.reverse();
    expect(evidenceBundleHash(reversed)).not.toBe(evidenceBundleHash(probe));
    expect(resultHash(reversed)).toBe(resultHash(probe));
    const withoutEvaluation = structuredClone(probe);
    delete withoutEvaluation.replay!.evaluation;
    expect(resultHash(withoutEvaluation)).not.toBe(resultHash(probe));
    expect(evidenceBundleHash(withoutEvaluation)).not.toBe(
      evidenceBundleHash(probe),
    );
    expect(canonicalJson({ omitted: undefined, present: null })).toBe(
      '{"present":null}',
    );
  });

  it("pins shared UTF-16, undefined, finite-number and UTF-8 serialization rules", () => {
    const input = {
      "2": "two",
      "10": "ten",
      "\ue000": "bmp",
      "\ud800\udc00": "astral",
      nested: { z: undefined, a: -0 },
      finite: [1e-7, 1e21],
      decimal: "100.00",
    };
    const serialized =
      '{"10":"ten","2":"two","decimal":"100.00","finite":[1e-7,1e+21],"nested":{"a":0},"𐀀":"astral","":"bmp"}';
    expect(canonicalJson(input)).toBe(serialized);
    expect(sha256Canonical(input)).toBe(
      createHash("sha256")
        .update(Buffer.from(serialized, "utf8"))
        .digest("hex"),
    );
    for (const invalid of [
      NaN,
      Infinity,
      -Infinity,
      [undefined],
      Array(1),
      undefined,
    ])
      expect(() => canonicalJson(invalid)).toThrow();
    expect(canonicalJson("é")).not.toBe(canonicalJson("e\u0301"));
  });
});
