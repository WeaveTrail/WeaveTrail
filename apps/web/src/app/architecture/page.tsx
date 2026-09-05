import type { Metadata } from "next";
import React from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Architecture",
  description:
    "Review WeaveTrail's trust boundary between untrusted interpretation, human approval, deterministic decisions, and traceable evidence.",
  alternates: { canonical: "/architecture" },
};

const layers = [
  [
    "L1 · Interpret",
    "A constrained mapper proposes targets, transforms, confidence and evidence. Today's provider is a deterministic fixture; live model adapters are planned. It cannot edit rows or decide results.",
  ],
  [
    "L2 · Approve",
    "A person approves the exact mapping and authored case proposal by hash. Flagged fields require a justified override. Approval cannot edit a computed result.",
  ],
  [
    "L3 · Decide",
    "Versioned code owns ordering, deduplication, calculation, evaluation, and hashes.",
  ],
  [
    "L4 · Evidence",
    "The server resolves findings to canonical eventId, rawRowHash, artifact coordinates and unchanged raw values. Unresolvable lineage is refused. INCONCLUSIVE has no finding evidence.",
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
      <section className="panel">
        <h2>From source rows to evidence</h2>
        <ol className="component-chain">
          <li>
            Committed source rows <span>Untrusted input</span>
          </li>
          <li>
            Schema mapper <span>Fixture proposal</span>
          </li>
          <li>
            Mapping approval <span>Person · exact proposal hash</span>
          </li>
          <li>
            Canonical event set{" "}
            <span>Code · re-derived from approved mapping</span>
          </li>
          <li>
            Dataset profile <span>Code · bounded facts</span>
          </li>
          <li>
            Bounded case proposer{" "}
            <span className="pill">Planned · authored manifests today</span>
          </li>
          <li>
            Case approval <span>Person · exact scope hash</span>
          </li>
          <li>
            Replay engine <span>Code · five rule gates</span>
          </li>
          <li>
            Finding source trace <span>Code · original rows</span>
          </li>
          <li>
            Evidence Bundle assembly <span className="pill">Planned</span>
          </li>
        </ol>
        <p>A refused request carries a review state and no result hash.</p>
      </section>
      <section className="eval-list">
        {layers.map(([name, detail], index) => (
          <article className="eval-row" key={name}>
            <span className="pill">0{index + 1}</span>
            <h2>{name}</h2>
            <p>{detail}</p>
          </article>
        ))}
      </section>
      <section className="panel architecture-hash">
        <h2>What the canonical hash covers</h2>
        <p>
          <code>canonicalReplayResultHash</code> hashes the engine version,
          semantic event projection and evaluation when present. Volatile run
          metadata is excluded.
        </p>
        <p>
          Complete approval records, all mapping and manifest fields, and source
          trace are not protected by this result hash. A future bundle hash and
          independent bundle assembly and verification remain planned.
        </p>
        <p>
          The browser&apos;s guide progress is presentation state. Each API
          replay creates a request-local workflow; durable audit history is not
          implemented.
        </p>
        <Link className="button" href="/replay?mode=guided">
          Walk through a case
        </Link>
      </section>
    </main>
  );
}
