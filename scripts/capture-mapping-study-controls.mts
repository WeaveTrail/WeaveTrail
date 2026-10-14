import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MappingStudyRunRecordSchema } from "../packages/contracts/src/index";
import { validateColumnIdStructure } from "../packages/ai-harness/src/mapping-output-validator";
import {
  canonicalJson,
  sha256Canonical,
} from "../packages/replay-engine/src/index";
import { sha256 } from "../packages/evals/src/mapping-corpus-generator";
import { readStudyProtocol } from "../packages/evals/src/mapping-study-protocol";
import {
  bindStudySource,
  studyMappingInput,
} from "../packages/evals/src/mapping-study-data";
import { synthesizeStudyRoute } from "../packages/evals/src/mapping-study-runs";
import { scoreMappingStudy } from "../packages/evals/src/mapping-study-scorer";
import { selectStudyModels } from "../packages/evals/src/mapping-study-selection";

// Authored controls exercise tools. They are never model measurements or corpus approvals.
const root = resolve(process.argv[2] ?? "dist/mapping-study-controls");
const read = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const b0 = read("packages/evals/fixtures/lexical-baseline-v3/vocabulary.json");
const b1 = read(
  "packages/evals/fixtures/strong-baseline-v1/configuration.json",
);
const families = read(
  "packages/evals/fixtures/mapping-study-v1/families.json",
) as {
  version: string;
  status: string;
  records: { id: string; dialectId: string; split: string; stratum: string }[];
};
for (const split of ["SELECT", "AUDIT"] as const) {
  const directory = resolve(root, split);
  mkdirSync(directory, { recursive: true });
  const write = (path: string, value: unknown) => {
    const bytes = `${canonicalJson(value)}\n`;
    writeFileSync(resolve(directory, path), bytes);
    return { bytes, sha256: sha256(bytes) };
  };
  const scoped = families.records.filter((f) => f.split === split);
  const selected =
    split === "SELECT"
      ? scoped
      : [...new Set(scoped.map((f) => f.stratum))].flatMap((s) =>
          scoped.filter((f) => f.stratum === s).slice(0, 2),
        );
  const ids = new Set(selected.map((f) => f.dialectId));
  const inputs = read(
    `packages/evals/fixtures/mapping-study-v1/${split}.inputs.json`,
  ) as { inputs: { dialectId: string }[] };
  const gold = read(
    `packages/evals/fixtures/mapping-study-v1/${split}.gold.json`,
  ) as { records: { dialectId: string }[] };
  const source = {
    inputs: write("inputs.json", {
      ...inputs,
      inputs: inputs.inputs.filter((d) => ids.has(d.dialectId)),
    }),
    gold: write("gold.json", {
      ...gold,
      records: gold.records.filter((d) => ids.has(d.dialectId)),
    }),
    families: write("families.json", { ...families, records: selected }),
  };
  const prices = write("prices.json", {
    version: "authored-control-prices/1",
    dated: "2026-10-13",
    provenance:
      "Authored synthetic tariffs for scorer testing, not provider prices.",
    entries: ["control-p", "control-e"].map((requestedModel, i) => ({
      provider: "authored-synthetic-controls",
      requestedModel,
      reportedModel: requestedModel,
      inputMicroUsdPerMillionTokens: i ? "5000000" : "1000000",
      outputMicroUsdPerMillionTokens: i ? "10000000" : "2000000",
    })),
  });
  const { protocol, hash } = readStudyProtocol({
    version: "mapping-study-protocol/1",
    status: "PLANNED",
    registrationHash: sha256(
      "Authored configuration fixture, not a pre-registration",
    ),
    auditHash: null,
    selectionRule: "mapping-study-selection/1",
    routingPolicy: "mapping-routing/1",
    repeats: 3,
    routingPair:
      split === "AUDIT"
        ? {
            primary: "control-p",
            escalation: "control-e",
            selectionDecisionHash: sha256(
              "Authored pair fixture, not an approved selection",
            ),
          }
        : null,
    liveSampleDialectIds: [],
    routeTimeoutMs: 60000,
    candidates: ["control-p", "control-e"].map((id) => ({
      id,
      provider: "authored-synthetic-controls",
      requestedModel: id,
      stack: {
        adapterVersion: "authored-study-controls/1",
        promptVersion: "synthetic-no-prompt/1",
        outputSchemaVersion: "mapping-fields/2",
        validatorVersion: "mapping-validator/3",
      },
    })),
    sources: [
      {
        split,
        inputsHash: source.inputs.sha256,
        goldHash: source.gold.sha256,
        familiesHash: source.families.sha256,
        seal: { status: "UNSEALED", independentReviewHash: null },
      },
    ],
    pricesHash: prices.sha256,
    references: {
      b0ConfigurationHash: sha256Canonical(b0),
      b1ConfigurationHash: sha256Canonical(b1),
      devHash: (b0 as { devSha256: string }).devSha256,
    },
    analysis: {
      version: "family-bootstrap/1",
      seed: "authored-study-fixture-seed",
      resamples: 1000,
      tailProbability: { numerator: "1", denominator: "40" },
    },
  });
  const bound = bindStudySource(protocol, source);
  const session = {
    id: `authored-controls-${split.toLowerCase()}`,
    status: "COMPLETED",
    stopReason: "NONE",
  };
  const records = bound.dialects.flatMap((dialect, index) =>
    protocol.candidates.flatMap((candidate) =>
      [1, 2, 3].map((repeat) => {
        const fields = dialect.gold.columns.map((g) => ({
          columnId: g.columnId,
          sourceColumn: g.sourceColumn,
          targetField: g.targetField,
          transform: g.transform,
          status: g.status,
          confidence: g.targetField === null ? 0 : 1,
          evidence: "Authored synthetic control; not a provider observation.",
        }));
        // On AUDIT, P has a visible review flag on one otherwise offerable family.
        if (split === "AUDIT" && candidate.id === "control-p" && index === 0)
          fields.find((f) => f.targetField !== null)!.status =
            "REVIEW_REQUIRED";
        const validation = validateColumnIdStructure(
          {
            kind: "fields",
            value: {
              fields: fields.map(({ sourceColumn, ...f }) => {
                void sourceColumn;
                return f;
              }),
            },
          },
          studyMappingInput(dialect),
        );
        return MappingStudyRunRecordSchema.parse({
          schemaVersion: "mapping-study-run/1",
          phase: "GRID",
          protocolHash: hash,
          sessionId: session.id,
          candidateId: candidate.id,
          familyId: dialect.family.id,
          inputHash: dialect.input.inputHash,
          evaluationSet: {
            version: "mapping-study-inputs/1",
            split,
            sha256: source.inputs.sha256,
          },
          dialectId: dialect.input.dialectId,
          repeat,
          provider: candidate.provider,
          requestedModel: candidate.requestedModel,
          reportedModel: candidate.requestedModel,
          ...candidate.stack,
          temperature: "0",
          latencyMs: candidate.id === "control-p" ? 10 : 20,
          inputTokens: 100,
          outputTokens: 100,
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
  const routes =
    split === "AUDIT"
      ? bound.dialects.flatMap((d) =>
          [1, 2, 3].map((repeat) =>
            synthesizeStudyRoute(
              protocol,
              records.find(
                (r) =>
                  r.candidateId === "control-p" &&
                  r.dialectId === d.input.dialectId &&
                  r.repeat === repeat,
              ),
              records.find(
                (r) =>
                  r.candidateId === "control-e" &&
                  r.dialectId === d.input.dialectId &&
                  r.repeat === repeat,
              ),
              d,
            ),
          ),
        )
      : [];
  write("b0.json", b0);
  write("b1.json", b1);
  write("protocol.json", protocol);
  write("records.json", records);
  write("routes.json", routes);
  write("session.json", session);
  const result =
    split === "SELECT"
      ? selectStudyModels({
          protocol,
          source,
          session,
          records,
          references: { b0, b1 },
          prices,
        })
      : scoreMappingStudy({
          protocol,
          source,
          session,
          records,
          routes,
          references: { b0, b1 },
          prices,
        });
  write(split === "SELECT" ? "selection.json" : "summary.json", result);
  write("bundle.json", {
    version: "mapping-study-bundle/1",
    protocol: "protocol.json",
    inputs: "inputs.json",
    gold: "gold.json",
    families: "families.json",
    prices: "prices.json",
    b0: "b0.json",
    b1: "b1.json",
    session: "session.json",
    records: "records.json",
    routes: "routes.json",
  });
}
console.log(
  "Captured authored synthetic controls; no model calls or approvals.",
);
