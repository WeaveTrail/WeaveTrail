import React from "react";

import type { Language } from "../i18n/language";
import { replayCopy } from "./copy";
import type { ReplayView } from "./use-case-replay";

/**
 * One heading says what to do with the chosen source, and the input
 * variations change what is submitted.
 */
export function renderWorkingHeader(view: ReplayView, language: Language) {
  const text = replayCopy[language].working;
  return (
    <>
      <h2>{text.heading}</h2>
      <p>
        {view.selectedScenario.manifest ? text.withCase : text.withoutCase}{" "}
        {text.variationsNote}
      </p>
    </>
  );
}

export function renderVariations(view: ReplayView, language: Language) {
  const text = replayCopy[language].working;
  return (
    <details className="advanced-controls">
      <summary>{text.variationsSummary}</summary>
      <p>{text.variationsDetail}</p>
      <div className="option-list">
        {(["baseline", "shuffle", "duplicate"] as const)
          .filter((option) =>
            view.selectedScenario.availableMutations.includes(option),
          )
          .map((option) => (
            <label
              className={
                view.mutation === option ? "option selected" : "option"
              }
              key={option}
            >
              <input
                checked={view.mutation === option}
                name="mutation"
                onChange={() => view.chooseMutation(option)}
                type="radio"
                value={option}
              />
              <span>
                <strong>{text.mutations[option][0]}</strong>
                <small>{text.mutations[option][1]}</small>
              </span>
            </label>
          ))}
      </div>
    </details>
  );
}

/** The order the request carried, to compare with the canonical order. */
export function renderSubmittedOrder(view: ReplayView, language: Language) {
  const text = replayCopy[language].working;
  if (!view.submittedOrder) return null;
  return (
    <section aria-label={text.submittedOrderLabel}>
      <h3>{text.submittedOrderLabel}</h3>
      <p>{text.submittedOrderDetail}</p>
      <p>
        <code>{view.submittedOrder.join(" → ")}</code>
      </p>
    </section>
  );
}
