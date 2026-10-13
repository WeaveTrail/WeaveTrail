import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MappingStudyRunRecordSchema,
  MappingStudyRouteRecordSchema,
} from "@weavetrail/contracts";
import { canonicalJson, sha256Canonical } from "@weavetrail/replay-engine";
import { validateColumnIdStructure } from "@weavetrail/ai-harness/validator";
import { readStudyBundle, runStudyScoreCommand } from "./score-mapping-study";
import { scoreMappingStudy } from "./mapping-study-scorer";
import { selectStudyModels } from "./mapping-study-selection";
import {
  pairedFamilyBootstrap,
  zeroEventFamilyUpperBound,
} from "./mapping-study-analysis";
import { compareCounts } from "./mapping-scorer";
import { readStudyProtocol } from "./mapping-study-protocol";
import {
  bindStudySource,
  studyMappingInput,
  type StudySource,
} from "./mapping-study-data";
import { sha256 } from "./mapping-corpus-generator";
import { synthesizeStudyRoute, studyRecordHash } from "./mapping-study-runs";

const path = (split: string, name: string) =>
  fileURLToPath(
    new URL(
      `../fixtures/mapping-study-tools-v1/${split}/${name}`,
      import.meta.url,
    ),
  );
const load = (split = "AUDIT") => readStudyBundle(path(split, "bundle.json"));
const draftBytes = (name: string) => {
  const bytes = readFileSync(
    new URL(`../fixtures/mapping-study-v1/${name}`, import.meta.url),
    "utf8",
  );
  return { bytes, sha256: sha256(bytes) };
};
const loadDrift = () => {
  const input = load("SELECT");
  const source: StudySource = {
    inputs: draftBytes("DRIFT.inputs.json"),
    gold: draftBytes("DRIFT.gold.json"),
    families: draftBytes("families.json"),
    driftRelations: draftBytes("drift-relations.json"),
  };
  const { protocol } = readStudyProtocol(input.protocol);
  protocol.sources = [
    {
      split: "DRIFT",
      inputsHash: source.inputs.sha256,
      goldHash: source.gold.sha256,
      familiesHash: source.families.sha256,
      driftRelationsHash: source.driftRelations!.sha256,
      seal: { status: "UNSEALED", independentReviewHash: null },
    },
  ];
  return {
    ...input,
    protocol,
    source,
    records: [] as unknown[],
    routes: [] as unknown[],
  };
};
const driftRecords = (input: ReturnType<typeof loadDrift>) => {
  const { protocol, hash } = readStudyProtocol(input.protocol);
  const source = bindStudySource(protocol, input.source);
  const template = MappingStudyRunRecordSchema.parse(
    (load("SELECT").records as unknown[])[0],
  );
  return source.dialects.flatMap((d) =>
    protocol.candidates.flatMap((candidate) =>
      Array.from({ length: protocol.repeats }, (_, i) => {
        const fields = d.gold.columns.map((g) => ({
          columnId: g.columnId,
          sourceColumn: g.sourceColumn,
          targetField: g.targetField,
          transform: g.transform,
          status: g.status,
          confidence: g.targetField === null ? 0 : 1,
          evidence:
            "Authored DRIFT regression fixture; not a provider observation.",
        }));
        const validation = validateColumnIdStructure(
          {
            kind: "fields",
            value: {
              fields: fields.map(({ sourceColumn, ...field }) => {
                void sourceColumn;
                return field;
              }),
            },
          },
          studyMappingInput(d),
        );
        return MappingStudyRunRecordSchema.parse({
          ...template,
          protocolHash: hash,
          candidateId: candidate.id,
          requestedModel: candidate.requestedModel,
          reportedModel: candidate.requestedModel,
          ...candidate.stack,
          familyId: d.family.id,
          inputHash: d.input.inputHash,
          dialectId: d.input.dialectId,
          repeat: i + 1,
          evaluationSet: {
            version: "mapping-study-inputs/1",
            split: "DRIFT",
            sha256: source.hash,
          },
          outcome:
            validation.status === "VALID" ? "VALID" : "CONTRACT_REJECTED",
          failureClass:
            validation.status === "VALID" ? null : "OUTPUT_CONTRACT",
          validatorReasons: validation.reasons,
          parsedOutput: { fields },
        });
      }),
    ),
  );
};
const records = (input: ReturnType<typeof load>) =>
  (input.records as unknown[]).map((r) => MappingStudyRunRecordSchema.parse(r));
const routes = (input: ReturnType<typeof load>) =>
  (input.routes as unknown[]).map((r) =>
    MappingStudyRouteRecordSchema.parse(r),
  );
const rebindProtocol = (
  input: ReturnType<typeof load>,
  mutate: (protocol: ReturnType<typeof readStudyProtocol>["protocol"]) => void,
) => {
  const { protocol } = readStudyProtocol(input.protocol);
  mutate(protocol);
  const hash = sha256Canonical(protocol);
  input.protocol = protocol;
  input.records = records(input).map((r) => ({ ...r, protocolHash: hash }));
  input.routes = [];
};

describe("offline mapping study tools", () => {
  it("rejects live-sample IDs absent from the bound AUDIT source before any attempt", () => {
    const input = load();
    rebindProtocol(input, (p) => {
      p.liveSampleDialectIds = ["d-003", "d-999"];
    });
    const { protocol } = readStudyProtocol(input.protocol);
    expect(() => bindStudySource(protocol, input.source)).toThrow(
      "Unknown study live sample dialect",
    );
    expect(() => scoreMappingStudy(input)).toThrow(
      "Unknown study live sample dialect",
    );
  });
  it("accepts declared AUDIT sample subsets while binding other splits independently", () => {
    const audit = load();
    rebindProtocol(audit, (p) => {
      p.liveSampleDialectIds = ["d-003"];
    });
    const { protocol } = readStudyProtocol(audit.protocol);
    expect(bindStudySource(protocol, audit.source).split).toBe("AUDIT");
    expect(scoreMappingStudy(audit).grid.complete).toBe(true);
    const select = load("SELECT");
    const selectProtocol = readStudyProtocol(select.protocol).protocol;
    protocol.sources.push(...selectProtocol.sources);
    expect(bindStudySource(protocol, select.source).split).toBe("SELECT");
    const drift = loadDrift();
    protocol.sources.push(...drift.protocol.sources);
    expect(bindStudySource(protocol, drift.source).split).toBe("DRIFT");
  });
  it.each(["SELECT", "AUDIT"])(
    "reproduces captured %s control bytes and CLI checks without credentials",
    (split) => {
      const input = load(split),
        result =
          split === "SELECT"
            ? selectStudyModels(input)
            : scoreMappingStudy(input);
      const expected = path(
        split,
        split === "SELECT" ? "selection.json" : "summary.json",
      );
      expect(`${canonicalJson(result)}\n`).toBe(readFileSync(expected, "utf8"));
      expect(() =>
        runStudyScoreCommand([
          "--bundle",
          path(split, "bundle.json"),
          ...(split === "SELECT" ? ["--select"] : []),
          "--check",
          expected,
        ]),
      ).not.toThrow();
    },
  );
  it("is invariant to record and route order and includes nonselectable B0/B1", () => {
    const input = load(),
      original = scoreMappingStudy(input);
    input.records = records(input).reverse();
    input.routes = routes(input).reverse();
    expect(canonicalJson(scoreMappingStudy(input))).toBe(
      canonicalJson(original),
    );
    expect(original.arms.slice(0, 2).map((a) => [a.id, a.selectable])).toEqual([
      ["B0", false],
      ["B1", false],
    ]);
    expect(original.status).toBe("EXPLORATORY_ONLY");
  });
  it("excludes volatile session IDs from canonical evidence and selection hashes while enforcing session binding", () => {
    const input = load("SELECT"),
      original = selectStudyModels(input);
    input.session = {
      id: "another-actual-session",
      status: "COMPLETED",
      stopReason: "NONE",
    };
    input.records = records(input).map((r) => ({
      ...r,
      sessionId: "another-actual-session",
    }));
    const repeated = selectStudyModels(input);
    expect(repeated.summary.recordsHash).toBe(original.summary.recordsHash);
    expect(repeated.decision.summaryHash).toBe(original.decision.summaryHash);
    expect(repeated.summary.arms).toEqual(original.summary.arms);
  });
  it("selects newly declared candidate IDs without changing historical eligibility or activating a path", () => {
    const result = selectStudyModels(load("SELECT"));
    expect(result.decision).toMatchObject({
      primary: "control-p",
      escalation: "control-e",
      status: "EXPLORATORY_ONLY",
      activation: "DISABLED",
    });
    expect(result.decision.eligible).toEqual(["control-p", "control-e"]);
  });
  it("keeps a lone eligible candidate primary-only and never fills an escalation slot with an ineligible model", () => {
    const input = load("SELECT");
    input.records = records(input).map((r) =>
      r.candidateId === "control-e"
        ? MappingStudyRunRecordSchema.parse({
            ...r,
            outcome: "PROVIDER_FAILED",
            parsedOutput: null,
            failureClass: "HTTP_ERROR",
            validatorReasons: [],
          })
        : r,
    );
    expect(selectStudyModels(input).decision).toMatchObject({
      primary: "control-p",
      escalation: null,
      eligible: ["control-p"],
    });
  });
  it("requires observed retained output and positive safety denominators; a failure remains in the denominator", () => {
    const input = load("SELECT");
    const rs = records(input);
    input.records = rs.map((r) =>
      r.dialectId === rs[0]!.dialectId && r.repeat === 1
        ? {
            ...r,
            outcome: "PROVIDER_FAILED",
            parsedOutput: null,
            failureClass: "TIMEOUT",
            validatorReasons: [],
            inputTokens: null,
            outputTokens: null,
          }
        : r,
    );
    expect(selectStudyModels(input).decision.outcome).toBe("NO_MODEL");
    const summary = scoreMappingStudy(input);
    expect(summary.grid.complete).toBe(true);
    expect(
      summary.arms.find((a) => a.id === rs[0]!.candidateId)!.byTag.ALL!
        .providerFailed.numerator,
    ).not.toBe("0");
  });
  it("rejects unflagged no-target output even with high confidence and otherwise valid structure", () => {
    const input = load("SELECT"),
      rs = records(input);
    const record = rs.find(
      (r) =>
        r.candidateId === "control-p" &&
        r.parsedOutput!.fields.some((f) => f.targetField === null),
    )!;
    const field = record.parsedOutput!.fields.find(
      (f) => f.targetField === null,
    )!;
    field.status = "PROPOSED";
    field.confidence = 1;
    input.records = rs;
    const decision = selectStudyModels(input).decision;
    expect(decision.eligible).toEqual(["control-e"]);
    expect(decision.escalation).toBeNull();
  });
  it.each([
    "duplicate",
    "missing",
    "wrong-session",
    "wrong-input",
    "wrong-family",
    "wrong-stack",
    "projection",
    "forged-valid",
    "raw-envelope",
  ])("rejects %s records", (mutation) => {
    const input = load();
    const rs = records(input);
    const first = rs[0]!;
    switch (mutation) {
      case "duplicate":
        rs.push(first);
        break;
      case "missing":
        rs.shift();
        break;
      case "wrong-session":
        first.sessionId = "another-session";
        break;
      case "wrong-input":
        first.inputHash = "0".repeat(64);
        break;
      case "wrong-family":
        first.familyId = "f-999";
        break;
      case "wrong-stack":
        first.adapterVersion = "changed/1";
        break;
      case "projection":
        first.parsedOutput!.fields[0]!.sourceColumn = "invented";
        break;
      case "forged-valid":
        first.parsedOutput!.fields[0]!.targetField = null;
        first.parsedOutput!.fields[0]!.transform = null;
        break;
      case "raw-envelope":
        Object.assign(first, {
          rawEnvelope: { apiKey: "should-never-be-retained" },
        });
        break;
    }
    input.records = rs;
    expect(() => scoreMappingStudy(input)).toThrow();
  });
  it("preserves a stopped incomplete session instead of repairing its grid or selecting from it", () => {
    const input = load("SELECT");
    input.records = records(input).slice(0, -1);
    input.session = {
      id: "authored-controls-select",
      status: "STOPPED",
      stopReason: "OPERATOR",
    };
    expect(scoreMappingStudy(input).grid).toMatchObject({
      complete: false,
      missing: [{ candidateId: "control-e", dialectId: "d-079", repeat: 3 }],
    });
    expect(() => selectStudyModels(input)).toThrow("complete SELECT");
  });
  it.each(["partial", "empty"])(
    "withholds reference comparisons for a stopped %s grid",
    (coverage) => {
      const input = load("SELECT");
      input.records = coverage === "partial" ? records(input).slice(0, -1) : [];
      input.session = {
        id: "authored-controls-select",
        status: "STOPPED",
        stopReason: "OPERATOR",
      };
      const summary = scoreMappingStudy(input);
      expect(summary.grid.complete).toBe(false);
      expect(summary.referenceComparisons).toEqual([]);
      expect(summary.arms.slice(0, 2).map((a) => a.id)).toEqual(["B0", "B1"]);
    },
  );
  it("binds every committed DRIFT base and follow-up to its declared family", () => {
    const input = loadDrift();
    const source = bindStudySource(input.protocol, input.source);
    expect(source.dialects).toHaveLength(84);
    expect(new Set(source.dialects.map((d) => d.family.id)).size).toBe(12);
    expect(
      source.dialects.find((d) => d.input.dialectId === "d-085.1")!.family
        .dialectId,
    ).toBe("d-085");
  });
  it("scores the full DRIFT grid through the offline bundle CLI with twelve dependent families", () => {
    const input = loadDrift();
    input.records = driftRecords(input);
    const directory = mkdtempSync(join(tmpdir(), "mapping-study-drift-"));
    const bundle: Record<string, string> = {
      version: "mapping-study-bundle/1",
    };
    try {
      for (const [name, bytes] of Object.entries(input.source)) {
        bundle[name] = `${name}.json`;
        writeFileSync(join(directory, bundle[name]), bytes.bytes);
      }
      for (const [name, json] of Object.entries({
        protocol: input.protocol,
        records: input.records,
        session: input.session,
        prices: JSON.parse(input.prices.bytes),
        b0: input.references.b0,
        b1: input.references.b1,
      })) {
        bundle[name] = `${name}.json`;
        writeFileSync(
          join(directory, bundle[name]),
          `${canonicalJson(json)}\n`,
        );
      }
      const bundlePath = join(directory, "bundle.json");
      writeFileSync(bundlePath, `${canonicalJson(bundle)}\n`);
      const summary = runStudyScoreCommand([
        "--bundle",
        bundlePath,
        "--out",
        directory,
      ]);
      expect(summary).toMatchObject({ split: "DRIFT" });
      const score = scoreMappingStudy(readStudyBundle(bundlePath));
      expect(score.grid).toMatchObject({ complete: true, recordedRuns: "504" });
      expect(score.arms.every((a) => a.families.length === 12)).toBe(true);
      expect(score.bindings.driftRelationsHash).toBe(
        input.source.driftRelations!.sha256,
      );
      expect(readFileSync(join(directory, "summary.json"), "utf8")).toBe(
        `${canonicalJson(score)}\n`,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it.each([
    "missing",
    "duplicate",
    "family",
    "base",
    "base-hash",
    "followup-hash",
    "unknown-followup",
    "status",
  ])("rejects a hash-bound DRIFT relation mutation: %s", (mutation) => {
    const input = loadDrift();
    const relations = JSON.parse(input.source.driftRelations!.bytes);
    const first = relations.records[0];
    if (mutation === "missing") relations.records.shift();
    if (mutation === "duplicate") relations.records.push(first);
    if (mutation === "family") first.familyId = "f-086";
    if (mutation === "base") first.baseDialectId = "d-086";
    if (mutation === "base-hash") first.baseInputHash = "0".repeat(64);
    if (mutation === "followup-hash") first.inputHash = "0".repeat(64);
    if (mutation === "unknown-followup") first.dialectId = "d-999.1";
    if (mutation === "status") relations.status = "SEALED";
    const bytes = `${canonicalJson(relations)}\n`;
    input.source.driftRelations = { bytes, sha256: sha256(bytes) };
    input.protocol.sources[0]!.driftRelationsHash =
      input.source.driftRelations.sha256;
    expect(() => bindStudySource(input.protocol, input.source)).toThrow();
  });
  it.each(["missing-file", "unbound-hash", "changed-bytes"])(
    "rejects DRIFT relations without their original-byte protocol binding: %s",
    (mutation) => {
      const input = loadDrift();
      if (mutation === "missing-file") delete input.source.driftRelations;
      if (mutation === "unbound-hash")
        delete input.protocol.sources[0]!.driftRelationsHash;
      if (mutation === "changed-bytes")
        input.source.driftRelations!.bytes += " ";
      expect(() => bindStudySource(input.protocol, input.source)).toThrow();
    },
  );
  it.each(["PROPOSAL_OFFERABLE", "REVIEW_REQUIRED"])(
    "rejects gold whose declared %s disposition contradicts its canonical proposal",
    (original) => {
      const input = load();
      const gold = JSON.parse(input.source.gold.bytes);
      const truth = gold.records.find(
        (g: { expectedDisposition: string }) =>
          g.expectedDisposition === original,
      );
      truth.expectedDisposition =
        original === "PROPOSAL_OFFERABLE"
          ? "REVIEW_REQUIRED"
          : "PROPOSAL_OFFERABLE";
      input.source.gold.bytes = `${canonicalJson(gold)}\n`;
      input.source.gold.sha256 = sha256(input.source.gold.bytes);
      rebindProtocol(input, (p) => {
        p.sources[0]!.goldHash = input.source.gold.sha256;
      });
      expect(() => scoreMappingStudy(input)).toThrow(
        "Study gold disposition mismatch",
      );
    },
  );
  it("rejects changed original bytes, price bindings and reference configurations", () => {
    for (const kind of ["input", "price", "b1"] as const) {
      const input = load();
      if (kind === "input") input.source.inputs.bytes += " ";
      if (kind === "price") input.prices.sha256 = "0".repeat(64);
      if (kind === "b1")
        (input.references.b1 as { devSha256: string }).devSha256 = "0".repeat(
          64,
        );
      expect(() => scoreMappingStudy(input)).toThrow();
    }
  });
  it.each(["unrelated", "nonexistent"])(
    "rejects a hash-bound family declaring a dialect that is %s",
    (mutation) => {
      const input = load();
      const families = JSON.parse(input.source.families.bytes);
      families.records[0].dialectId =
        mutation === "unrelated" ? families.records[1].dialectId : "d-999";
      input.source.families.bytes = `${canonicalJson(families)}\n`;
      input.source.families.sha256 = sha256(input.source.families.bytes);
      rebindProtocol(input, (p) => {
        p.sources.find((s) => s.split === "AUDIT")!.familiesHash =
          input.source.families.sha256;
      });
      expect(() => scoreMappingStudy(input)).toThrow(
        "Study family/input/gold mismatch",
      );
    },
  );
  it("keeps canonical strict scoring separate from reviewed equivalent-assignment diagnostics", () => {
    const input = load("SELECT");
    const rs = records(input);
    const first = rs.find((r) =>
      r.parsedOutput!.fields.some((f) => f.transform === "ISO_DATETIME"),
    )!;
    first.parsedOutput!.fields.find(
      (f) => f.transform === "ISO_DATETIME",
    )!.transform = "IDENTITY";
    input.records = rs;
    const summary = scoreMappingStudy(input),
      arm = summary.arms.find((a) => a.id === first.candidateId)!;
    expect(
      compareCounts(arm.byTag.ALL!.strictAccuracy, {
        numerator: "1",
        denominator: "1",
      }),
    ).toBe(-1);
    expect(arm.diagnosticEquivalentAssignment).toEqual({
      numerator: "72",
      denominator: "72",
    });
  });
  it("replays routes using primary disposition, distinguishes conditional/research cost, and counts rescue", () => {
    const summary = scoreMappingStudy(load()),
      route = summary.routes[0]!;
    expect(route.rescue).toEqual({ numerator: "3", denominator: "18" });
    expect(route.harm.numerator).toBe("0");
    expect(route.latencySemantics).toBe(
      "SUM_OF_PAIRED_RECORDED_LATENCIES_ESTIMATE",
    );
    expect(BigInt(route.conditionalResources.costMicroUsd.sum)).toBeLessThan(
      BigInt(summary.researchResources.sum),
    );
    expect(
      route.comparisons[0]!.safeCompletionDifference.independentFamilies,
    ).toBe("6");
  });
  it.each([
    "bad-hash",
    "bad-reason",
    "wrong-choice",
    "wrong-calls",
    "duplicate",
  ])("rejects %s route records", (mutation) => {
    const input = load(),
      rr = routes(input),
      first = rr[0]!;
    if (mutation === "bad-hash") first.primaryRunHash = "0".repeat(64);
    if (mutation === "bad-reason") first.reason = "PRIMARY_OFFERABLE";
    if (mutation === "wrong-choice")
      first.selectedRunHash = first.primaryRunHash;
    if (mutation === "wrong-calls") first.attemptedCalls = 1;
    if (mutation === "duplicate") rr.push(first);
    input.routes = rr;
    expect(() => scoreMappingStudy(input)).toThrow();
  });
  it("deadline censoring withholds a completed E output without fabricating provider failures", () => {
    const input = load();
    rebindProtocol(input, (p) => {
      p.routeTimeoutMs = 15;
    });
    const { protocol } = readStudyProtocol(input.protocol),
      source = bindStudySource(protocol, input.source),
      rs = records(input);
    input.routes = source.dialects.flatMap((d) =>
      [1, 2, 3].map((repeat) =>
        synthesizeStudyRoute(
          protocol,
          rs.find(
            (r) =>
              r.candidateId === "control-p" &&
              r.dialectId === d.input.dialectId &&
              r.repeat === repeat,
          ),
          rs.find(
            (r) =>
              r.candidateId === "control-e" &&
              r.dialectId === d.input.dialectId &&
              r.repeat === repeat,
          ),
          d,
        ),
      ),
    );
    const summary = scoreMappingStudy(input),
      route = summary.routes[0]!;
    expect(route.rescue.numerator).toBe("0");
    expect(route.deadlineViolations.numerator).not.toBe("0");
    expect(route.byTag.ALL!.providerFailed.numerator).toBe("0");
  });
  it("does not count live operating attempts in the grid or use unobserved families for a safety bound", () => {
    const input = load();
    rebindProtocol(input, (p) => {
      p.liveSampleDialectIds = ["d-003"];
    });
    const { protocol } = readStudyProtocol(input.protocol);
    const source = bindStudySource(protocol, input.source),
      rs = records(input);
    const dialect = source.dialects.find((d) => d.input.dialectId === "d-003")!;
    const sample = rs
      .filter((r) => r.dialectId === "d-003")
      .map((r) =>
        MappingStudyRunRecordSchema.parse({ ...r, phase: "LIVE_ROUTE" }),
      );
    input.records = [...rs, ...sample];
    input.routes = [1, 2, 3].map((repeat) => {
      const p = rs.find(
        (r) =>
          r.candidateId === "control-p" &&
          r.dialectId === "d-003" &&
          r.repeat === repeat,
      )!;
      const e = rs.find(
        (r) =>
          r.candidateId === "control-e" &&
          r.dialectId === "d-003" &&
          r.repeat === repeat,
      )!;
      const route = synthesizeStudyRoute(protocol, p, e, dialect);
      const actualP = sample.find(
        (r) => r.candidateId === p.candidateId && r.repeat === repeat,
      )!;
      const actualE = sample.find(
        (r) => r.candidateId === e.candidateId && r.repeat === repeat,
      )!;
      return {
        ...route,
        mode: "LIVE_SAMPLE",
        primaryRunHash: studyRecordHash(actualP),
        escalationRunHash: studyRecordHash(actualE),
        selectedRunHash: studyRecordHash(actualE),
        latencyMs: 35,
      };
    });
    const summary = scoreMappingStudy(input),
      actual = summary.routes[0]!;
    expect(summary.grid.recordedRuns).toBe("36");
    expect(summary.liveRouteRecordedCalls).toBe("6");
    expect(actual.latencySemantics).toBe("OBSERVED_ROUTE_LATENCY");
    expect(actual.comparisons).toEqual([]);
    expect(actual.zeroWrongExposureFamilyBound?.families).toBe("1");
    expect(actual.fullGrid).toBe(true);
    const liveRoutes = routes(input);
    liveRoutes[0]!.selectedRunHash = null;
    liveRoutes[0]!.finalStatus = "REVIEW_REQUIRED";
    liveRoutes[0]!.stop = "DEADLINE";
    input.routes = liveRoutes;
    expect(() => scoreMappingStudy(input)).toThrow(
      "Premature study route deadline",
    );
    liveRoutes[0]!.latencyMs = protocol.routeTimeoutMs;
    expect(scoreMappingStudy(input).routes[0]!.reviewRequired.numerator).toBe(
      "1",
    );
    input.routes = [];
    expect(() => scoreMappingStudy(input)).toThrow("Unreferenced live");
  });
  it("requires an unstopped offerable live primary to be selected while allowing deadline withholding", () => {
    const input = load();
    const coordinate = routes(input).find(
      (r) => r.reason === "PRIMARY_OFFERABLE" && r.stop === "NONE",
    )!;
    rebindProtocol(input, (p) => {
      p.liveSampleDialectIds = [coordinate.dialectId];
    });
    const { protocol } = readStudyProtocol(input.protocol),
      source = bindStudySource(protocol, input.source),
      rs = records(input);
    const dialect = source.dialects.find(
      (d) => d.input.dialectId === coordinate.dialectId,
    )!;
    const primary = rs.find(
      (r) =>
        r.candidateId === "control-p" &&
        r.dialectId === coordinate.dialectId &&
        r.repeat === coordinate.repeat,
    )!;
    const escalation = rs.find(
      (r) =>
        r.candidateId === "control-e" &&
        r.dialectId === primary.dialectId &&
        r.repeat === primary.repeat,
    )!;
    const actualPrimary = MappingStudyRunRecordSchema.parse({
      ...primary,
      phase: "LIVE_ROUTE",
    });
    const route = MappingStudyRouteRecordSchema.parse({
      ...synthesizeStudyRoute(protocol, primary, escalation, dialect),
      mode: "LIVE_SAMPLE",
      primaryRunHash: studyRecordHash(actualPrimary),
      selectedRunHash: studyRecordHash(actualPrimary),
    });
    input.records = [...rs, actualPrimary];
    input.routes = [route];
    expect(scoreMappingStudy(input).routes[0]!.safeCompletion).toEqual({
      numerator: "1",
      denominator: "1",
    });
    route.selectedRunHash = null;
    route.finalStatus = "REVIEW_REQUIRED";
    expect(() => scoreMappingStudy(input)).toThrow(
      "Offerable primary must be returned directly",
    );
    route.stop = "DEADLINE";
    expect(() => scoreMappingStudy(input)).toThrow(
      "Premature study route deadline",
    );
    route.latencyMs = protocol.routeTimeoutMs;
    expect(scoreMappingStudy(input).routes[0]!.reviewRequired.numerator).toBe(
      "1",
    );
    route.latencyMs = protocol.routeTimeoutMs + 1;
    expect(scoreMappingStudy(input).routes[0]!.reviewRequired).toEqual({
      numerator: "1",
      denominator: "1",
    });
  });
  it("does not start a synthetic E attempt when P consumes the whole deadline", () => {
    const input = load();
    rebindProtocol(input, (p) => {
      p.routeTimeoutMs = 10;
    });
    const { protocol } = readStudyProtocol(input.protocol),
      source = bindStudySource(protocol, input.source),
      rs = records(input);
    const dialect = source.dialects[0]!;
    const route = synthesizeStudyRoute(
      protocol,
      rs.find(
        (r) =>
          r.candidateId === "control-p" &&
          r.dialectId === dialect.input.dialectId &&
          r.repeat === 1,
      ),
      rs.find(
        (r) =>
          r.candidateId === "control-e" &&
          r.dialectId === dialect.input.dialectId &&
          r.repeat === 1,
      ),
      dialect,
    );
    expect(route).toMatchObject({
      stop: "DEADLINE",
      attemptedCalls: 1,
      escalationRunHash: null,
      selectedRunHash: null,
    });
    input.routes = [route];
    expect(
      scoreMappingStudy(input).routes[0]!.blockedEscalations.numerator,
    ).toBe("1");
  });
  it("retains a silent semantic error through validation and counts the wrong proposal exposed without escalation", () => {
    const input = load(),
      rs = records(input),
      rr = routes(input);
    const r = rs.find(
      (r) =>
        r.candidateId === "control-p" &&
        r.dialectId === "d-004" &&
        r.repeat === 1,
    )!;
    const order = r.parsedOutput!.fields.find(
      (f) => f.targetField === "orderId",
    )!;
    const counterparty = r.parsedOutput!.fields.find(
      (f) => f.targetField === "counterpartyId",
    )!;
    order.targetField = "counterpartyId";
    counterparty.targetField = "orderId";
    const route = rr.find(
      (route) => route.dialectId === r.dialectId && route.repeat === r.repeat,
    )!;
    route.primaryRunHash = studyRecordHash(r);
    route.selectedRunHash = route.primaryRunHash;
    input.records = rs;
    input.routes = rr;
    const summary = scoreMappingStudy(input),
      primary = summary.arms.find((a) => a.id === "control-p")!;
    expect(primary.wrongAttempts.numerator).toBe("4");
    expect(primary.wrongValidated.numerator).toBe("4");
    expect(primary.wrongExposure.numerator).toBe("1");
    expect(summary.routes[0]!.missedSilentErrors.numerator).toBe("1");
  });
  it("reports unknown route cost and no-additional-success as distinct incremental-cost outcomes", () => {
    const input = load();
    const known = scoreMappingStudy(input).routes[0]!;
    expect(known.incrementalCostPerSafeCompletion.reason).toBe("AVAILABLE");
    const rs = records(input);
    rs[0]!.inputTokens = null;
    const { protocol } = readStudyProtocol(input.protocol),
      source = bindStudySource(protocol, input.source);
    input.records = rs;
    input.routes = source.dialects.flatMap((d) =>
      [1, 2, 3].map((repeat) =>
        synthesizeStudyRoute(
          protocol,
          rs.find(
            (r) =>
              r.candidateId === "control-p" &&
              r.dialectId === d.input.dialectId &&
              r.repeat === repeat,
          ),
          rs.find(
            (r) =>
              r.candidateId === "control-e" &&
              r.dialectId === d.input.dialectId &&
              r.repeat === repeat,
          ),
          d,
        ),
      ),
    );
    expect(
      scoreMappingStudy(input).routes[0]!.incrementalCostPerSafeCompletion,
    ).toEqual({ reason: "UNKNOWN_COST", valueMicroUsd: null });
  });
  it("refuses AUDIT selection, reserved candidate IDs and live CLI flags", () => {
    expect(() => selectStudyModels(load())).toThrow("SELECT");
    const input = load();
    const { protocol } = readStudyProtocol(input.protocol);
    protocol.candidates[0]!.id = "B0";
    expect(() => readStudyProtocol(protocol)).toThrow();
    expect(() => runStudyScoreCommand(["--live"])).toThrow("offline only");
  });
});

describe("integer family analysis", () => {
  const config = {
    version: "family-bootstrap/1" as const,
    seed: "known-seed",
    resamples: 1000,
    tailProbability: { numerator: "1", denominator: "40" },
  };
  const pairs = [
    {
      familyId: "a",
      stratum: "easy",
      left: { numerator: "2", denominator: "3" },
      right: { numerator: "1", denominator: "3" },
    },
    {
      familyId: "b",
      stratum: "easy",
      left: { numerator: "0", denominator: "3" },
      right: { numerator: "2", denominator: "3" },
    },
    {
      familyId: "c",
      stratum: "hard",
      left: { numerator: "1", denominator: "3" },
      right: { numerator: "1", denominator: "3" },
    },
  ];
  it("pins exact stratified quantiles, retains pairings and ignores order", () => {
    const result = pairedFamilyBootstrap(pairs, config);
    expect(result).toMatchObject({
      independentFamilies: "3",
      point: { numerator: "-1", denominator: "9" },
      lower: { numerator: "-4", denominator: "9" },
      upper: { numerator: "2", denominator: "9" },
    });
    expect(pairedFamilyBootstrap([...pairs].reverse(), config)).toEqual(result);
    expect(result.strata).toEqual([
      { stratum: "easy", families: "2" },
      { stratum: "hard", families: "1" },
    ]);
  });
  it("does not multiply independent sample size by repeats or mask a degenerate interval", () => {
    const repeated = pairs.map((p) => ({
      ...p,
      left: {
        numerator: String(BigInt(p.left.numerator) * 7n),
        denominator: "21",
      },
      right: {
        numerator: String(BigInt(p.right.numerator) * 7n),
        denominator: "21",
      },
    }));
    expect(pairedFamilyBootstrap(repeated, config)).toEqual(
      pairedFamilyBootstrap(pairs, config),
    );
    expect(
      pairedFamilyBootstrap(
        pairs.map((p) => ({ ...p, left: p.right })),
        config,
      ).degenerate,
    ).toBe(true);
  });
  it("brackets the exact one-sided zero-event family bound with integer powers", () => {
    const twelve = zeroEventFamilyUpperBound(12),
      sixty = zeroEventFamilyUpperBound(60);
    expect(
      compareCounts(twelve.upper, {
        numerator: "220923",
        denominator: "1000000",
      }),
    ).toBe(0);
    expect(
      compareCounts(sixty.upper, {
        numerator: "48703",
        denominator: "1000000",
      }),
    ).toBe(0);
    expect(
      compareCounts(zeroEventFamilyUpperBound(299).upper, {
        numerator: "1",
        denominator: "100",
      }),
    ).toBe(-1);
  });
  it("rejects duplicate family units, invalid probabilities and empty denominators", () => {
    expect(() => pairedFamilyBootstrap([pairs[0], pairs[0]], config)).toThrow(
      "Duplicate",
    );
    expect(() =>
      pairedFamilyBootstrap(pairs, {
        ...config,
        tailProbability: { numerator: "1", denominator: "2" },
      }),
    ).toThrow();
    expect(() =>
      pairedFamilyBootstrap(
        [{ ...pairs[0], left: { numerator: "0", denominator: "0" } }],
        config,
      ),
    ).toThrow();
  });
});
