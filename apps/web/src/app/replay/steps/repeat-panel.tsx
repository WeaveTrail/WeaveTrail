import React from "react";

import type { Language } from "../../i18n/language";
import { HashValue } from "../machine-values";
import { STEP } from "./index";
import { repeatLabel, repeatStep } from "./repeat";
import { panelLabel, type GuideView } from "./step";

/**
 * The same approved input run again, with both returned hashes and whether
 * they match. A match shows same-input repeatability, nothing more.
 */
export function renderRepeatPanel(view: GuideView, language: Language) {
  const text = repeatStep.panel[language];
  if (
    view.mappingExample ||
    !view.selectedScenario.manifest ||
    (view.guided && view.chapter !== STEP.repeat)
  )
    return null;
  const returned = view.completeResult
    ? view.result!.replay.canonicalResultHash
    : null;
  return (
    <section className="panel repeat-panel">
      <h3>{panelLabel(view, "05", text.heading)}</h3>
      <p>{text.note}</p>
      <button
        className={
          view.guided && view.chapter === STEP.repeat
            ? "button step-action"
            : "button"
        }
        disabled={view.repeatBlocked}
        onClick={() => view.runReplay(true)}
        type="button"
      >
        {repeatLabel(view, language)}
      </button>
      {view.previousHash && (
        <div className="hash-block">
          <HashValue
            label={text.previous}
            scope="canonicalResult"
            value={view.previousHash}
          />
          {returned && (
            <>
              <HashValue
                label={text.repeated}
                scope="canonicalResult"
                value={returned}
              />
              <strong>
                {view.previousHash === returned ? text.match : text.mismatch}
              </strong>
            </>
          )}
        </div>
      )}
    </section>
  );
}
