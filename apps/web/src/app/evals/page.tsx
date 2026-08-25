const checks = [
  [
    "Row-order invariance",
    "Implemented",
    "Shuffle the same events; expect one canonical hash.",
  ],
  [
    "Exact duplicate tolerance",
    "Implemented",
    "Insert an identical source row; expect unchanged canonical events.",
  ],
  [
    "Time-format equivalence",
    "Planned",
    "Normalize ISO and epoch representations to the same instant.",
  ],
  [
    "Mapping accuracy",
    "Planned",
    "Compare structured proposals with a versioned gold mapping.",
  ],
  [
    "Scenario classification",
    "Planned",
    "Compare three synthetic cases with their declared outcomes.",
  ],
  [
    "Evidence completeness",
    "Planned",
    "Resolve each finding through eventId to rawRowHash.",
  ],
];

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
        {checks.map(([name, status, detail]) => (
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
