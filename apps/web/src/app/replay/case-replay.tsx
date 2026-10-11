"use client";

import React from "react";

import type { Language } from "../i18n/language";
import { replayCopy } from "./copy";
import { mappingReviewMessage } from "./mapping-review-messages";
import { ReplayLanguageContext } from "./replay-language";
import { renderCasePanel } from "./steps/case-panel";
import { renderControlsPanel } from "./steps/controls-panel";
import { renderMappingPanel } from "./steps/mapping-panel";
import { renderRepeatPanel } from "./steps/repeat-panel";
import { renderResultPanel } from "./steps/result-panel";
import { renderRunPanel } from "./steps/run-panel";
import { renderSourcePanel } from "./steps/source-panel";
import type { CaseReplayProps, ReplayError } from "./types";
import { useCaseReplay, type ReplayView } from "./use-case-replay";
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
 * Working mode: every panel of a case on one surface, numbered in the order
 * a case is worked. `useCaseReplay` owns the state; each panel under `steps/`
 * renders one part of it. The guided walkthrough is `tour/guided-tour.tsx`.
 */
export function CaseReplay(props: CaseReplayProps) {
  return renderCaseReplay(useCaseReplay(props), props.language ?? "en");
}

/** Working mode over a replay state its caller owns. */
export function CaseReplayView({
  view,
  language,
}: {
  view: ReplayView;
  language: Language;
}) {
  return renderCaseReplay(view, language);
}

function renderCaseReplay(view: ReplayView, language: Language) {
  const { error, workflowState } = view;

  return (
    <ReplayLanguageContext.Provider value={language}>
      <section className="replay-grid">
        <header className="journey-header panel">
          {renderWorkingHeader(view, language)}
        </header>
        <div className="replay-control panel">
          {renderSourcePanel(view, language)}
          {renderVariations(view, language)}
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
        {renderControlsPanel(view, language)}
      </section>
    </ReplayLanguageContext.Provider>
  );
}
