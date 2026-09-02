import Link from "next/link";

const roles = [
  {
    step: "01",
    title: "Interpret",
    text: "Constrained mapping proposals turn heterogeneous columns into a reviewable event contract.",
  },
  {
    step: "02",
    title: "Approve",
    text: "Ambiguity stops at a human gate. Unapproved model output never enters replay.",
  },
  {
    step: "03",
    title: "Replay",
    text: "Versioned code orders, deduplicates, calculates, and hashes the same input the same way.",
  },
  {
    step: "04",
    title: "Trace",
    text: "Every finding is designed to resolve to canonical events and source-row hashes.",
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="hero shell">
        <div className="eyebrow">AI-assisted · deterministic by design</div>
        <h1>
          Turn uncertain signals into <em>replayable evidence.</em>
        </h1>
        <p className="hero-copy">
          WeaveTrail constrains AI to interpreting heterogeneous event data,
          then hands approved inputs to a deterministic engine that preserves
          order, provenance, and a stable result hash.
        </p>
        <div className="hero-actions">
          <Link className="button primary" href="/lab">
            Run the fixture lab
          </Link>
          <Link className="button secondary" href="/architecture">
            Read the architecture
          </Link>
        </div>
        <div
          className="status-strip"
          aria-label="Current implementation status"
        >
          <span className="status-dot" />
          <strong>Foundation scaffold</strong>
          <span>Contracts · ordering · exact dedupe · canonical hash</span>
        </div>
      </section>

      <section className="shell system-section">
        <div className="section-heading">
          <span>Trust boundary</span>
          <h2>AI proposes. Versioned code decides.</h2>
        </div>
        <div className="role-grid">
          {roles.map((role) => (
            <article className="role-card" key={role.step}>
              <span className="role-step">{role.step}</span>
              <h3>{role.title}</h3>
              <p>{role.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell question-panel">
        <div>
          <span className="kicker">Bounded application</span>
          <h2>
            Does a short-window price lift satisfy a declared concentrated-buy
            pattern?
          </h2>
        </div>
        <div className="result-stack" aria-label="Closed result vocabulary">
          <span>SUPPORTED</span>
          <span>NOT_SUPPORTED</span>
          <span>INCONCLUSIVE</span>
        </div>
        <p>
          For a post-alert market-surveillance reviewer, WeaveTrail helps turn
          an alert that has already fired into reviewable evidence for more
          consistent, reviewable oversight. The displayed results are technical
          hypothesis states—not a finding of guilt, a causal claim, investment
          advice, an automated trading decision, or real-time surveillance.
        </p>
      </section>
    </main>
  );
}
