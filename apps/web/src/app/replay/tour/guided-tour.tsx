"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

import type { RapidPriceLiftResult } from "@weavetrail/contracts";

import { useLanguage } from "../../i18n/language";
import { SentenceLines } from "../../shell/sentence-lines";
import type { GateName } from "../copy";
import type { CaseReplayProps, ReplayError } from "../types";
import { useCaseReplay, type ReplayView } from "../use-case-replay";
import { SCENES, tourCopy, type Scene } from "./copy";
import { bpsAsPercent } from "./percent";

import "./tour.css";

type Text = (typeof tourCopy)["en"];

/** The checks counted in executions; every other check is in basis points. */
const COUNT_GATES: ReadonlySet<string> = new Set(["REPEATED_EXECUTION"]);
/** The check whose basis points are a difference of two rates. */
const POINT_GATES: ReadonlySet<string> = new Set(["REMOVAL_SENSITIVITY"]);

/** Each check and the rule parameter that holds its threshold. */
const GATE_PARAMETERS: readonly (readonly [GateName, string])[] = [
  ["PRICE_CHANGE", "minimumPriceChangeBps"],
  ["AGGRESSIVE_BUY_SHARE", "minimumAggressiveBuyShareBps"],
  ["ACTOR_CONCENTRATION", "minimumActorConcentrationShareBps"],
  ["REPEATED_EXECUTION", "minimumExecutionsAboveReference"],
  ["REMOVAL_SENSITIVITY", "minimumRemovalSensitivityBps"],
];

/** A threshold or observed value as a reader meets it. */
function shownValue(gate: string, value: string, text: Text): string {
  if (COUNT_GATES.has(gate)) return text.result.count(value);
  const percent = bpsAsPercent(value);
  return POINT_GATES.has(gate)
    ? text.result.percentPoints(percent)
    : text.result.percent(percent);
}

/** A criterion's threshold in the words the criterion is written with. */
function criterionValue(gate: string, value: string): string {
  return COUNT_GATES.has(gate) ? value : bpsAsPercent(value);
}

/** `2026-09-03T01:00:00Z` as `2026-09-03 01:00:00 UTC`. */
function utc(instant: string): string {
  return `${instant.replace("T", " ").replace(/\.\d+/, "").replace("Z", "")} UTC`;
}

function errorMessage(error: ReplayError, text: Text): string {
  switch (error.kind) {
    case "approval-hash":
      return text.errors.approval;
    case "refused":
      return `${text.errors.refused} ${error.message}`;
    default:
      return text.errors.failed;
  }
}

/**
 * The guided walkthrough: one worked case in five scenes, each saying what
 * the visitor is looking at and why before it asks for one action. The
 * approvals, the run and the evidence are the same calls working mode makes;
 * only the presentation is the walkthrough's own.
 */
export function GuidedTour(props: CaseReplayProps) {
  const { language } = useLanguage();
  const text = tourCopy[language];
  const view = useCaseReplay(props);
  const [scene, setScene] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [scene]);

  const go = (next: number) => {
    moved.current = true;
    setScene(next);
  };

  // An approval asked for from a scene moves the walkthrough on once it is
  // recorded; a failed one leaves the visitor where they were.
  const advanceOnApproval = useRef<Scene | null>(null);
  useEffect(() => {
    const waiting = advanceOnApproval.current;
    if (
      (waiting === "mapping" && view.approval !== null) ||
      (waiting === "scope" && view.caseApproval !== null)
    ) {
      advanceOnApproval.current = null;
      go(SCENES.indexOf(waiting) + 1);
    }
  }, [view.approval, view.caseApproval]);

  const current: Scene = SCENES[scene]!;
  const reached = [
    true,
    true,
    view.approval !== null,
    view.caseApproval !== null,
    view.completeResult,
  ];
  const canContinue = [
    true,
    view.approval !== null,
    view.caseApproval !== null,
    view.completeResult,
    false,
  ][scene]!;

  return (
    <section className="tour" aria-labelledby="tour-title">
      <nav aria-label={text.progressLabel} className="tour-progress">
        <ol>
          {SCENES.map((id, index) => (
            <li
              data-current={index === scene}
              data-done={index < scene}
              key={id}
            >
              <button
                aria-current={index === scene ? "step" : undefined}
                disabled={!reached[index] || index === scene}
                onClick={() => go(index)}
                type="button"
              >
                <span className="tour-progress-index">{index + 1}</span>
                {text.scenes[id].short}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <article className="tour-scene" data-scene={current}>
        <header className="tour-scene-head">
          <span className="eyebrow">
            {text.sceneOf(scene + 1, SCENES.length)}
          </span>
          <h2 id="tour-title" ref={heading} tabIndex={-1}>
            {text.scenes[current].title}
          </h2>
          <SentenceLines
            className="tour-lines"
            lines={text.scenes[current].lines}
          />
        </header>

        {current === "source" && <SourceScene text={text} view={view} />}
        {current === "mapping" && <MappingScene text={text} view={view} />}
        {current === "scope" && <ScopeScene text={text} view={view} />}
        {current === "result" && <ResultScene text={text} view={view} />}
        {current === "evidence" && <EvidenceScene text={text} view={view} />}

        {view.error ? (
          <p className="tour-error" role="alert">
            {errorMessage(view.error, text)}
          </p>
        ) : null}

        <footer className="tour-actions">
          {scene > 0 ? (
            <button
              className="button secondary"
              onClick={() => go(scene - 1)}
              type="button"
            >
              {text.back}
            </button>
          ) : null}
          <SceneAction
            canContinue={canContinue}
            onApprove={() => {
              advanceOnApproval.current = current;
            }}
            onContinue={() => go(scene + 1)}
            scene={current}
            text={text}
            view={view}
          />
        </footer>
      </article>
    </section>
  );
}

/**
 * The one action a scene offers. Where the scene's work is an approval or a
 * run, the button does that work and then moves on; once done, it only moves
 * on. The last scene ends in its finishing card instead.
 */
function SceneAction({
  scene,
  view,
  text,
  canContinue,
  onApprove,
  onContinue,
}: {
  scene: Scene;
  view: ReplayView;
  text: Text;
  canContinue: boolean;
  onApprove: () => void;
  onContinue: () => void;
}) {
  if (scene === "evidence") return null;
  if (scene === "source")
    return (
      <button className="button primary" onClick={onContinue} type="button">
        {text.source.action}
      </button>
    );
  if (canContinue)
    return (
      <button className="button primary" onClick={onContinue} type="button">
        {scene === "result" ? text.result.action : text.next}
      </button>
    );
  if (scene === "mapping")
    return (
      <button
        className="button primary"
        disabled={view.approveMappingBlocked}
        onClick={() => {
          onApprove();
          void view.approveMapping();
        }}
        type="button"
      >
        {text.mapping.action}
      </button>
    );
  if (scene === "scope")
    return (
      <button
        className="button primary"
        disabled={view.approval === null}
        onClick={() => {
          onApprove();
          void view.approveCase();
        }}
        type="button"
      >
        {text.scope.action}
      </button>
    );
  return (
    <button
      className="button primary"
      disabled={view.runBlocked}
      onClick={() => void view.runReplay()}
      type="button"
    >
      {view.running ? text.result.running : text.result.run}
    </button>
  );
}

/** The source columns, in the order the file has them. */
function columnsOf(view: ReplayView): string[] {
  return [
    ...new Set(
      view.selectedScenario.rows.flatMap((row) => Object.keys(row.values)),
    ),
  ];
}

/** The file as received, with any rows a criterion used marked. */
function SourceTable({
  view,
  text,
  marked,
  label,
}: {
  view: ReplayView;
  text: Text;
  marked?: ReadonlySet<string>;
  label: string;
}) {
  const columns = columnsOf(view);
  return (
    <div
      aria-label={label}
      className="tour-table-wrap"
      role="region"
      tabIndex={0}
    >
      <table className="tour-table">
        <thead>
          <tr>
            <th scope="col">{text.evidence.rowHeader}</th>
            {columns.map((column) => (
              <th key={column} scope="col">
                <code>{column}</code>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.selectedScenario.rows.map((row) => (
            <tr
              data-marked={marked?.has(row.coordinate.rowNumber) ?? false}
              key={row.coordinate.rowNumber}
            >
              <th scope="row">{row.coordinate.rowNumber}</th>
              {columns.map((column) => (
                <td key={column}>
                  <code>{row.values[column]}</code>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceScene({ view, text }: { view: ReplayView; text: Text }) {
  return (
    <div className="tour-body">
      <SourceTable
        label={text.source.rowsLabel(view.selectedScenario.rows.length)}
        text={text}
        view={view}
      />
      <aside className="tour-goal">
        <span>{text.source.goalLabel}</span>
        <strong>{text.source.goal}</strong>
      </aside>
    </div>
  );
}

function MappingScene({ view, text }: { view: ReplayView; text: Text }) {
  const [first] = view.selectedScenario.rows;
  return (
    <div className="tour-body">
      <table className="tour-mapping">
        <thead>
          <tr>
            <th scope="col">{text.mapping.columnHeader}</th>
            <th scope="col">{text.mapping.fieldHeader}</th>
            <th scope="col">{text.mapping.sampleHeader}</th>
          </tr>
        </thead>
        <tbody>
          {view.proposal.fields.map((field) => (
            <tr key={field.sourceColumn ?? field.targetField}>
              <th scope="row">
                <code>{field.sourceColumn}</code>
              </th>
              <td>
                <strong>
                  {field.targetField === null
                    ? null
                    : (text.mapping.fields[field.targetField] ??
                      field.targetField)}
                </strong>
                {field.transform && text.mapping.transforms[field.transform] ? (
                  <small>{text.mapping.transforms[field.transform]}</small>
                ) : null}
              </td>
              <td>
                <code>
                  {field.sourceColumn && first
                    ? first.values[field.sourceColumn]
                    : null}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="tour-more">
        <summary>{text.mapping.reasons}</summary>
        <p>{text.mapping.reasonsNote}</p>
        <dl>
          {view.proposal.fields.map((field) => (
            <div key={field.sourceColumn ?? field.targetField}>
              <dt>
                <code>{field.sourceColumn}</code>
              </dt>
              <dd lang="en">{field.evidence}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="tour-note">{text.mapping.prepared}</p>
      {view.approval ? (
        <p className="tour-done" role="status">
          ✓ {text.mapping.done}
        </p>
      ) : null}
    </div>
  );
}

function ScopeScene({ view, text }: { view: ReplayView; text: Text }) {
  const manifest = view.selectedScenario.manifest;
  if (!manifest) return null;
  const { hypothesis } = manifest;
  const [rule] = manifest.rules;
  const seconds =
    (Date.parse(hypothesis.endTime) - Date.parse(hypothesis.startTime)) / 1000;
  return (
    <div className="tour-body">
      <p className="tour-scope">
        {text.scope.sentence(
          hypothesis.instrumentId,
          hypothesis.actorIds.join(", "),
          utc(hypothesis.startTime),
          seconds,
        )}
      </p>
      <p className="tour-criteria-label">{text.scope.criteriaLabel}</p>
      <ol className="tour-criteria">
        {GATE_PARAMETERS.map(([gate, parameter]) => {
          const value = (
            rule?.parameters as Readonly<Record<string, string>> | undefined
          )?.[parameter];
          return value === undefined ? null : (
            <li key={gate}>
              {text.scope.criteria[gate](criterionValue(gate, value))}
            </li>
          );
        })}
      </ol>
      <p className="tour-note">{text.scope.prepared}</p>
      {view.caseApproval ? (
        <p className="tour-done" role="status">
          ✓ {text.scope.done}
        </p>
      ) : null}
    </div>
  );
}

/** The evaluation, when a complete result came back. */
function evaluationOf(view: ReplayView): RapidPriceLiftResult | null {
  return view.result && "evaluation" in view.result
    ? view.result.evaluation
    : null;
}

function criterionText(gate: string, threshold: string, text: Text) {
  const write = text.scope.criteria[gate as GateName];
  return write ? write(criterionValue(gate, threshold)) : gate;
}

function ResultScene({ view, text }: { view: ReplayView; text: Text }) {
  const evaluation = evaluationOf(view);
  if (!evaluation) return <div className="tour-body" aria-live="polite" />;
  const findings = "findings" in evaluation ? evaluation.findings : [];
  return (
    <div className="tour-body" aria-live="polite">
      <div className="tour-verdict" data-verdict={evaluation.result}>
        <strong>{text.result.verdicts[evaluation.result]}</strong>
        {findings.length > 0 ? (
          <span>
            {text.result.tally(
              findings.filter(({ passed }) => passed).length,
              findings.length,
            )}
          </span>
        ) : null}
        <code>{evaluation.result}</code>
      </div>
      {evaluation.result === "INCONCLUSIVE" ? (
        <p>
          {text.result.reason}: {evaluation.reason}
        </p>
      ) : (
        <table className="tour-findings">
          <thead>
            <tr>
              <th scope="col">{text.result.criterionHeader}</th>
              <th scope="col">{text.result.observedHeader}</th>
              <th scope="col">{text.result.thresholdHeader}</th>
              <th scope="col">{text.result.metHeader}</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => (
              <tr data-passed={finding.passed} key={finding.gate}>
                <th scope="row">
                  {criterionText(finding.gate, finding.threshold, text)}
                </th>
                <td>
                  {finding.observedValue === null
                    ? "—"
                    : shownValue(finding.gate, finding.observedValue, text)}
                </td>
                <td>
                  {text.result.orMore(
                    shownValue(finding.gate, finding.threshold, text),
                  )}
                </td>
                <td>
                  <b data-passed={finding.passed}>
                    {finding.passed
                      ? `✓ ${text.result.met}`
                      : text.result.notMet}
                  </b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="tour-note">{text.result.meaning}</p>
      <div className="tour-repeat">
        <button
          className="button secondary"
          disabled={view.repeatBlocked}
          onClick={() => void view.runReplay(true)}
          type="button"
        >
          {text.result.repeat}
        </button>
        {view.previousHash !== null && view.completeResult ? (
          <span role="status" data-same={view.repeatMatches}>
            {view.repeatMatches
              ? `✓ ${text.result.repeatSame}`
              : text.result.repeatDifferent}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function EvidenceScene({ view, text }: { view: ReplayView; text: Text }) {
  const evaluation = evaluationOf(view);
  const findings =
    evaluation && "findings" in evaluation ? evaluation.findings : [];
  const [picked, setPicked] = useState(0);
  const finding = findings[picked];
  const trace =
    view.result && "sourceTrace" in view.result
      ? view.result.sourceTrace.entries
      : [];
  const marked = new Set(
    trace
      .filter(({ event }) =>
        finding?.referencedEventIds.includes(event.eventId),
      )
      .map(({ sourceRow }) => sourceRow.coordinate.rowNumber),
  );
  return (
    <div className="tour-body">
      {finding ? (
        <>
          <fieldset className="tour-pick">
            <legend>{text.evidence.pickLabel}</legend>
            {findings.map((entry, index) => (
              <label data-picked={index === picked} key={entry.gate}>
                <input
                  checked={index === picked}
                  name="tour-criterion"
                  onChange={() => setPicked(index)}
                  type="radio"
                />
                {criterionText(entry.gate, entry.threshold, text)}
              </label>
            ))}
          </fieldset>
          <p className="tour-used" role="status">
            {text.evidence.usedRows(marked.size)}
          </p>
          <SourceTable
            label={text.evidence.usedRows(marked.size)}
            marked={marked}
            text={text}
            view={view}
          />
        </>
      ) : (
        <p>{text.evidence.none}</p>
      )}
      <aside className="tour-finish">
        <h3>{text.evidence.finishTitle}</h3>
        <SentenceLines lines={text.evidence.finishLines} />
        <p className="tour-finish-actions">
          <Link className="button primary" href="/replay?mode=working">
            {text.evidence.working}
          </Link>
          <Link className="button secondary" href="/architecture">
            {text.evidence.howItRuns}
          </Link>
        </p>
      </aside>
    </div>
  );
}
