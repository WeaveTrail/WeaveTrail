type Evidence = { file: string; titles: readonly string[] };

type ImplementedCheck = {
  name: string;
  status: "Implemented";
  detail: string;
  evidence: readonly Evidence[];
};

type PlannedCheck = {
  name: string;
  status: "Planned";
  detail: string;
  evidence?: never;
};

export const checks = [
  {
    name: "Row-order invariance",
    status: "Implemented",
    detail: "Shuffle the same events; expect one canonical hash.",
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
    detail: "Pin a committed fixture to its literal canonical result hash.",
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
    detail:
      "Insert an identical source row; expect unchanged canonical events.",
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
    detail: "Reject conflicting reuse of an event or source identity.",
    evidence: [
      {
        file: "packages/replay-engine/src/replay-foundation.test.ts",
        titles: [
          "rejects a shared event identifier independent of input order",
          "rejects conflicting reuse of a source identity independent of input order",
        ],
      },
    ],
  },
  {
    name: "Time-format equivalence",
    status: "Implemented",
    detail: "Normalize equivalent offset and Z timestamps to the same instant.",
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
    detail: "Preserve supported precision and reject timestamps beyond it.",
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
    detail: "Order canonical keys by UTF-16 code units without locale data.",
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
    detail: "Exclude collection metadata from the canonical result hash.",
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
    detail:
      "Fail closed on mixed sequence presence and define the all-absent order.",
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
    detail:
      "Replay equivalent committed source dialects to one canonical result.",
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
    detail:
      "Keep dataset profiles stable across shuffling and source dialects.",
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
    detail:
      "Bind approval to the validated proposal and its executed transforms.",
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
    detail:
      "Reject omitted declared rows or approved columns before result hashing.",
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
    detail:
      "Report per-field agreement between mapped canonical events and each mapping application's review outcome.",
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
    status: "Planned",
    detail:
      "Exercise a committed scenario that reaches the review-required outcome.",
  },
  {
    name: "Scenario classification",
    status: "Planned",
    detail: "Compare synthetic cases with their declared outcomes.",
  },
  {
    name: "Evidence completeness",
    status: "Planned",
    detail: "Resolve each finding through eventId to rawRowHash.",
  },
] as const satisfies readonly (ImplementedCheck | PlannedCheck)[];

export default function EvalsPage() {
  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">Evaluation ledger</span>
        <h1>Measured evidence only.</h1>
        <p>
          This page distinguishes runnable invariants from future measurements.
          Targets do not become results until their cases, command, environment,
          and limitations are committed.
        </p>
      </div>
      <section className="eval-list">
        {checks.map(({ name, status, detail }) => (
          <article className="eval-row" key={name}>
            <span
              className={status === "Implemented" ? "pill implemented" : "pill"}
            >
              {status}
            </span>
            <h2>{name}</h2>
            <p>{detail}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
