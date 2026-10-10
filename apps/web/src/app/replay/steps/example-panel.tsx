import React from "react";

import type { Language } from "../../i18n/language";
import type { CaseReplayProps } from "../types";
import { exampleStep } from "./example";
import { STEP } from "./index";
import type { GuideView } from "./step";

/**
 * The separate review example: its own source and proposal, mounted as a
 * replay surface of its own so its approval can never reach the worked case.
 */
export function renderExamplePanel(
  view: GuideView,
  language: Language,
  Surface: React.ComponentType<CaseReplayProps>,
) {
  const text = exampleStep.panel[language];
  const example = view.exampleScenario;
  if (!view.guided || !example) return null;
  return (
    <section
      aria-labelledby="mapping-example-heading"
      className="panel mapping-example"
      hidden={view.chapter !== STEP.example}
    >
      <h3 id="mapping-example-heading">{text.heading}</h3>
      <p className="mapping-example-scope">{text.scope}</p>
      <p>
        {example.mappingRequestRequired
          ? text.requestFirst
          : text.reasonKeepsUnmapped}
      </p>
      <Surface
        proposals={view.proposals}
        providerMode={view.providerMode}
        scenarios={[example]}
        language={language}
        mappingExample
        onMappingApprovalChange={view.setExampleApproved}
      />
    </section>
  );
}
