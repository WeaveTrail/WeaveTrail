import React from "react";

import type { Language } from "../../i18n/language";
import { RapidPriceLiftEvaluation } from "../findings";
import { eventFieldNote, HashValue } from "../machine-values";
import { WorkflowStateBadge } from "../workflow-state";
import { evidenceStep } from "./evidence";
import { STEP } from "./index";
import { panelLabel, type GuideView } from "./step";

/**
 * The canonical result. It leads with the verdict and how many checks pass;
 * each check opens to its evidence, and the engine version, canonical order
 * and result hash sit in one disclosure below. A normalization without a case
 * has nothing else, so that disclosure opens there.
 */
export function renderResultPanel(view: GuideView, language: Language) {
  const text = evidenceStep.panel[language];
  const { result, selectedScenario } = view;
  return (
    <div
      hidden={
        view.mappingExample ||
        (view.guided &&
          view.chapter !== STEP.repeat &&
          view.chapter !== STEP.evidence &&
          view.chapter !== STEP.controls)
      }
      className="panel result-panel"
      aria-live="polite"
    >
      <span className="panel-label">
        {panelLabel(view, "04", text.panelLabel)}
      </span>
      {result ? (
        <>
          <WorkflowStateBadge state={result.workflowState} />
          {result.workflowState === "MAPPING_APPROVED" && (
            <p>{text.normalizedOnly}</p>
          )}
          {"evaluation" in result && (
            <p className="result-headline">
              {text.outcome}: <strong>{result.evaluation.result}</strong>{" "}
              {text.underCase}{" "}
              <code>
                {result.evaluation.ruleId}@{result.evaluation.ruleVersion}
              </code>
              .
              {"findings" in result.evaluation ? (
                <span className="result-tally">
                  {text.tally(
                    result.evaluation.findings.filter(({ passed }) => passed)
                      .length,
                    result.evaluation.findings.length,
                  )}
                </span>
              ) : null}
            </p>
          )}
          {"evaluation" in result ? (
            <RapidPriceLiftEvaluation
              advancesStep={
                view.guided &&
                view.chapter === STEP.evidence &&
                !view.evidenceOpened
              }
              evaluation={result.evaluation}
              sourceTrace={result.sourceTrace}
              scenario={result.scenario}
              // Every change to the proposal or a reviewer reason revokes the
              // approval and clears the result, so while both exist the
              // proposal on screen is the one the approval binds.
              mapping={
                view.approval
                  ? { proposal: view.proposal, approval: view.approval }
                  : undefined
              }
              onEvidenceOpen={view.openEvidence}
            />
          ) : null}
          <p>{text.boundary}</p>
          <details
            className="result-technical"
            open={!("evaluation" in result)}
          >
            <summary>{text.technical}</summary>
            <p>
              {text.engineVersion}: <code>{result.replay.engineVersion}</code>
            </p>
            <div className="metric-grid">
              <div>
                <span>{text.input}</span>
                <strong>{result.replay.inputEventCount}</strong>
              </div>
              <div>
                <span>{text.canonical}</span>
                <strong>{result.replay.canonicalEventCount}</strong>
              </div>
              <div>
                <span>{text.duplicates}</span>
                <strong>{result.replay.duplicateCount}</strong>
              </div>
            </div>
            <div className="trace-block">
              <span>{text.order}</span>
              <small className="machine-note">
                {eventFieldNote("eventId", language)}
              </small>
              <div className="event-chain">
                {result.replay.orderedEventIds.map((eventId) => (
                  <code key={eventId}>{eventId}</code>
                ))}
              </div>
            </div>
            <div className="hash-block">
              <HashValue
                scope="canonicalResult"
                value={result.replay.canonicalResultHash}
              />
            </div>
            <p>{text.bundle}</p>
          </details>
          <div className="boundary-note">
            <strong>{text.fixtureMode}</strong>
            <p>{result.boundary}</p>
          </div>
        </>
      ) : (
        <div className="empty-result">
          <h2>
            {selectedScenario.manifest
              ? text.readyToReplay
              : text.readyToNormalize}
          </h2>
          <p>
            {selectedScenario.manifest
              ? text.readyWithCase
              : text.readyWithoutCase}
          </p>
        </div>
      )}
    </div>
  );
}
