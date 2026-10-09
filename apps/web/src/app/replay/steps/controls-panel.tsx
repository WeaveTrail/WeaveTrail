import React from "react";

import type { Language } from "../../i18n/language";
import { controlsStep } from "./controls";
import { STEP } from "./index";
import { panelLabel, type GuideView } from "./step";

/** What runs today, and the hand-off to working mode. */
export function renderControlsPanel(view: GuideView, language: Language) {
  const text = controlsStep.panel[language];
  if (view.mappingExample) return null;
  return (
    <section
      className="panel"
      hidden={view.guided && view.chapter !== STEP.controls}
    >
      <h3>{panelLabel(view, "06", text.heading)}</h3>
      <p>{text.runs}</p>
      <p>{text.notBuilt}</p>
      {view.guided && (
        <button
          className={
            view.chapter === STEP.controls
              ? "button primary step-action"
              : "button primary"
          }
          type="button"
          disabled={!view.guideSatisfied}
          onClick={view.completeGuide}
        >
          {text.toWorkingMode}
        </button>
      )}
      {view.guided && (
        <p className="guide-next">
          <span>{text.nextHeading}</span>{" "}
          <a href="/evals">{text.nextComparison}</a>
        </p>
      )}
    </section>
  );
}
