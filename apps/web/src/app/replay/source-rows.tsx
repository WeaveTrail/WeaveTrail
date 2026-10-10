"use client";

import React from "react";

import { replayCopy } from "./copy";
import { HashValue } from "./machine-values";
import { useReplayLanguage } from "./replay-language";
import type { ReplayScenarioOption, SyntheticProvenance } from "./types";

/**
 * Step 1 reads the committed source at a glance: what it is, how big it is,
 * and every row in one table with the original strings as committed. Where it
 * came from and its hash sit one disclosure below, not ahead of the rows.
 */
export function SourceRows({ scenario }: { scenario: ReplayScenarioOption }) {
  const text = replayCopy[useReplayLanguage()].source;
  const columns = [
    ...new Set(scenario.rows.flatMap((row) => Object.keys(row.values))),
  ];
  return (
    <section className="source-preview" aria-label={text.region}>
      <div className="source-summary">
        <ul className="source-facts">
          <li>
            {text.artifact} <code>{scenario.value}</code>
          </li>
          <li>
            <strong>{scenario.rows.length}</strong> {text.rows}
          </li>
          <li>
            <strong>{columns.length}</strong> {text.columns}
          </li>
          <li>{text.synthetic}</li>
        </ul>
        <p>{text.summary}</p>
      </div>
      <div
        aria-label={text.tableLabel}
        className="source-table-wrap"
        role="region"
        tabIndex={0}
      >
        <table className="source-table">
          <thead>
            <tr>
              <th scope="col">{text.rowHeader}</th>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenario.rows.map((row) => (
              <tr key={row.coordinate.rowNumber}>
                <th scope="row">{row.coordinate.rowNumber}</th>
                {columns.map((column) => (
                  <td key={column}>
                    {column in row.values ? (
                      <code>{row.values[column]}</code>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="source-provenance">
        <summary>{text.provenanceSummary}</summary>
        <HashValue scope="sourceArtifact" value={scenario.sourceArtifactHash} />
        {scenario.provenance && (
          <SourceProvenanceDetails provenance={scenario.provenance} />
        )}
      </details>
    </section>
  );
}

/** Who made the synthetic source, and its full committed record. */
export function SourceProvenanceDetails({
  provenance,
}: {
  provenance: SyntheticProvenance;
}) {
  const text = replayCopy[useReplayLanguage()].source;
  return (
    <section aria-label={text.provenanceLabel}>
      <h3>{provenance.title}</h3>
      <p>
        {text.attribution}: {provenance.attribution}
      </p>
      <p>
        <a href={provenance.recordUrl}>{text.recordLink}</a>
      </p>
    </section>
  );
}
