/**
 * The engine checks behind every replay result. Each implemented check names
 * the committed test titles that hold it; a planned one names none. `name` is
 * the check's identity, the one docs/EVALUATION.md uses; what a reader sees is
 * in the ledger copy.
 */
type Evidence = { file: string; titles: readonly string[] };

type ImplementedCheck = {
  name: string;
  status: "Implemented";
  evidence: readonly Evidence[];
};

type PlannedCheck = {
  name: string;
  status: "Planned";
  evidence?: never;
};

export const checks = [
  {
    name: "Row-order invariance",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/replay-foundation.test.ts",
        titles: [
          "produces the same canonical result after row shuffling",
          "pins every committed four-event fixture permutation to the golden hash",
        ],
      },
    ],
  },
  {
    name: "Literal golden hash",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/replay-foundation.test.ts",
        titles: ["pins the concentrated-buy canonical result hash"],
      },
    ],
  },
  {
    name: "Exact duplicate tolerance",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/replay-foundation.test.ts",
        titles: [
          "collapses an exact source-identity duplicate without an event identifier conflict",
        ],
      },
    ],
  },
  {
    name: "Identity-conflict rejection",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/replay-foundation.test.ts",
        titles: [
          "rejects a shared event identifier independent of input order",
          "rejects conflicting reuse of a source identity independent of input order",
        ],
      },
      {
        file: "packages/replay-engine/src/published-execution-schema.test.ts",
        titles: [
          "routes committed conflicting FIX identity evidence to input review with no result hash",
        ],
      },
    ],
  },
  {
    name: "Time-format equivalence",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/replay-foundation.test.ts",
        titles: [
          "normalizes equivalent offset and Z event times before hashing",
          "normalizes explicit offsets across a UTC date boundary",
        ],
      },
    ],
  },
  {
    name: "Sub-millisecond order",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/replay-foundation.test.ts",
        titles: [
          "preserves event ordering within one millisecond",
          "rejects event times finer than the supported nanosecond precision",
        ],
      },
    ],
  },
  {
    name: "Locale-independent order",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/replay-foundation.test.ts",
        titles: [
          "orders non-ASCII keys by UTF-16 code units without locale data",
          "uses UTF-16 code-unit order for equal-time and equal-sequence event IDs",
        ],
      },
    ],
  },
  {
    name: "Volatile-metadata exclusion",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/replay-foundation.test.ts",
        titles: [
          "excludes receivedAt from the canonical result hash",
          "classifies every TradeEvent field as protected or collection metadata",
        ],
      },
    ],
  },
  {
    name: "Mixed-sequence policy",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/replay-foundation.test.ts",
        titles: [
          "fails closed when sequence presence is mixed",
          "uses event ID when every equal-time event omits sequence",
        ],
      },
    ],
  },
  {
    name: "Dialect convergence",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/source-ingest.test.ts",
        titles: [
          "converges equivalent source dialects to one canonical dataset and result",
        ],
      },
      {
        file: "apps/web/src/app/api/replay/route.test.ts",
        titles: ["replays both committed dialects to the same result hash"],
      },
    ],
  },
  {
    name: "Dataset-profile determinism",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/dataset-profile.test.ts",
        titles: [
          "is deterministic under event shuffling",
          "is identical across the two committed source dialects",
        ],
      },
    ],
  },
  {
    name: "Mapping-approval binding",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/approval-validation.test.ts",
        titles: [
          "rejects an approval bound to a different artifact",
          "makes an approved transform change affect the gate outcome",
        ],
      },
      {
        file: "apps/web/src/app/api/replay/route.test.ts",
        titles: ["rejects a forged approval"],
      },
    ],
  },
  {
    name: "Record-set completeness",
    status: "Implemented",
    evidence: [
      {
        file: "apps/web/src/app/api/replay/route.test.ts",
        titles: [
          "rejects omitted declared rows without returning a result hash",
          "rejects an omitted approved column with its row and column",
        ],
      },
      {
        file: "packages/replay-engine/src/source-ingest.test.ts",
        titles: [
          "pins each complete declared row set to its committed artifact parser",
        ],
      },
    ],
  },
  {
    name: "Mapping agreement reporting",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/source-ingest.test.ts",
        titles: [
          "reports field-level mapping agreement counts and review outcomes",
        ],
      },
    ],
  },
  {
    name: "Reachable mapping review",
    status: "Implemented",
    evidence: [
      {
        file: "packages/ai-harness/src/fixture-provider.test.ts",
        titles: [
          "reaches source_note review-required through committed dialect B",
          "keeps dialect A fully resolvable",
        ],
      },
      {
        file: "apps/web/src/app/api/replay/route.test.ts",
        titles: [
          "requires a field override before replaying dialect B",
          "replays dialect B after a justified source_note override",
        ],
      },
    ],
  },
  {
    name: "Scenario classification",
    status: "Implemented",
    evidence: [
      {
        file: "packages/replay-engine/src/published-execution-schema.test.ts",
        titles: [
          "pins the artifact, dataset, manifest approval and canonical result hashes",
        ],
      },
      {
        file: "packages/replay-engine/src/rapid-price-lift-golden.test.ts",
        titles: [
          "pins rapid-price-lift-insufficient-evidence.csv to INCONCLUSIVE",
        ],
      },
      {
        file: "packages/replay-engine/src/published-execution-not-supported.test.ts",
        titles: [
          "pins NOT_SUPPORTED, the failing gates and result hash through approved %s replay",
        ],
      },
    ],
  },
  {
    name: "Evidence completeness",
    status: "Implemented",
    evidence: [
      {
        file: "packages/evals/src/runner.test.ts",
        titles: [
          "rejects unresolved references and source-row tampering",
          "rejects a changed published trace reference",
        ],
      },
    ],
  },
  {
    name: "Versioned fixture evaluation",
    status: "Implemented",
    evidence: [
      {
        file: "packages/evals/src/publication.test.ts",
        titles: [
          "reproduces the committed evaluation without updating any oracle",
        ],
      },
    ],
  },
  {
    name: "Independent provider accuracy",
    status: "Planned",
  },
] as const satisfies readonly (ImplementedCheck | PlannedCheck)[];
