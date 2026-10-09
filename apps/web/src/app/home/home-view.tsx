"use client";

import Link from "next/link";
import React from "react";

import {
  FAILURE_LOG_ENTRIES,
  definitionLinks,
  fraction,
  percent,
} from "../evals/model-comparison-data";
import { GUIDE_STAGES, guideStageNames } from "../guide-stages";
import { useCopy, useLanguage } from "../i18n/language";
import {
  HOME_TERM_KEYS,
  homeCopy,
  type HomeEvaluation,
  type HomeTermKey,
} from "./copy";
import type { HomeSelection } from "./selection";

import "./home.css";

const TERM_MARK = /\[\[(\w+)\|([^\]]+)\]\]/g;

/** The plain text of a marked sentence, as a reader sees it. */
export function plainText(marked: string): string {
  return marked.replace(TERM_MARK, "$2");
}

const termId = (key: HomeTermKey) => `home-term-${key}`;

/**
 * Splits a marked sentence into text and term buttons. Each button opens its
 * explanation as a native popover, so Enter, Space and a tap all open it and
 * Escape or a tap outside closes it.
 */
function withTerms(marked: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of marked.matchAll(TERM_MARK)) {
    const [whole, key, label] = match;
    if (match.index > last) parts.push(marked.slice(last, match.index));
    parts.push(
      <button
        className="home-term"
        key={`${key}-${match.index}`}
        popoverTarget={termId(key as HomeTermKey)}
        type="button"
      >
        {label}
      </button>,
    );
    last = match.index + whole.length;
  }
  if (last < marked.length) parts.push(marked.slice(last));
  return parts;
}

export function HomeContent({
  selection,
  evaluation,
}: {
  selection: HomeSelection;
  evaluation: HomeEvaluation;
}) {
  const text = useCopy(homeCopy);
  const stageNames = useCopy(guideStageNames);
  const { language } = useLanguage();
  const answer = text.answer;
  const links = definitionLinks(language);
  const failureLog = `https://github.com/WeaveTrail/WeaveTrail/blob/develop/docs/AI_FAILURE_LOG${language === "ko" ? ".ko" : ""}.md`;
  const sentence =
    selection.state === "planned"
      ? answer.planned[selection.reason]
      : selection.escalation === null
        ? answer.primaryOnly(selection.primary)
        : answer.selected(selection.primary, selection.escalation);

  return (
    <main className="home">
      <section className="home-hero shell" aria-labelledby="home-title">
        <div className="home-answer">
          <div className="home-intro">
            <span className="eyebrow">{text.intro.eyebrow}</span>
            <h1 id="home-title">{text.intro.title}</h1>
            <p className="home-lede">{text.intro.lede}</p>
            <div className="hero-actions">
              <Link className="button primary" href="/replay?mode=guided">
                {answer.walkThrough}
              </Link>
              <Link className="button secondary" href="/evals">
                {answer.seeComparison}
              </Link>
            </div>
            <p className="home-walk-meta">{text.intro.walkMeta}</p>
          </div>

          <section className="home-ai" aria-labelledby="home-question">
            <span className="eyebrow">{answer.eyebrow}</span>
            <h2 id="home-question">{withTerms(answer.question)}</h2>
            <p
              className="home-answer-sentence"
              data-state={selection.state}
              id="home-answer"
            >
              {withTerms(sentence)}
            </p>
            {selection.state === "selected" ? (
              <dl className="home-facts" aria-label={answer.factsLabel}>
                <div>
                  <dt>{answer.primaryAccuracy}</dt>
                  <dd>
                    <a href={links.rule}>
                      {fraction(selection.primaryAccuracy)} ·{" "}
                      {percent(selection.primaryAccuracy)}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>{answer.validOutput}</dt>
                  <dd>
                    <a href={links.metrics}>
                      {fraction(selection.validOutput)} ·{" "}
                      {percent(selection.validOutput)}
                    </a>
                  </dd>
                </div>
              </dl>
            ) : null}
            {selection.state === "selected" ? (
              <p className="home-run">
                <a href={selection.sessionReceipt}>
                  {answer.runDate(selection.runDate)}
                </a>
              </p>
            ) : null}
            <p className="home-control" id="home-control">
              {withTerms(answer.control)}
            </p>
          </section>
          {HOME_TERM_KEYS.map((key) => (
            <div
              aria-labelledby={`${termId(key)}-title`}
              className="home-term-note"
              id={termId(key)}
              key={key}
              popover="auto"
              role="dialog"
            >
              <strong id={`${termId(key)}-title`}>
                {answer.terms[key][0]}
              </strong>
              <p>{answer.terms[key][1]}</p>
              <button
                className="button secondary"
                popoverTarget={termId(key)}
                popoverTargetAction="hide"
                type="button"
              >
                {answer.close}
              </button>
            </div>
          ))}
        </div>

        <figure className="home-flow" aria-labelledby="home-flow-title">
          <figcaption>
            <h2 className="eyebrow" id="home-flow-title">
              {text.flowLabel}
            </h2>
          </figcaption>
          <ol>
            {GUIDE_STAGES.map((stage, index) => (
              <li data-stage={stage} key={stage}>
                <span className="home-flow-index" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3>{stageNames[stage]}</h3>
                  <p>{text.stages[stage]}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="home-flow-stop">
            <span className="home-flow-state">{text.flowStop.state}</span>
            {text.flowStop.text}
          </p>
        </figure>
      </section>

      <section className="home-band" aria-labelledby="home-why">
        <div className="shell">
          <div className="section-heading">
            <span>{text.whyKicker}</span>
            <h2 id="home-why">{text.whyHeading}</h2>
          </div>
          <ol className="home-reasons">
            {text.reasons.map(([title, body]) => (
              <li key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="shell home-board" aria-labelledby="home-built">
        <h2 className="eyebrow" id="home-built">
          {text.boardKicker}
        </h2>
        <div className="home-board-columns">
          <div>
            <h3 className="home-board-label" data-status="implemented">
              {text.runsToday}
            </h3>
            <ul className="home-board-list">
              {(
                [
                  [
                    "/evals",
                    text.comparisonTitle,
                    text.comparison(evaluation.candidates, evaluation.runDate),
                  ],
                  ["/evals?view=failures", text.probesTitle, text.probes],
                  [
                    failureLog,
                    text.failureLogTitle,
                    text.failureLog(FAILURE_LOG_ENTRIES.length),
                  ],
                  ["/replay?mode=guided", text.guidedTitle, text.guided],
                ] as const
              ).map(([href, title, meta]) => (
                <li data-status="implemented" key={href}>
                  {href.startsWith("http") ? (
                    <a href={href}>
                      <strong>{title}</strong>
                      <span>{meta}</span>
                    </a>
                  ) : (
                    <Link href={href}>
                      <strong>{title}</strong>
                      <span>{meta}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="home-board-label" data-status="planned">
              {text.planned}
            </h3>
            <ul className="home-board-list">
              {text.plannedItems.map((item) => (
                <li data-status="planned" key={item}>
                  <strong>{item}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="home-boundary">
          {text.boundary} <Link href="/why">{text.gateLinkText}</Link>
        </p>
      </section>
    </main>
  );
}
