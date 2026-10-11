import React from "react";

import type { ReplayScenario } from "@weavetrail/contracts";

import type { Language } from "../../i18n/language";
import { scenarioOptionLabel } from "../scenario-labels";
import { SourceRows } from "../source-rows";
import { sourceStep } from "./source";
import type { ReplayView } from "../use-case-replay";
import { panelLabel } from "./step";

/** The committed source, chosen from the list, and its rows. */
export function renderSourcePanel(view: ReplayView, language: Language) {
  const text = sourceStep.panel[language];
  return (
    <>
      <div>
        <span className="panel-label">{panelLabel("01", text.panelLabel)}</span>
        <label className="scenario-select">
          <span>{text.selectLabel}</span>
          <select
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
      <SourceRows scenario={view.selectedScenario} />
    </>
  );
}
