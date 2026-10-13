import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MappingStudyRunRecordSchema,
  MappingStudyRouteRecordSchema,
} from "@weavetrail/contracts";
import { canonicalJson, sha256Canonical } from "@weavetrail/replay-engine";
import { readStudyBundle, runStudyScoreCommand } from "./score-mapping-study";
import { scoreMappingStudy } from "./mapping-study-scorer";
import { selectStudyModels } from "./mapping-study-selection";
import {
  pairedFamilyBootstrap,
  zeroEventFamilyUpperBound,
} from "./mapping-study-analysis";
import { compareCounts } from "./mapping-scorer";
import { readStudyProtocol } from "./mapping-study-protocol";
import { bindStudySource } from "./mapping-study-data";
import { synthesizeStudyRoute, studyRecordHash } from "./mapping-study-runs";

const path = (split: string, name: string) =>
  fileURLToPath(
    new URL(
      `../fixtures/mapping-study-tools-v1/${split}/${name}`,
      import.meta.url,
    ),
  );
const load = (split = "AUDIT") => readStudyBundle(path(split, "bundle.json"));
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
    input.routes = [];
    expect(() => scoreMappingStudy(input)).toThrow("Unreferenced live");
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
