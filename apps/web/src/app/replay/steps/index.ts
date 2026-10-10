import type { Language } from "../../i18n/language";
import type { ReplayView } from "../use-case-replay";
import { caseApprovalStep } from "./case-approval";
import { controlsStep } from "./controls";
import { evidenceStep } from "./evidence";
import { exampleStep } from "./example";
import { mappingStep } from "./mapping";
import { repeatStep } from "./repeat";
import { runStep } from "./run";
import { sourceStep } from "./source";
import type { GuideStep, GuideView, StepNarration } from "./step";

/**
 * The walkthrough in order. The six steps of the worked case run along the
 * control line; the separate example and the hand-off follow it.
 */
export const GUIDE_STEPS: readonly GuideStep[] = [
  sourceStep,
  mappingStep,
  caseApprovalStep,
  runStep,
  repeatStep,
  evidenceStep,
  exampleStep,
  controlsStep,
];

/** Each step's position, so a panel names the step it belongs to. */
export const STEP = {
  source: 0,
  mapping: 1,
  caseApproval: 2,
  run: 3,
  repeat: 4,
  evidence: 5,
  example: 6,
  controls: 7,
} as const;

/** A step as the rail reads it in one language. */
export type GuideStepText = StepNarration &
  Pick<GuideStep, "stage" | "actor"> & { readonly afterMainFlow: boolean };

export const guideStepsByLanguage: Readonly<
  Record<Language, readonly GuideStepText[]>
> = {
  en: GUIDE_STEPS.map((step) => ({
    stage: step.stage,
    afterMainFlow: step.afterMainFlow === true,
    actor: step.actor,
    ...step.narration.en,
  })),
  ko: GUIDE_STEPS.map((step) => ({
    stage: step.stage,
    afterMainFlow: step.afterMainFlow === true,
    actor: step.actor,
    ...step.narration.ko,
  })),
};

export const guideSteps = guideStepsByLanguage.en;

/** The replay state with the walkthrough's own completion on it. */
export function guideView(view: ReplayView): GuideView {
  const guideSatisfied = GUIDE_STEPS.every((step) => step.satisfied(view));
  return {
    ...view,
    guideSatisfied,
    completeGuide() {
      if (!guideSatisfied) return;
      view.completeChapter(view.chapter);
      view.setFocusPending(true);
      view.onGuideComplete?.();
    },
  };
}
