const states = [
  [
    "SUPPORTED",
    "Validated data satisfies every required threshold in the approved rule version.",
  ],
  [
    "NOT_SUPPORTED",
    "Data is sufficient, but one or more required thresholds are not satisfied.",
  ],
  [
    "INCONCLUSIVE",
    "Approved inputs entered replay, but valid evidence was insufficient for the declared comparison.",
  ],
  [
    "REVIEW_REQUIRED",
    "A pre-replay mapping, identity, scope, or approval problem requires human review; this is not a replay result.",
  ],
];

export default function MethodologyPage() {
  return (
    <main className="shell page-shell methodology">
      <div className="page-heading">
        <span className="eyebrow">Methodology & boundaries</span>
        <h1>A narrow question with explicit abstention.</h1>
        <p>
          The implemented synthetic reference cases evaluate a versioned
          technical pattern. They do not produce legal or causal conclusions.
        </p>
      </div>
      <section className="method-grid">
        <article className="panel">
          <span className="panel-label">Closed result vocabulary</span>
          {states.map(([state, meaning]) => (
            <div className="state-row" key={state}>
              <strong>{state}</strong>
              <p>{meaning}</p>
            </div>
          ))}
        </article>
        <article className="panel">
          <span className="panel-label">Responsibility split</span>
          <div className="responsibility">
            <strong>AI may</strong>
            <p>
              Propose column meanings, bounded case scope, and human-readable
              explanations.
            </p>
          </div>
          <div className="responsibility">
            <strong>Code must</strong>
            <p>
              Validate, order, deduplicate, calculate, evaluate, hash, and
              preserve traceability.
            </p>
          </div>
          <div className="responsibility">
            <strong>Neither may</strong>
            <p>
              Determine guilt, invent missing critical facts, recommend trades,
              or execute orders.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
