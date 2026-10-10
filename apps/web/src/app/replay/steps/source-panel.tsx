import React from "react";

import type { ReplayScenario } from "@weavetrail/contracts";

import type { Language } from "../../i18n/language";
import { scenarioOptionLabel } from "../scenario-labels";
import { SourceRows } from "../source-rows";
import { STEP } from "./index";
import { sourceStep } from "./source";
import { panelLabel, shows, type GuideView } from "./step";

/**
 * The committed source. Working mode chooses it from the list; the
 * walkthrough fixes it, so the list reads as the source's name.
 */
export function renderSourcePanel(view: GuideView, language: Language) {
  const text = sourceStep.panel[language];
  return (
    <>
      <div hidden={!shows(view, STEP.source) || view.mappingExample}>
        <span className="panel-label">
          {panelLabel(view, "01", text.panelLabel)}
        </span>
        <label className="scenario-select">
          <span>{text.selectLabel}</span>
          <select
            disabled={view.guided}
            onChange={(event) =>
              view.chooseScenario(event.target.value as ReplayScenario)
            }
            value={view.scenario}
          >
            {view.scenarios.map(({ label, value, purpose }) => (
              <option key={value} value={value}>
                {scenarioOptionLabel(value, label, purpose, language)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div hidden={!shows(view, STEP.source) && !view.mappingExample}>
        <SourceRows scenario={view.selectedScenario} />
      </div>
    </>
  );
}
