"use client";

import React from "react";

import { useCopy, useLanguage } from "../i18n/language";
import type { checks as committedChecks } from "./checks";
import { ledgerCopy } from "./copy";
import type { HeldOutResult } from "./model-comparison-data";
import { ModelComparison } from "./model-comparison";

import "./evals.css";

/**
 * The comparison is the page's answer. The engine checks fold under one
 * summary line below it, with their implemented and planned counts.
 */
export function EvalsContent({
  checks,
  heldOut,
}: {
  checks: typeof committedChecks;
  heldOut: HeldOutResult | null;
}) {
  const { language } = useLanguage();
  const text = useCopy(ledgerCopy);
  const implemented = checks.filter(
    (check) => check.status === "Implemented",
  ).length;
  return (
    <main className="shell page-shell">
      <ModelComparison result={heldOut} />
      <details className="ledger">
        <summary>
          <span className="eyebrow">{text.eyebrow}</span>
          <span className="ledger-summary">
            <strong>{text.title}</strong>
            <span>{text.counts(implemented, checks.length - implemented)}</span>
          </span>
        </summary>
        <div className="page-heading ledger-heading">
          <p>{text.lede}</p>
          <p>{text.history}</p>
          <p>
            <a
              href={`https://github.com/WeaveTrail/WeaveTrail/blob/develop/docs/EVALUATION${language === "ko" ? ".ko" : ""}.md`}
            >
              {text.protocolLink}
            </a>
          </p>
        </div>
        <section className="eval-list">
          {checks.map((check) => {
            const [name, detail] = text.checks[check.name];
            return (
              <article className="eval-row" key={check.name}>
                <span
                  className={
                    check.status === "Implemented" ? "pill implemented" : "pill"
                  }
                >
                  {text.status[check.status]}
                </span>
                <h2>{name}</h2>
                <div>
                  <p>{detail}</p>
                  {check.status === "Implemented" ? (
                    <ul className="eval-tests" aria-label={text.testsLabel}>
                      {check.evidence.map(({ file, titles }) => (
                        <li key={file}>
                          <a
                            href={`https://github.com/WeaveTrail/WeaveTrail/blob/develop/${file}`}
                          >
                            <code>{file}</code>
                          </a>
                          <ul>
                            {titles.map((title) => (
                              <li key={title}>{title}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      </details>
    </main>
  );
}
