const layers = [
  [
    "Interpretation",
    "Model output is untrusted and limited to known columns, allowed transforms, and a versioned proposal schema.",
  ],
  [
    "Approval",
    "Ambiguous mappings and case scope stop for human review before replay.",
  ],
  [
    "Decision",
    "Versioned code owns ordering, deduplication, calculation, evaluation, and hashes.",
  ],
  [
    "Evidence",
    "Stable findings retain event identities and source-row provenance.",
  ],
];

export default function ArchitecturePage() {
  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">Architecture</span>
        <h1>One uncertain boundary. One deterministic core.</h1>
        <p>
          The model narrows semantic ambiguity; it never owns the replay result.
          Invalid or unapproved proposals stop before deterministic execution.
        </p>
      </div>
      <section className="eval-list">
        {layers.map(([name, detail], index) => (
          <article className="eval-row" key={name}>
            <span className="pill">0{index + 1}</span>
            <h2>{name}</h2>
            <p>{detail}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
