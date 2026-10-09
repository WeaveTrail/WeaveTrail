import type { GuideStage } from "../../guide-stages";
import type { Bilingual, Language } from "../../i18n/language";
import type { Actor } from "../copy";
import type { ReplayView } from "../use-case-replay";

/** The replay state, with whether every step of the walkthrough holds. */
export type GuideView = ReplayView & {
  readonly guideSatisfied: boolean;
  /** Hands the walkthrough over to working mode once every step holds. */
  readonly completeGuide: () => void;
};

/** What the rail says about a step. */
export interface StepNarration {
  readonly title: string;
  /** Why the step exists. */
  readonly purpose: string;
  /** The one thing the visitor does. */
  readonly action: string;
  readonly actorDetail: string;
  /** What still has to happen before Continue; blank when nothing gates it. */
  readonly blocker: string;
  /** A stop the step keeps on its path, stated with what clears it. */
  readonly refusal?: string;
}

/**
 * The one control that advances a step, offered in the rail so performing a
 * step never depends on finding its control in the case column. A step whose
 * work happens inside the case content — writing a reviewer reason, opening a
 * finding's evidence — gets a control that goes there and takes focus with
 * it, rather than one that does the work for the visitor.
 */
export interface StepAction {
  readonly kind: "perform" | "locate";
  readonly label: string;
  readonly disabled: boolean;
  /**
   * Whether this action has already been carried out. The step's continue
   * condition cannot answer this: a step that gates nothing is satisfied from
   * the start while its action is still outstanding.
   */
  readonly done?: boolean;
  readonly run: () => unknown;
}

/**
 * One step of the walkthrough: where it sits on the control line, who acts in
 * it, what the rail says, when the visitor's own work satisfies it, and the
 * control the rail offers. What the step shows sits in its `*-panel.tsx`.
 */
export interface GuideStep<Panel = unknown> {
  readonly stage: GuideStage;
  /** The steps after the worked case follow it rather than drive it. */
  readonly afterMainFlow?: boolean;
  readonly actor: Actor;
  readonly narration: Bilingual<StepNarration>;
  /** The step's own panel copy. */
  readonly panel: Bilingual<Panel>;
  readonly satisfied: (view: ReplayView) => boolean;
  readonly railAction: (
    view: GuideView,
    language: Language,
  ) => StepAction | null;
  /** A blocker that depends on state, in place of the narration's own. */
  readonly blockerFor?: (view: ReplayView, language: Language) => string | null;
  /** Narration that depends on state, laid over the step's own. */
  readonly narrationFor?: (
    view: ReplayView,
    language: Language,
  ) => Partial<StepNarration> | null;
}

/** Moves to an element in the case column and takes focus there. */
export function reveal(target: HTMLElement | null) {
  if (!target) return;
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  target.focus({ preventScroll: true });
}

/** Where the rail sends a visitor whose step is performed in the case column. */
export const GUIDE_TARGET_EXAMPLE = "guide-target-example";
export const GUIDE_TARGET_EVIDENCE = "guide-target-evidence";

/** Whether a step's panel shows: every panel in working mode, one when guided. */
export const shows = (view: ReplayView, step: number) =>
  !view.guided || view.chapter === step;

/** Working mode numbers its panels; the walkthrough names them only. */
export const panelLabel = (view: ReplayView, order: string, label: string) =>
  view.guided ? label : `${order} · ${label}`;
