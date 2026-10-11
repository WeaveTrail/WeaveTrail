import type { Language } from "../../i18n/language";
import type { ReplayView } from "../use-case-replay";
import type { PanelCopy } from "./step";

interface RunPanel {
  readonly run: string;
  readonly running: string;
  readonly normalize: string;
  readonly normalizing: string;
}

/**
 * Step 4: the server revalidates both approvals and the source rows, then
 * versioned code recomputes the case.
 */
export const runStep: PanelCopy<RunPanel> = {
  panel: {
    en: {
      run: "Run deterministic replay",
      running: "Replaying…",
      normalize: "Normalize source",
      normalizing: "Normalizing…",
    },
    ko: {
      run: "분석 실행",
      running: "분석 실행 중…",
      normalize: "원본 자료 정리",
      normalizing: "자료 정리 중…",
    },
  },
};

/** A source without a case manifest is normalized, never evaluated. */
export function runLabel(view: ReplayView, language: Language) {
  const text = runStep.panel[language];
  if (view.normalizingOnly)
    return view.running ? text.normalizing : text.normalize;
  return view.running ? text.running : text.run;
}
