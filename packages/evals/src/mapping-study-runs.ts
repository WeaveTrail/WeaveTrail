import { z } from "zod";
import {
  MappingStudyRunRecordSchema,
  MappingStudyRouteRecordSchema,
  type MappingStudyRunRecord,
  type MappingStudyRouteRecord,
} from "@weavetrail/contracts";
import {
  validateColumnIdStructure,
  validateColumnIdOutput,
} from "@weavetrail/ai-harness/validator";
import { canonicalJson, sha256Canonical } from "@weavetrail/replay-engine";
import {
  type MappingStudyProtocol,
  readStudyProtocol,
} from "./mapping-study-protocol";
import {
  studyMappingInput,
  type BoundStudySource,
  type StudyDialect,
} from "./mapping-study-data";

/** Canonical evidence excludes the volatile session ID; binding checks retain it separately. */
export function studyRecordArtifact(
  record: MappingStudyRunRecord | MappingStudyRouteRecord,
) {
  const { sessionId, ...artifact } = record;
  void sessionId;
  return artifact;
}
export function studyRecordHash(
  record: MappingStudyRunRecord | MappingStudyRouteRecord,
) {
  return sha256Canonical(studyRecordArtifact(record));
}

export function studyReturnedOutput(record: MappingStudyRunRecord) {
  return {
    kind: "fields" as const,
    value: {
      fields: record.parsedOutput!.fields.map((field) => {
        const returned = { ...field };
        delete returned.sourceColumn;
        return returned;
      }),
    },
  };
}
type StudyRunInput = Pick<StudyDialect, "input" | "family">;

export function validateStudyRun(
  record: MappingStudyRunRecord,
  dialect: StudyRunInput,
) {
  if (
    record.familyId !== dialect.family.id ||
    record.inputHash !== dialect.input.inputHash
  )
    throw new Error("Study run family/input binding mismatch");
  if (record.parsedOutput === null) return;
  for (const field of record.parsedOutput.fields) {
    const column = dialect.input.projection.columns.find(
      (c) => c.columnId === field.columnId,
    );
    if (
      field.sourceColumn !== column?.name ||
      (!column && Object.hasOwn(field, "sourceColumn"))
    )
      throw new Error("Stored study column projection mismatch");
  }
  const validation = validateColumnIdStructure(
    studyReturnedOutput(record),
    studyMappingInput(dialect),
  );
  if ((record.outcome === "VALID") !== (validation.status === "VALID"))
    throw new Error("Stored study validator outcome mismatch");
  if (
    canonicalJson(validation.reasons) !== canonicalJson(record.validatorReasons)
  )
    throw new Error("Stored study validator reasons mismatch");
}
export function studyOfferable(
  record: MappingStudyRunRecord,
  dialect: StudyRunInput,
) {
  return (
    record.outcome === "VALID" &&
    validateColumnIdOutput(
      studyReturnedOutput(record),
      studyMappingInput(dialect),
    ).status === "VALID"
  );
}
export function studyRouteReason(
  primary: MappingStudyRunRecord,
  dialect: StudyRunInput,
): MappingStudyRouteRecord["reason"] {
  return studyOfferable(primary, dialect)
    ? "PRIMARY_OFFERABLE"
    : primary.outcome === "PROVIDER_FAILED"
      ? "PRIMARY_PROVIDER_FAILED"
      : primary.outcome === "CONTRACT_REJECTED"
        ? "PRIMARY_REJECTED"
        : "PRIMARY_REVIEW_REQUIRED";
}
/** Pure routing replay over recorded responses. Gold never influences branch selection. */
export function synthesizeStudyRoute(
  protocolInput: unknown,
  primaryInput: unknown,
  escalationInput: unknown,
  dialect: StudyRunInput,
) {
  const { protocol, hash } = readStudyProtocol(protocolInput);
  const primary = MappingStudyRunRecordSchema.parse(primaryInput),
    escalation = MappingStudyRunRecordSchema.parse(escalationInput);
  for (const record of [primary, escalation]) {
    if (record.protocolHash !== hash || record.evaluationSet.split !== "AUDIT")
      throw new Error("Route protocol/split mismatch");
    validateStudyRun(record, dialect);
  }
  if (
    primary.sessionId !== escalation.sessionId ||
    primary.dialectId !== escalation.dialectId ||
    primary.repeat !== escalation.repeat ||
    primary.candidateId === escalation.candidateId ||
    primary.phase !== "GRID" ||
    escalation.phase !== "GRID" ||
    primary.candidateId !== protocol.routingPair?.primary ||
    escalation.candidateId !== protocol.routingPair?.escalation
  )
    throw new Error("Unpaired study route runs");
  const reason = studyRouteReason(primary, dialect),
    escalate = reason !== "PRIMARY_OFFERABLE";
  const attemptEscalation =
    escalate && primary.latencyMs < protocol.routeTimeoutMs;
  const latency =
    BigInt(primary.latencyMs) +
    (attemptEscalation ? BigInt(escalation.latencyMs) : 0n);
  if (latency > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Route latency exceeds safe integer");
  const timedOut =
    latency > BigInt(protocol.routeTimeoutMs) ||
    (escalate && !attemptEscalation);
  const selected = timedOut
    ? null
    : escalate
      ? studyOfferable(escalation, dialect)
        ? escalation
        : null
      : primary;
  return MappingStudyRouteRecordSchema.parse({
    schemaVersion: "mapping-study-route/1",
    protocolHash: hash,
    sessionId: primary.sessionId,
    split: "AUDIT",
    familyId: primary.familyId,
    dialectId: primary.dialectId,
    inputHash: primary.inputHash,
    repeat: primary.repeat,
    mode: "SYNTHETIC",
    primaryRunHash: studyRecordHash(primary),
    escalationRunHash: attemptEscalation ? studyRecordHash(escalation) : null,
    selectedRunHash: selected ? studyRecordHash(selected) : null,
    reason,
    stop: timedOut ? "DEADLINE" : "NONE",
    attemptedCalls: attemptEscalation ? 2 : 1,
    reservations: attemptEscalation ? 2 : 1,
    latencyMs: Number(latency),
    finalStatus: selected ? "PROPOSAL_OFFERABLE" : "REVIEW_REQUIRED",
  });
}
export function bindStudyRuns(
  protocol: MappingStudyProtocol,
  source: BoundStudySource,
  recordsInput: unknown,
  sessionId: string,
) {
  const records = z.array(MappingStudyRunRecordSchema).parse(recordsInput),
    hash = sha256Canonical(protocol),
    seen = new Set<string>();
  return records
    .map((record) => {
      const candidate = protocol.candidates.find(
        (c) => c.id === record.candidateId,
      );
      const dialect = source.dialects.find(
        (d) => d.input.dialectId === record.dialectId,
      );
      if (
        !candidate ||
        !dialect ||
        record.protocolHash !== hash ||
        record.sessionId !== sessionId ||
        record.evaluationSet.sha256 !== source.hash ||
        record.evaluationSet.split !== source.split ||
        record.repeat > protocol.repeats ||
        record.provider !== candidate.provider ||
        record.requestedModel !== candidate.requestedModel ||
        record.temperature !== "0" ||
        Object.entries(candidate.stack).some(
          ([key, value]) =>
            record[key as keyof MappingStudyRunRecord] !== value,
        )
      )
        throw new Error("Undeclared study run configuration");
      if (
        record.phase === "LIVE_ROUTE" &&
        (source.split !== "AUDIT" ||
          !protocol.liveSampleDialectIds.includes(record.dialectId) ||
          !protocol.routingPair ||
          ![
            protocol.routingPair.primary,
            protocol.routingPair.escalation,
          ].includes(record.candidateId))
      )
        throw new Error("Undeclared live route sample");
      const key = canonicalJson([
        record.phase,
        record.candidateId,
        record.dialectId,
        record.repeat,
      ]);
      if (seen.has(key)) throw new Error("Duplicate study run");
      seen.add(key);
      validateStudyRun(record, dialect);
      return { record, dialect };
    })
    .sort((a, b) => {
      const x = canonicalJson([
          a.record.phase,
          a.record.candidateId,
          a.record.dialectId,
          a.record.repeat,
        ]),
        y = canonicalJson([
          b.record.phase,
          b.record.candidateId,
          b.record.dialectId,
          b.record.repeat,
        ]);
      return x < y ? -1 : x > y ? 1 : 0;
    });
}
