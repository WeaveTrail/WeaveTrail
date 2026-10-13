import { z } from "zod";
import {
  MappingStudyRunRecordSchema,
  requiresMappingOverride,
} from "@weavetrail/contracts";
import { sha256Canonical } from "@weavetrail/replay-engine";
import { eligibleMetrics } from "./mapping-selection";
import { compareCounts, type Count } from "./mapping-scorer";
import {
  scoreMappingStudy,
  type StudyScoreInput,
} from "./mapping-study-scorer";
import { bindStudySource } from "./mapping-study-data";
import { readStudyProtocol } from "./mapping-study-protocol";

/** Generic declared candidates; preserves the strengthened historical eligibility and A+B ordering. */
export function selectStudyModels(input: StudyScoreInput) {
  const summary = scoreMappingStudy(input);
  if (summary.split !== "SELECT" || !summary.grid.complete)
    throw new Error("Study selection requires a complete SELECT session");
  const { protocol } = readStudyProtocol(input.protocol),
    source = bindStudySource(protocol, input.source);
  const records = z.array(MappingStudyRunRecordSchema).parse(input.records);
  const candidates = summary.arms.filter((a) => a.role === "MODEL");
  const eligible = candidates.filter((arm) => {
    const metrics = arm.byTag.ALL!;
    return (
      eligibleMetrics(metrics) &&
      [
        metrics.injectionFollowed,
        metrics.inventedField,
        metrics.unflaggedNoTarget!,
      ].every((c) => BigInt(c.denominator) > 0n) &&
      records
        .filter((r) => r.candidateId === arm.id)
        .every((r) => r.parsedOutput !== null)
    );
  });
  const primaryAccuracy = (arm: (typeof candidates)[number]): Count => {
    const counts = ["CLEAR", "ABBREVIATED", "SYNONYM"].map(
      (tag) => arm.byTag[tag]!.strictAccuracy,
    );
    return {
      numerator: String(counts.reduce((a, c) => a + BigInt(c.numerator), 0n)),
      denominator: String(
        counts.reduce((a, c) => a + BigInt(c.denominator), 0n),
      ),
    };
  };
  const idOrder = (
    a: (typeof candidates)[number],
    b: (typeof candidates)[number],
  ) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const costOrder = (
    a: (typeof candidates)[number],
    b: (typeof candidates)[number],
  ) => {
    const left = a.byTag.ALL!.costMicroUsd,
      right = b.byTag.ALL!.costMicroUsd;
    const knownLeft = left.coveredRuns === left.totalRuns,
      knownRight = right.coveredRuns === right.totalRuns;
    if (knownLeft !== knownRight) return knownLeft ? -1 : 1;
    return knownLeft
      ? BigInt(left.sum) < BigInt(right.sum)
        ? -1
        : BigInt(left.sum) > BigInt(right.sum)
          ? 1
          : 0
      : 0;
  };
  const primary = eligible
    .filter(
      (a) =>
        (compareCounts(primaryAccuracy(a), {
          numerator: "90",
          denominator: "100",
        }) ?? -1) >= 0,
    )
    .sort(
      (a, b) =>
        costOrder(a, b) ||
        -compareCounts(primaryAccuracy(a), primaryAccuracy(b))! ||
        idOrder(a, b),
    )[0];
  const failed = new Set<string>();
  if (primary)
    for (const r of records.filter((r) => r.candidateId === primary.id)) {
      const d = source.dialects.find((d) => d.input.dialectId === r.dialectId)!;
      if (
        r.outcome !== "VALID" ||
        d.gold.columns.some(
          (g) =>
            g.status === "PROPOSED" &&
            r.parsedOutput?.fields.some(
              (f) => f.columnId === g.columnId && requiresMappingOverride(f),
            ),
        )
      )
        failed.add(r.dialectId);
    }
  const escalationCounts = eligible.map((arm) => {
    let a = 0n,
      b = 0n;
    for (const r of records.filter((r) => r.candidateId === arm.id)) {
      if (r.outcome !== "VALID") continue;
      const d = source.dialects.find((d) => d.input.dialectId === r.dialectId)!;
      for (const g of d.gold.columns) {
        const f = r.parsedOutput.fields.find((f) => f.columnId === g.columnId);
        if (
          !f ||
          f.targetField !== g.targetField ||
          f.transform !== g.transform ||
          f.status !== g.status ||
          (g.status === "PROPOSED" && requiresMappingOverride(f))
        )
          continue;
        if (g.tag === "AMBIGUOUS" || g.tag === "TRANSFORM_LURE") a++;
        if (failed.has(r.dialectId)) b++;
      }
    }
    return { arm, a: String(a), b: String(b), total: a + b };
  });
  const escalation = primary
    ? escalationCounts
        .filter((c) => c.arm.id !== primary.id)
        .sort(
          (a, b) =>
            (a.total > b.total ? -1 : a.total < b.total ? 1 : 0) ||
            -compareCounts(
              a.arm.byTag.ALL!.strictAccuracy,
              b.arm.byTag.ALL!.strictAccuracy,
            )! ||
            costOrder(a.arm, b.arm) ||
            idOrder(a.arm, b.arm),
        )[0]?.arm
    : undefined;
  return {
    summary,
    decision: {
      version: "mapping-study-selection-decision/1",
      rule: protocol.selectionRule,
      protocolHash: summary.protocolHash,
      summaryHash: sha256Canonical({
        ...summary,
        session: {
          status: summary.session.status,
          stopReason: summary.session.stopReason,
        },
      }),
      session: summary.session,
      status: summary.status,
      activation: "DISABLED",
      outcome: primary ? "SELECTED" : "NO_MODEL",
      primary: primary?.id ?? null,
      escalation: escalation?.id ?? null,
      eligible: eligible.map((a) => a.id),
      primaryFailedDialects: [...failed].sort(),
      escalationCounts: escalationCounts.map((c) => ({
        candidateId: c.arm.id,
        a: c.a,
        b: c.b,
        total: String(c.total),
      })),
      limitation:
        "SELECT chooses a pair; it does not measure routing adoption on AUDIT. A single eligible model yields no escalation model. Unsealed or unaudited inputs are exploratory only.",
    },
  };
}
