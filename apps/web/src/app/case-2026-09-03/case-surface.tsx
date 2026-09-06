"use client";

import React, { useState } from "react";

import type {
  ApprovalRecord,
  CaseManifestV14Proposal,
} from "@weavetrail/contracts";

import { type Language } from "../i18n/language";
import { attemptApproval } from "../replay/case-replay";
import { HashValue, Instant } from "../replay/machine-values";
import { ReplayLanguageContext } from "../replay/replay-language";
import type { PublishedCaseReplay, SessionDay } from "../../lib/published-case";
import { caseCopy } from "./case-copy";
import { BaselineRangeChart, SessionDayChart } from "./session-chart";

type Rule = Extract<
  CaseManifestV14Proposal["rules"][number],
  { ruleId: "CROSS_MARKET_SESSION_REVERSAL" }
>;

export function PublishedCaseSurface({
  proposal,
  spot,
  future,
  previousClose,
  spotArtifactHash,
  futureArtifactHash,
  language,
}: {
  proposal: CaseManifestV14Proposal;
  spot: readonly SessionDay[];
  future: SessionDay;
  previousClose: string;
  spotArtifactHash: string;
  futureArtifactHash: string;
  language: Language;
}) {
  const text = caseCopy[language];
  const [approval, setApproval] = useState<ApprovalRecord | null>(null);
  const [result, setResult] = useState<PublishedCaseReplay | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rule = proposal.rules[0] as Rule;
  const parameters = rule.parameters;
  const analysedDay = spot.at(-1)!;

  async function approveScope() {
    setResult(null);
    setError(null);
    const attempt = await attemptApproval(proposal);
    setApproval(attempt.approval);
    setError(attempt.error);
  }

  async function runCase() {
    if (approval === null || running) return;
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/case-2026-09-03", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approval }),
      });
      const body = await response.json();
      if (!response.ok) {
        setResult(null);
        setError(`${body.code ?? "CASE_REVIEW_REQUIRED"} · ${body.message}`);
        return;
      }
      setResult(body as PublishedCaseReplay);
    } catch {
      setResult(null);
      setError("REPLAY_REFUSED");
    } finally {
      setRunning(false);
    }
  }

  const evaluation = result?.evaluation;
  const analysis =
    evaluation && evaluation.result !== "INCONCLUSIVE"
      ? evaluation.analysis
      : null;

  return (
    <ReplayLanguageContext.Provider value={language}>
      <section className="case-charts" aria-label={text.observations}>
        <div className="case-day-pair">
          <SessionDayChart
            caption={text.dayCaptionSpot}
            day={analysedDay}
            language={language}
            previousClose={previousClose}
          />
          <SessionDayChart
            caption={text.dayCaptionFuture}
            day={future}
            language={language}
          />
        </div>
        <BaselineRangeChart
          analysedDate="2026-09-03"
          caption={text.baselineCaption}
          days={spot}
          language={language}
        />
        <p className="machine-note">{text.chartNote}</p>
      </section>

      <section className="panel case-premise">
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
      </section>

      <section className="panel">
        <h2>{text.sourcesTitle}</h2>
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
        <p>{text.mappingReviewed}</p>
        <h3>{text.limitsTitle}</h3>
        {text.limits.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>

      <section className="panel case-scope">
        <h2>{text.scopeTitle}</h2>
        <p>{text.scopeLede}</p>
        <dl>
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
      </section>

      <section className="panel case-run">
        <h2>{text.runTitle}</h2>
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
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </section>

      {result && evaluation && (
        <section className="panel case-result" aria-live="polite">
          <h2>{text.resultTitle}</h2>
          <div className="evaluation-heading">
            <strong data-result={evaluation.result}>{evaluation.result}</strong>
            <code>
              {evaluation.ruleId}@{evaluation.ruleVersion}
            </code>
            <code>{result.engineVersion}</code>
          </div>

          <h3>{text.gates}</h3>
          <div className="gate-list">
            {evaluation.findings.map((finding, index) => (
              <div className="gate-row" key={`${finding.gate}-${index}`}>
                <strong>{text.gateNames[finding.gate] ?? finding.gate}</strong>
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
                      <dd>{text.relations[leg.relation] ?? leg.relation}</dd>
                    </div>
                  </dl>
                ))}
              </div>
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
                    {language === "ko" ? "원본 행 번호" : "Source row number"}
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
        </section>
      )}

      <section className="panel case-stop">
        <h2>{text.stopTitle}</h2>
        <div className="case-stop-grid">
          <div>
            <h3>{text.saysTitle}</h3>
            <ul>
              {text.says.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>{text.doesNotSayTitle}</h3>
            <ul>
              {text.doesNotSay.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </ReplayLanguageContext.Provider>
  );
}
