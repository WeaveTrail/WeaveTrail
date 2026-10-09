import type { Language } from "../../i18n/language";
import type { ReplayView } from "../use-case-replay";
import type { GuideStep } from "./step";

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
export const runStep: GuideStep<RunPanel> = {
  stage: "verify",
  actor: "Versioned code decided it",
  narration: {
    en: {
      title: "Run the replay",
      purpose:
        "The server revalidates the exact approvals and source rows, then versioned code recomputes the case. Each request has its own workflow state.",
      action:
        "Run the approved case and wait for its returned evaluation and source trace.",
      actorDetail:
        "The server revalidates both approvals before the versioned rule runs.",
      blocker:
        "Run the approved case and wait for its evaluation and source trace.",
    },
    ko: {
      title: "분석 실행",
      purpose:
        "서버가 승인한 내용과 원본 행을 하나씩 다시 확인한 뒤, 미리 정해진 기준으로 거래 움직임을 다시 계산합니다.",
      action: "승인한 사례를 실행하고 결과와 근거가 돌아올 때까지 기다리세요.",
      actorDetail:
        "판정하는 것은 AI의 답이 아니라 버전이 고정된 코드입니다. 서버는 실행 전에 두 승인을 다시 검증합니다.",
      blocker: "승인한 사례를 실행하고 결과와 근거가 나올 때까지 기다리세요.",
    },
  },
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
  satisfied: (view) => view.completeResult,
  railAction: (view, language) => ({
    kind: "perform",
    label: runLabel(view, language),
    disabled: view.runBlocked,
    done: view.completeResult,
    run: () => view.runReplay(),
  }),
};

/** A source without a case manifest is normalized, never evaluated. */
export function runLabel(view: ReplayView, language: Language) {
  const text = runStep.panel[language];
  if (view.normalizingOnly)
    return view.running ? text.normalizing : text.normalize;
  return view.running ? text.running : text.run;
}
