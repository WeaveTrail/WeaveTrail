import React from "react";

import { GUIDE_STAGES, guideStageNames } from "../guide-stages";
import type { Language } from "../i18n/language";
import { replayCopy } from "./copy";
import { GUIDE_STEPS, guideStepsByLanguage } from "./steps";
import type { GuideView, StepNarration } from "./steps/step";

/** The current step's narration, with any state-dependent part laid over it. */
function narration(view: GuideView, language: Language): StepNarration {
  const step = GUIDE_STEPS[view.chapter]!;
  return {
    ...step.narration[language],
    ...step.narrationFor?.(view, language),
  };
}

/**
 * Back and Continue. Rendered as a function rather than a nested component so
 * the same controls open and close the step without duplicating their state.
 */
export function renderStepControls(
  view: GuideView,
  language: Language,
  place: "rail" | "end",
) {
  const text = replayCopy[language].rail;
  const canContinue = GUIDE_STEPS[view.chapter]!.satisfied(view);
  return (
    <nav
      aria-label={
        place === "rail" ? text.navigationInRail : text.navigationAtEnd
      }
      className="journey-controls"
    >
      <button
        className="button"
        disabled={view.chapter === 0}
        onClick={() => view.goToChapter(view.chapter - 1)}
        type="button"
      >
        {text.back}
      </button>
      {view.chapter < GUIDE_STEPS.length - 1 && (
        <button
          aria-describedby={canContinue ? undefined : "guide-requirement"}
          className="button primary"
          disabled={!canContinue}
          onClick={() => {
            if (!canContinue) return;
            view.completeChapter(view.chapter);
            view.goToChapter(view.chapter + 1);
          }}
          type="button"
        >
          {text.continueLabel}
        </button>
      )}
    </nav>
  );
}

/**
 * The step rail: the step, its one instruction, whose turn it is, what still
 * blocks Continue, the control that advances the step and who acted. Why the
 * step exists and the full step list each wait in one disclosure.
 */
export function renderGuideRail(view: GuideView, language: Language) {
  const text = replayCopy[language].rail;
  const stageNames = guideStageNames[language];
  const steps = guideStepsByLanguage[language];
  const definition = GUIDE_STEPS[view.chapter]!;
  const step = narration(view, language);
  const satisfied = GUIDE_STEPS.map((candidate) => candidate.satisfied(view));
  const canContinue = satisfied[view.chapter]!;
  const blocker = definition.blockerFor?.(view, language) ?? step.blocker;
  // Read-ahead is allowed, so an earlier step can still be unmet while the
  // visitor reads a later one. Completion means the visitor satisfied the step
  // themselves and it still holds.
  const unmetEarlierStep = satisfied
    .slice(0, view.chapter)
    .findIndex((value) => !value);
  const stepCompleted = (index: number) =>
    view.completedSteps.includes(index) && satisfied[index] === true;
  const action = definition.railAction(view, language);
  const stageNumber = GUIDE_STAGES.indexOf(definition.stage) + 1;
  // The step list, grouped under the stage each step belongs to; the steps
  // after the worked case form their own group at the end.
  const groups = [
    ...GUIDE_STAGES.map((stage, index) => ({
      key: stage,
      heading: `${index + 1} · ${stageNames[stage]}`,
      steps: GUIDE_STEPS.flatMap((candidate, stepIndex) =>
        candidate.stage === stage && !candidate.afterMainFlow
          ? [stepIndex]
          : [],
      ),
    })),
    {
      key: "after",
      heading: text.afterMainFlow,
      steps: GUIDE_STEPS.flatMap((candidate, stepIndex) =>
        candidate.afterMainFlow ? [stepIndex] : [],
      ),
    },
  ];
  const actor = replayCopy[language].actors[definition.actor];
  return (
    <>
      <div className="rail-lead">
        <p className="rail-progress">
          <span>{text.stepOf(view.chapter + 1, steps.length)}</span>
          <span
            aria-hidden="true"
            className="rail-meter"
            style={{
              // The bar is decoration for the count beside it, which is what
              // a screen reader announces.
              ["--rail-meter-fill" as string]: `${((view.chapter + 1) / steps.length) * 100}%`,
            }}
          />
        </p>
        <h2 ref={view.focusChapterTitle} tabIndex={-1}>
          {text.stepHeading(view.chapter + 1, step.title)}
        </h2>
        <p className="step-instruction">{step.action}</p>
        <div className="rail-actions">
          {/* Inside the action block so it stays on screen wherever that
              block does, including the bar pinned to the bottom of a narrow
              screen. */}
          <p
            className="step-stage"
            data-stage={definition.stage}
            id="guide-stage"
          >
            <span className="step-stage-label">
              {definition.afterMainFlow
                ? text.afterMainFlow
                : text.stageOf(stageNumber, GUIDE_STAGES.length)}
            </span>{" "}
            <strong>{stageNames[definition.stage]}</strong>
          </p>
          <p
            className="step-requirement"
            data-met={canContinue && unmetEarlierStep === -1}
            id="guide-requirement"
            role="status"
          >
            {canContinue ? text.readyToContinue : text.toContinue(blocker)}
            {unmetEarlierStep === -1
              ? ""
              : text.readingAhead(
                  unmetEarlierStep + 1,
                  steps[unmetEarlierStep]!.title,
                )}
          </p>
          {action ? (
            // The rail's control is the one a visitor is told to use, so it
            // stops asking once the step is done: emphasis marks the work
            // still outstanding, and a satisfied step steps back to a quiet
            // control.
            <button
              className={
                action.kind === "perform"
                  ? `button${action.done ? "" : " primary step-action"}`
                  : "button step-locate"
              }
              data-approved={
                action.kind === "perform" ? action.done === true : undefined
              }
              disabled={action.disabled}
              onClick={() => action.run()}
              type="button"
            >
              {action.label}
            </button>
          ) : null}
          {renderStepControls(view, language, "rail")}
        </div>
      </div>
      <div className="rail-scroll">
        <p className="step-actor" data-actor={definition.actor}>
          <span>{text.whoActed}</span> <strong>{actor}</strong>
        </p>
        {/* The reasoning is one tap away, so the rail leads with the
            instruction and its control. */}
        <details className="step-why">
          <summary>{text.whyThisStep}</summary>
          <dl className="step-intent">
            <div>
              <dt>{text.whatThisShows}</dt>
              <dd>{step.purpose}</dd>
            </div>
            <div>
              <dt>{text.whoActed}</dt>
              <dd>
                <strong>{actor}</strong> {step.actorDetail}
              </dd>
            </div>
          </dl>
        </details>
        {step.refusal ? (
          <p className="step-refusal" data-status="REVIEW_REQUIRED">
            {step.refusal}
          </p>
        ) : null}
        <details className="rail-steps">
          <summary className="rail-list-heading">{text.stepListLabel}</summary>
          <nav aria-label={text.progressLabel} className="stage-groups">
            {groups.map((group) => (
              <section
                aria-labelledby={`guide-group-${group.key}`}
                className="stage-group"
                data-current={group.steps.includes(view.chapter)}
                key={group.key}
              >
                <h4 id={`guide-group-${group.key}`}>{group.heading}</h4>
                <ol className="journey-progress">
                  {group.steps.map((index) => (
                    <li
                      key={steps[index]!.title}
                      aria-current={view.chapter === index ? "step" : undefined}
                    >
                      <button
                        className="journey-step"
                        data-complete={stepCompleted(index)}
                        onClick={() => view.goToChapter(index)}
                        type="button"
                      >
                        <span>{`${index + 1}. ${steps[index]!.title}`}</span>
                        {stepCompleted(index) || view.chapter === index ? (
                          <small>
                            {stepCompleted(index)
                              ? text.completed
                              : text.currentStep}
                          </small>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </nav>
        </details>
      </div>
    </>
  );
}
