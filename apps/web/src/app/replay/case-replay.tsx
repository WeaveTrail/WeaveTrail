"use client";

import React from "react";

import type { Language } from "../i18n/language";
import { replayCopy } from "./copy";
import { renderGuideRail, renderStepControls } from "./guide-rail";
import { mappingReviewMessage } from "./mapping-review-messages";
import { ReplayLanguageContext } from "./replay-language";
import { guideView, STEP } from "./steps";
import { renderCasePanel } from "./steps/case-panel";
import { renderControlsPanel } from "./steps/controls-panel";
import { renderExamplePanel } from "./steps/example-panel";
import { renderMappingPanel } from "./steps/mapping-panel";
import { renderRepeatPanel } from "./steps/repeat-panel";
import { renderResultPanel } from "./steps/result-panel";
import { renderRunPanel } from "./steps/run-panel";
import { renderSourcePanel } from "./steps/source-panel";
import type { CaseReplayProps, ReplayError } from "./types";
import { useCaseReplay } from "./use-case-replay";
import { WorkflowStateBadge } from "./workflow-state";
import {
  renderSubmittedOrder,
  renderVariations,
  renderWorkingHeader,
} from "./working-controls";

import "./replay.css";

function errorText(error: ReplayError, language: Language): string {
  const text = replayCopy[language].errors;
  switch (error.kind) {
    case "approval-hash":
      return text.approvalHash;
    case "mapping-unavailable":
      return text.mappingUnavailable;
    case "mapping-review":
      return mappingReviewMessage(error.review, language);
    case "refused":
      return error.message;
    case "failed":
      return text.failed;
  }
}

/**
 * Guided Case Replay and working mode on one surface. `useCaseReplay` owns
 * the state; each step under `steps/` says what it shows, when it holds and
 * the control the rail offers. The walkthrough shows one step's panels at a
 * time beside its rail; working mode shows every panel under one heading. The
 * separate review example is a second surface of its own, so its approval
 * never reaches the worked case.
 */
export function CaseReplay(props: CaseReplayProps) {
  const language = props.language ?? "en";
  const view = guideView(useCaseReplay(props));
  const { guided, mappingExample, error, workflowState } = view;

  return (
    <ReplayLanguageContext.Provider value={language}>
      <section
        className={
          guided
            ? "replay-journey guided-split"
            : mappingExample
              ? "replay-journey"
              : "replay-grid"
        }
      >
        {!mappingExample && (
          <header className="journey-header panel">
            {guided
              ? renderGuideRail(view, language)
              : renderWorkingHeader(view, language)}
          </header>
        )}
        <div
          className="replay-control panel"
          hidden={guided && view.chapter > STEP.run && !error}
        >
          {renderSourcePanel(view, language)}
          {!guided && !mappingExample && renderVariations(view, language)}
          {renderSubmittedOrder(view, language)}
          {renderMappingPanel(view, language)}
          {renderCasePanel(view, language)}
          {renderRunPanel(view, language)}
          {error ? (
            <p className="error-message" role="alert">
              <strong>{replayCopy[language].errors.label}</strong>{" "}
              {errorText(error, language)}
            </p>
          ) : null}
          {error && workflowState ? (
            <WorkflowStateBadge state={workflowState} />
          ) : null}
        </div>
        {renderResultPanel(view, language)}
        {renderRepeatPanel(view, language)}
        {renderExamplePanel(view, language, CaseReplay)}
        {renderControlsPanel(view, language)}
        {guided && (
          <footer className="journey-footer panel">
            {renderStepControls(view, language, "end")}
          </footer>
        )}
      </section>
    </ReplayLanguageContext.Provider>
  );
}
