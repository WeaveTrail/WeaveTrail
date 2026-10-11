import React from "react";

import type { Language } from "../../i18n/language";
import type { ReplayView } from "../use-case-replay";
import { runLabel } from "./run";

/** The run control. */
export function renderRunPanel(view: ReplayView, language: Language) {
  return (
    <div>
      <button
        className="button primary run-button"
        disabled={view.runBlocked}
        onClick={() => view.runReplay()}
        type="button"
      >
        {runLabel(view, language)}
      </button>
    </div>
  );
}
