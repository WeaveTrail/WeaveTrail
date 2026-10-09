import React from "react";

import type { Language } from "../../i18n/language";
import { WorkflowStateBadge } from "../workflow-state";
import { STEP } from "./index";
import { runLabel } from "./run";
import { shows, type GuideView } from "./step";

/** The run control, and the state the returned result reached. */
export function renderRunPanel(view: GuideView, language: Language) {
  return (
    <div hidden={!shows(view, STEP.run) || view.mappingExample}>
      <button
        className={
          view.guided && view.chapter === STEP.run
            ? "button primary run-button step-action"
            : "button primary run-button"
        }
        disabled={view.runBlocked}
        onClick={() => view.runReplay()}
        type="button"
      >
        {runLabel(view, language)}
      </button>
      {view.guided && view.completeResult && view.result && (
        <WorkflowStateBadge state={view.result.workflowState} />
      )}
    </div>
  );
}
