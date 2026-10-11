import React from "react";

import type { Language } from "../../i18n/language";
import { HashValue } from "../machine-values";
import { repeatLabel, repeatStep } from "./repeat";
import type { ReplayView } from "../use-case-replay";
import { panelLabel } from "./step";

/**
 * The same approved input run again, with both returned hashes and whether
 * they match. A match shows same-input repeatability, nothing more.
 */
export function renderRepeatPanel(view: ReplayView, language: Language) {
  const text = repeatStep.panel[language];
  if (!view.selectedScenario.manifest) return null;
  const returned = view.completeResult
    ? view.result!.replay.canonicalResultHash
    : null;
  return (
    <section className="panel repeat-panel">
      <h3>{panelLabel("05", text.heading)}</h3>
      <p>{text.note}</p>
      <button
        className="button"
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
