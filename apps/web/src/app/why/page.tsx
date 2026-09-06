import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import {
  CONCLUSION_NOT_METHOD,
  NO_UPSTREAM_INTEGRATION,
  OWN_REASONING_MARK,
  diagramAttribution,
  gateInputs,
  handoverStatements,
  layerAuthorities,
  lede,
  notClaimed,
  sources,
  upstreamStatements,
  type SourceId,
  type Statement,
} from "./why-content";

export const metadata: Metadata = {
  title: "Why the gate",
  description:
    "Where WeaveTrail sits relative to an existing surveillance pipeline: what detection already does, what it still hands to a person, and what each of the four layers may and may not do.",
  alternates: { canonical: "/why" },
};

function sourceFor(id: SourceId) {
  const source = sources.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`Statement cites an unlisted source: ${id}`);
  return source;
}

function Attributed({ statement }: { statement: Statement }) {
  if ("source" in statement) {
    const source = sourceFor(statement.source);
    return (
      <p className="attributed">
        {statement.text}{" "}
        <a
          aria-label={`Source ${source.marker}: ${source.publisher}, ${source.title}`}
          className="cite"
          href={`#source-${source.id}`}
        >
          [{source.marker}]
        </a>
      </p>
    );
  }
  return (
    <p className="attributed">
      <span className="reasoning-mark">{OWN_REASONING_MARK}</span>{" "}
      {statement.text}
    </p>
  );
}

export default function WhyPage() {
  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">Why the gate</span>
        <h1>An alert arrives. Someone still has to justify it.</h1>
        <Attributed statement={lede} />
        <p>
          This page states where WeaveTrail sits relative to that layer, what it
          asks of it, and what it refuses to do on its behalf.
        </p>
      </div>

      <figure className="layer-diagram gate-diagram">
        <div
          aria-label="Diagram: where the gate sits"
          className="diagram-frame"
          role="group"
          tabIndex={0}
        >
          {/* The SVG is served verbatim so the page and the repository documentation carry one committed diagram. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image would transform the committed diagram asset. */}
          <img
            alt="Three bands top to bottom: an existing upstream pipeline carries order and trade data into a surveillance system that emits an alert; beneath that output sits the gate, which asks for source executions, an approved review scope and a versioned hypothesis, runs four single-authority layers, and returns one of three results or a review state; beneath the gate an investigator reads the result and the rows behind it and decides what the case is"
            height={800}
            src="/diagrams/where-the-gate-sits.svg"
            width={960}
          />
        </div>
        <figcaption>
          <span className="panel-label">Reading the diagram</span>
          <p>
            The upper band is not part of WeaveTrail. The gate reads what that
            band concluded, never how it concluded it, and the decision stays in
            the lower band.
          </p>
          <Attributed statement={diagramAttribution} />
        </figcaption>
      </figure>

      <section className="panel" id="upstream">
        <span className="panel-label">
          01 · What upstream surveillance already does
        </span>
        {upstreamStatements.map((statement) => (
          <Attributed key={statement.text} statement={statement} />
        ))}
      </section>

      <section className="panel" id="handover">
        <span className="panel-label">
          02 · What it still hands to a person
        </span>
        {handoverStatements.map((statement) => (
          <Attributed key={statement.text} statement={statement} />
        ))}
      </section>

      <section className="panel" id="gate-position">
        <span className="panel-label">03 · Where the gate sits</span>
        <p>
          The gate sits after an alert or a referral and before an investigation
          concludes. Evaluating a pattern hypothesis needs all three declared
          inputs below, and a request missing one is refused. Normalization is
          the narrower path: with an approved mapping and no case manifest, a
          foundation replay returns ordering, deduplication and a canonical
          result hash, and no pattern verdict.
        </p>
        {gateInputs.map(([name, detail]) => (
          <div className="responsibility" key={name}>
            <strong>{name}</strong>
            <p>{detail}</p>
          </div>
        ))}
        <p>{CONCLUSION_NOT_METHOD}</p>
        <p>{NO_UPSTREAM_INTEGRATION}</p>
      </section>

      <section className="layer-authorities" id="layer-authority">
        <span className="panel-label">
          04 · What each of the four layers may and may not do
        </span>
        <div className="eval-list">
          {layerAuthorities.map((layer) => (
            <article className="eval-row layer-authority" key={layer.name}>
              <h2>{layer.name}</h2>
              <div>
                <p>
                  <strong>May.</strong> {layer.may}
                </p>
                <p>
                  <strong>May not.</strong> {layer.mayNot}
                </p>
              </div>
              <div>
                {layer.status ? (
                  <p>
                    <span className="pill">Status</span> {layer.status}
                  </p>
                ) : (
                  <p>
                    <span className="pill implemented">Implemented</span>{" "}
                    Enforced by contract on every replay request.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel" id="not-claimed">
        <span className="panel-label">05 · What this page does not claim</span>
        <ul className="claim-boundary">
          {notClaimed.map((claim) => (
            <li key={claim}>{claim}</li>
          ))}
        </ul>
      </section>

      <section className="panel" id="sources">
        <span className="panel-label">Sources</span>
        <p>
          Every sentence on this page about a system outside this repository
          resolves to one of these, in the lede and the diagram caption as well
          as the sections above. Anything marked &ldquo;{OWN_REASONING_MARK}
          &rdquo; is the project reasoning from them, not a published finding.
        </p>
        <ol className="source-list">
          {sources.map((source) => (
            <li id={`source-${source.id}`} key={source.id}>
              <span className="source-marker">[{source.marker}]</span>{" "}
              {source.publisher},{" "}
              <a href={source.href} rel="noreferrer" target="_blank">
                {source.title}
              </a>{" "}
              ({source.published}).
            </li>
          ))}
        </ol>
        <Link className="button" href="/architecture">
          See the implemented chain
        </Link>
      </section>
    </main>
  );
}
