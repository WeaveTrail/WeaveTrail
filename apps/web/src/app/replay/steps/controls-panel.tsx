import React from "react";

import type { Language } from "../../i18n/language";
import type { ReplayView } from "../use-case-replay";
import { controlsStep } from "./controls";
import { panelLabel } from "./step";

/** What runs today. */
export function renderControlsPanel(_view: ReplayView, language: Language) {
  const text = controlsStep.panel[language];
  return (
    <section className="panel">
      <h3>{panelLabel("06", text.heading)}</h3>
      <p>{text.runs}</p>
      <p>{text.notBuilt}</p>
    </section>
  );
}
