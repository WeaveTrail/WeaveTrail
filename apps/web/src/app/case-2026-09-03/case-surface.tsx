"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import type {
  ApprovalRecord,
  CaseManifestV14Proposal,
} from "@weavetrail/contracts";

import { type Language } from "../i18n/language";
import { attemptApproval } from "../replay/case-replay";
import { HashValue, Instant } from "../replay/machine-values";
import { ReplayLanguageContext } from "../replay/replay-language";
import type {
  PublishedCaseReplay,
  PublishedLegColumns,
  SessionDay,
} from "../../lib/published-case";
import { caseCopy, type Chapter as ChapterCopy } from "./case-copy";
import {
  BaselineRankFigures,
  DenominatorDivergenceFigures,
} from "./observation-figures";
import { BaselineRangeChart, IntradaySessionChart } from "./session-chart";
import {
  INTRADAY_HIGH,
  INTRADAY_LOW,
  INTRADAY_SESSION,
} from "./intraday-session";

/**
 * One numbered step of the case. The purpose line says what the chapter is for
 * before its content arrives, so a reader who knows none of the vocabulary
 * still knows why they are looking at it.
 */
function Chapter({
  chapter,
  children,
  hidden,
  index,
}: {
  chapter: ChapterCopy;
  children: React.ReactNode;
  hidden?: boolean;
  index: number;
}) {
  return (
    <section
      aria-labelledby={`chapter-${index}`}
      className="case-chapter"
      hidden={hidden}
    >
      <header className="chapter-head">
        <span aria-hidden="true" className="chapter-number">
          {index}
        </span>
        <div>
          {/* Moving chapter moves focus here, so a keyboard or screen reader
              user lands in the chapter they asked for rather than staying put
              on a page whose visible content silently changed. */}
          <h2 id={`chapter-${index}`} tabIndex={-1}>
            {chapter.title}
          </h2>
          <p className="chapter-purpose">{chapter.purpose}</p>
        </div>
      </header>
      <div className="chapter-body">{children}</div>
    </section>
  );
}

type Rule = Extract<
  CaseManifestV14Proposal["rules"][number],
  { ruleId: "CROSS_MARKET_SESSION_REVERSAL" }
>;

export const PUBLISHED_CASE_THRESHOLD_ORIGIN_ID =
  "published-case-threshold-origin";

export const PUBLISHED_CASE_APPROVAL_ERROR_ID = "published-case-approval-error";

export const PUBLISHED_CASE_RUN_ERROR_ID = "published-case-run-error";

/** The chapter holding this element, by position, or null when it is in none. */
function chapterOf(id: string): number | null {
  const chapter = document.getElementById(id)?.closest(".case-chapter");
  if (!chapter) return null;
  const position = [...document.querySelectorAll(".case-chapter")].indexOf(
    chapter,
  );
  return position === -1 ? null : position;
}

function focusTarget(id: string) {
  const target = document.getElementById(id);
  if (!(target instanceof HTMLElement)) return;
  target.scrollIntoView({ block: "center" });
  target.focus({ preventScroll: true });
}

/**
 * A threshold's provenance is fixed in the chapter that set the scope, while
 * the findings citing it are read two chapters later. The link keeps its
 * fragment so it stays copyable, and `onNavigate` lets the surface open the
 * chapter holding the target: without it the fragment points into a chapter
 * the reader cannot see, and following it does nothing.
 */
export function ThresholdOriginReference({
  label,
  onNavigate,
}: {
  label: string;
  onNavigate?: (id: string) => void;
}) {
  return (
    <small>
      <a
        href={`#${PUBLISHED_CASE_THRESHOLD_ORIGIN_ID}`}
        onClick={() => onNavigate?.(PUBLISHED_CASE_THRESHOLD_ORIGIN_ID)}
      >
        {label}
      </a>
    </small>
  );
}

export function PublishedCaseSurface({
  columns,
  proposal,
  spot,
  spotArtifactHash,
  futureArtifactHash,
  language,
}: {
  columns: readonly PublishedLegColumns[];
  proposal: CaseManifestV14Proposal;
  spot: readonly SessionDay[];
  spotArtifactHash: string;
  futureArtifactHash: string;
  language: Language;
}) {
  const text = caseCopy[language];
  const [approval, setApproval] = useState<ApprovalRecord | null>(null);
  const [result, setResult] = useState<PublishedCaseReplay | null>(null);
  const [running, setRunning] = useState(false);
  // Approval and the run refuse in different chapters, so each keeps its own
  // refusal and renders it beside the control that produced it. A single
  // shared error could only be rendered in one place, and the other chapter's
  // failure would be silent.
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  // The case is a procedure, so it is read one chapter at a time. Every
  // chapter stays in the document and the inactive ones are `hidden`, which
  // keeps the whole case in the served markup for a reader without scripting
  // and for anything that reads the page rather than renders it.
  const [activeChapter, setActiveChapter] = useState(0);
  const [readChapters, setReadChapters] = useState<readonly number[]>([0]);
  const movedByReader = useRef(false);
  const activeChapterRef = useRef(0);
  const chapterCount = text.chapters.length;
  const rule = proposal.rules[0] as Rule;
  const parameters = rule.parameters;

  // Focus follows a reader-initiated move only. On first render the reader has
  // not asked to go anywhere, so the page must not steal focus from the top.
  useEffect(() => {
    activeChapterRef.current = activeChapter;
    if (!movedByReader.current) return;
    movedByReader.current = false;
    document.getElementById(`chapter-${activeChapter + 1}`)?.focus();
  }, [activeChapter]);

  /**
   * Bring an element into view, opening the chapter that holds it first. The
   * focus is deferred by a turn because the chapter it lives in is only
   * rendered visible once this state change has been committed.
   */
  const revealTarget = useCallback((id: string) => {
    const position = chapterOf(id);
    if (position === null) return;
    setActiveChapter(position);
    setReadChapters((current) =>
      current.includes(position) ? current : [...current, position],
    );
    window.setTimeout(() => focusTarget(id), 0);
  }, []);

  // A fragment names an element, not a chapter, so the chapter holding it is
  // opened before the browser's own jump can mean anything. A citation click
  // pushes a history entry, so the fragment can also come back later through
  // Back and Forward, long after mount: the same handler answers both, or
  // restoring the fragment would leave its chapter hidden and the provenance
  // unreachable.
  useEffect(() => {
    const revealFragment = () => {
      const fragment = window.location.hash.slice(1);
      if (fragment !== "") revealTarget(fragment);
    };
    const timer = window.setTimeout(revealFragment, 0);
    window.addEventListener("hashchange", revealFragment);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", revealFragment);
    };
  }, [revealTarget]);

  function goToChapter(position: number) {
    if (position < 0 || position >= chapterCount) return;
    if (position === activeChapter) return;
    movedByReader.current = true;
    setActiveChapter(position);
    setReadChapters((current) =>
      current.includes(position) ? current : [...current, position],
    );
  }

  async function approveScope() {
    setResult(null);
    setRunError(null);
    setApprovalError(null);
    const attempt = await attemptApproval(proposal);
    setApproval(attempt.approval);
    // Approving is chapter 3's own step and its control is only offered there,
    // so a refusal is already in front of the reader and needs no navigation.
    setApprovalError(attempt.error);
  }

  async function runCase() {
    if (approval === null || running) return;
    // The reader can move chapters while the request is in flight. A refusal is
    // the whole point of this step, so the case returns to the chapter that
    // started the run rather than leaving the alert inside a hidden chapter,
    // where it is neither shown nor announced.
    const startedIn = activeChapter;
    setRunning(true);
    setRunError(null);
    try {
      const response = await fetch("/api/case-2026-09-03", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approval }),
      });
      const body = await response.json();
      if (!response.ok) {
        setResult(null);
        setRunError(`${body.code ?? "CASE_REVIEW_REQUIRED"} · ${body.message}`);
        setActiveChapter(startedIn);
        return;
      }
      setResult(body as PublishedCaseReplay);
      // The result and its live region belong to the next chapter, so a run
      // that lands while the reader is still on this one would leave the
      // chapter looking exactly as it did before, with the control offering
      // the same run again. Reading the live position rather than the one
      // captured at the start keeps a reader who moved on where they are.
      if (activeChapterRef.current === startedIn) {
        const next = Math.min(startedIn + 1, chapterCount - 1);
        movedByReader.current = true;
        setActiveChapter(next);
        setReadChapters((current) =>
          current.includes(next) ? current : [...current, next],
        );
      }
    } catch {
      setResult(null);
      setRunError("REPLAY_REFUSED");
      setActiveChapter(startedIn);
    } finally {
      setRunning(false);
    }
  }

  const evaluation = result?.evaluation;
  const analysis =
    evaluation && evaluation.result !== "INCONCLUSIVE"
      ? evaluation.analysis
      : null;
  // Version 1.0 of the rule returns no sensitivity block, so the comparison is
  // read off the result rather than assumed to be there.
  const sensitivity =
    evaluation && evaluation.result !== "INCONCLUSIVE"
      ? "sensitivity" in evaluation
        ? evaluation.sensitivity
        : null
      : null;

  return (
    <ReplayLanguageContext.Provider value={language}>
      <section className="case-opening" aria-label={text.observations}>
        <IntradaySessionChart
          caption={text.intradayCaption}
          high={INTRADAY_HIGH}
          labels={text.intradayLabels}
          low={INTRADAY_LOW}
          note={text.intradayChartNote}
          points={INTRADAY_SESSION}
        />
        <p className="intraday-reference">
          <a
            href="https://stock.naver.com/domestic/index/KPI200/price"
            rel="noreferrer noopener"
            target="_blank"
          >
            {text.intradayLink}
          </a>
          <span>{text.intradayNote}</span>
        </p>
        <div className="case-premise">
          <h2>{text.notOurJobTitle}</h2>
          {text.notOurJob.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {/* The contract records this selection policy on every analysis the
              rule returns, so the claim above is checkable in the result below
              rather than only asserted here. */}
          <p className="machine-note">
            <code>STATED_DATE_ONLY_NO_CANDIDATE_SCAN</code>
          </p>
        </div>
      </section>

      {/* The rail names every chapter and marks the one being read, so the
          reader's position in the procedure is stated rather than inferred
          from how far the page has scrolled. Chapters already read stay
          reachable: this is a procedure to understand, not a form to submit
          in order. */}
      <nav aria-label={text.chapterListLabel} className="case-chapter-rail">
        <ol className="journey-progress">
          {text.chapters.map((chapter, index) => (
            <li
              aria-current={index === activeChapter ? "step" : undefined}
              key={chapter.title}
            >
              <button
                className="journey-step"
                data-complete={
                  index !== activeChapter && readChapters.includes(index)
                }
                onClick={() => goToChapter(index)}
                type="button"
              >
                <span>
                  {index + 1}. {chapter.title}
                </span>
                {index === activeChapter ? (
                  <small>{text.chapterCurrentTag}</small>
                ) : readChapters.includes(index) ? (
                  <small>{text.chapterReadTag}</small>
                ) : null}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* Without scripting nothing can advance a chapter, so the hiding is
          undone and the whole case is read as one page instead of stranding
          the reader on chapter one. */}
      <noscript>
        <style>
          {
            ".case-chapter[hidden]{display:block!important}.case-chapter+.case-chapter{border-top:var(--hairline)!important}.case-chapter-rail,.chapter-controls{display:none!important}"
          }
        </style>
        <p className="machine-note">{text.chaptersWithoutScript}</p>
      </noscript>

      <div className="case-chapters">
        <Chapter
          chapter={text.chapters[0]!}
          index={1}
          hidden={activeChapter !== 0}
        >
          <p>{text.sourcesLede}</p>
          <dl className="case-sources">
            <div>
              <dt>{text.spotSource}</dt>
              <dd>
                <HashValue scope="sourceArtifact" value={spotArtifactHash} />
              </dd>
            </div>
            <div>
              <dt>{text.futureSource}</dt>
              <dd>
                <HashValue scope="sourceArtifact" value={futureArtifactHash} />
              </dd>
            </div>
          </dl>
          <h3>{text.limitsTitle}</h3>
          {text.limits.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Chapter>

        <Chapter
          chapter={text.chapters[1]!}
          index={2}
          hidden={activeChapter !== 1}
        >
          <p>{text.columnsLede}</p>
          {columns.map((leg) => (
            <div className="column-block" key={leg.legId}>
              <h3>{text.legTableTitles[leg.legId] ?? leg.legId}</h3>
              <table className="column-table">
                <thead>
                  <tr>
                    {text.columnHeaders.map((header) => (
                      <th key={header} scope="col">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leg.columns.map((column) => (
                    <tr key={column.sourceColumn}>
                      <td>
                        <code>{column.sourceColumn}</code>
                      </td>
                      <td>{text.columnGloss[column.sourceColumn] ?? "—"}</td>
                      <td>
                        <code>{column.targetField}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="machine-note">{text.mappingReviewed}</p>
        </Chapter>

        <Chapter
          chapter={text.chapters[2]!}
          index={3}
          hidden={activeChapter !== 2}
        >
          <BaselineRangeChart
            analysedDate="2026-09-03"
            caption={text.baselineCaption}
            days={spot}
            language={language}
          />
          <dl className="scope-facts">
            <div>
              <dt>{text.analysedDate}</dt>
              <dd>{parameters.analysedDate}</dd>
            </div>
            <div>
              <dt>{text.baselineRange}</dt>
              <dd>
                {parameters.baselineRange.startDate} —{" "}
                {parameters.baselineRange.endDateInclusive}
              </dd>
            </div>
            <div>
              <dt>{text.maximumRank}</dt>
              <dd>{parameters.maximumBaselineRank}</dd>
            </div>
            <div>
              <dt>{text.minimumAgreeing}</dt>
              <dd>{parameters.minimumAgreeingLegs}</dd>
            </div>
          </dl>
          <div className="case-legs">
            {parameters.legs.map((leg) => (
              <div className="case-leg" key={leg.legId}>
                <strong>{text.legNames[leg.legId] ?? leg.legId}</strong>
                <code>{leg.instrumentId}</code>
                <span>
                  {text.minimumMultiple}: {leg.minimumReversalMultiple}
                </span>
              </div>
            ))}
          </div>
          <p
            className="threshold-origin"
            id={PUBLISHED_CASE_THRESHOLD_ORIGIN_ID}
            tabIndex={-1}
          >
            {text.thresholdOrigin}
          </p>
          <details>
            <summary>{text.exactScope}</summary>
            <pre className="artifact-json" aria-label={text.exactScope}>
              {JSON.stringify(proposal, null, 2)}
            </pre>
          </details>
          <button
            className="button primary case-approve"
            disabled={approval !== null}
            onClick={approveScope}
            type="button"
          >
            {approval === null ? text.approve : text.approved}
          </button>
          {approvalError && (
            <p
              className="error-message"
              id={PUBLISHED_CASE_APPROVAL_ERROR_ID}
              role="alert"
              tabIndex={-1}
            >
              {approvalError}
            </p>
          )}
          {approval && (
            <dl className="approval-receipt">
              <div>
                <dt>
                  {language === "ko"
                    ? "승인한 내용의 해시"
                    : "Approved artifact hash"}
                </dt>
                <dd>
                  <HashValue
                    scope="approvedArtifact"
                    value={approval.approvedArtifactHash}
                  />
                </dd>
              </div>
              <div>
                <dt>{language === "ko" ? "승인 시각" : "Approved at"}</dt>
                <dd>
                  <Instant value={approval.approvedAt} />
                </dd>
              </div>
            </dl>
          )}
        </Chapter>

        <Chapter
          chapter={text.chapters[3]!}
          index={4}
          hidden={activeChapter !== 3}
        >
          <p>{text.runLede}</p>
          <button
            className="button primary run-button"
            disabled={approval === null || running}
            onClick={runCase}
            type="button"
          >
            {running ? text.running : text.run}
          </button>
          {approval === null && (
            <p className="step-requirement">{text.runBlocked}</p>
          )}
          {result && !running && (
            <p className="step-requirement">{text.ranAlready}</p>
          )}
          {runError && (
            <p
              className="error-message"
              id={PUBLISHED_CASE_RUN_ERROR_ID}
              role="alert"
              tabIndex={-1}
            >
              {runError}
            </p>
          )}
        </Chapter>

        <Chapter
          chapter={text.chapters[4]!}
          index={5}
          hidden={activeChapter !== 4}
        >
          {result && evaluation ? (
            <div className="case-result" aria-live="polite">
              <div className="evaluation-heading">
                <strong data-result={evaluation.result}>
                  {evaluation.result}
                </strong>
                <code>
                  {evaluation.ruleId}@{evaluation.ruleVersion}
                </code>
                <code>{result.engineVersion}</code>
              </div>

              <h3>{text.gates}</h3>
              <div className="gate-list">
                {evaluation.findings.map((finding, index) => (
                  <div className="gate-row" key={`${finding.gate}-${index}`}>
                    <strong>
                      {text.gateNames[finding.gate] ?? finding.gate}
                    </strong>
                    <code className="gate-id">
                      {finding.gate}
                      {finding.legId
                        ? ` · ${text.legNames[finding.legId] ?? finding.legId}`
                        : ""}
                    </code>
                    <span>
                      {text.observed} {finding.observedValue} · {text.threshold}{" "}
                      {finding.threshold}
                    </span>
                    <b data-passed={finding.passed}>
                      {finding.passed ? text.passed : text.failed}
                    </b>
                    <ThresholdOriginReference
                      label={text.thresholdOriginLink}
                      onNavigate={revealTarget}
                    />
                  </div>
                ))}
              </div>

              {analysis && (
                <>
                  <p className="case-rank">
                    {text.rankReading(
                      analysis.rank.position,
                      analysis.rank.populationSize,
                    )}
                  </p>
                  <p className="machine-note">{text.rankCaveat}</p>
                  {/* The position is drawn from the gate's own observed value, so
                    the picture cannot mark a rank the gate did not report. */}
                  <BaselineRankFigures
                    analysis={analysis}
                    findings={evaluation.findings}
                    legNames={text.legNames}
                    text={text}
                  />

                  <h3>{text.observations}</h3>
                  <div className="case-observations">
                    {analysis.legs.map((leg) => (
                      <dl className="case-observation" key={leg.legId}>
                        <div>
                          <dt>{text.legNames[leg.legId] ?? leg.legId}</dt>
                          <dd>
                            <code>{leg.instrumentId}</code>
                          </dd>
                        </div>
                        {(
                          [
                            ["open", leg.openPrice],
                            ["high", leg.highPrice],
                            ["low", leg.lowPrice],
                            ["close", leg.closePrice],
                            ["netChange", leg.netChange],
                            ["sessionReversal", leg.sessionReversal],
                            ["reversalMultiple", leg.reversalMultiple],
                          ] as const
                        ).map(([column, value]) => (
                          <div key={column}>
                            <dt>{text.columns[column]}</dt>
                            <dd>
                              <code>{value}</code>
                            </dd>
                          </div>
                        ))}
                        <div>
                          <dt>{text.columns.relation}</dt>
                          <dd>
                            {text.relations[leg.relation] ?? leg.relation}
                          </dd>
                        </div>
                      </dl>
                    ))}
                  </div>
                </>
              )}

              {sensitivity && (
                <>
                  <h3>{text.divergenceTitle}</h3>
                  <p>{text.divergenceLede}</p>
                  <DenominatorDivergenceFigures
                    findings={evaluation.findings}
                    legNames={text.legNames}
                    legs={sensitivity.legs}
                    text={text}
                  />
                  <p>{text.divergenceCaveat}</p>
                  <p className="machine-note">
                    <code>{sensitivity.comparison}</code>{" "}
                    <code>{sensitivity.interpretation}</code>
                  </p>
                </>
              )}

              <div className="hash-block">
                <HashValue
                  scope="canonicalResult"
                  value={result.canonicalResultHash}
                />
              </div>

              <h3>{text.evidenceTitle}</h3>
              <p>{text.evidenceLede}</p>
              {result.sourceTrace.map((entry) => (
                <details className="source-evidence" key={entry.eventId}>
                  <summary>
                    {entry.instrumentId} · {entry.tradingDate}
                  </summary>
                  <dl className="source-values">
                    <div>
                      <dt>eventId</dt>
                      <dd>
                        <code>{entry.eventId}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>rawRowHash</dt>
                      <dd>
                        <HashValue scope="rawRow" value={entry.rawRowHash} />
                      </dd>
                    </div>
                    <div>
                      <dt>
                        {language === "ko"
                          ? "원본 행 번호"
                          : "Source row number"}
                      </dt>
                      <dd>{entry.sourceRow.coordinate.rowNumber}</dd>
                    </div>
                    {Object.entries(entry.sourceRow.values).map(
                      ([column, value]) => (
                        <div key={column}>
                          <dt>{column}</dt>
                          <dd>
                            <code>{value}</code>
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                </details>
              ))}
            </div>
          ) : (
            <p className="awaiting-result">
              {approval === null ? text.runBlocked : text.awaitingRun}
            </p>
          )}
        </Chapter>

        <Chapter
          chapter={text.chapters[5]!}
          index={6}
          hidden={activeChapter !== 5}
        >
          <div className="case-stop-grid">
            {/* Before a run nothing has been decided and no hash has been
              returned, so the same procedure is stated in the present tense
              until there is a result to speak of in the past. */}
            <div>
              <h3>{result ? text.didTitle : text.willDoTitle}</h3>
              <ul>
                {(result ? text.did : text.willDo).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            {/* What the result says is itself rule output, read from the returned
              analysis, so it appears only once the rule has returned one. What
              it does not say is a disclosure about the data, and stands before
              the visitor commits to anything. */}
            <div>
              <h3>{text.doesNotSayTitle}</h3>
              <ul>
                {text.doesNotSay.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
          {analysis ? (
            <div className="case-says">
              <h3>{text.saysTitle}</h3>
              <ul>
                {text
                  .says(analysis.rank.position, analysis.rank.populationSize)
                  .map((line) => (
                    <li key={line}>{line}</li>
                  ))}
              </ul>
            </div>
          ) : null}
          <p className="case-closing">{text.closing}</p>
        </Chapter>
      </div>

      {/* One step back, one step forward, and the position between them. The
          reader never has to hunt for the control that advances the case. */}
      <div className="chapter-controls">
        <button
          className="button"
          disabled={activeChapter === 0}
          onClick={() => goToChapter(activeChapter - 1)}
          type="button"
        >
          {text.previousChapter}
        </button>
        <span aria-live="polite" className="chapter-position">
          {text.chapterPositionOf(activeChapter + 1, chapterCount)}
        </span>
        <button
          className="button primary"
          disabled={activeChapter === chapterCount - 1}
          onClick={() => goToChapter(activeChapter + 1)}
          type="button"
        >
          {text.nextChapter}
        </button>
      </div>
    </ReplayLanguageContext.Provider>
  );
}
