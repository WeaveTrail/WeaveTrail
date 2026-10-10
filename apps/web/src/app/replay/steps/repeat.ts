import type { Language } from "../../i18n/language";
import { replayCopy } from "../copy";
import type { ReplayView } from "../use-case-replay";
import type { GuideStep } from "./step";

interface RepeatPanel {
  readonly heading: string;
  readonly note: string;
  readonly repeat: string;
  readonly running: string;
  readonly previous: string;
  readonly repeated: string;
  readonly match: string;
  readonly mismatch: string;
}

/**
 * Step 5: the same approved input again. Two server-returned hashes compared
 * as strings check same-input repeatability, and nothing more.
 */
export const repeatStep: GuideStep<RepeatPanel> = {
  stage: "verify",
  actor: "Versioned code decided it",
  narration: {
    en: {
      title: "Repeat the case",
      purpose:
        "Execute the same approved input again. Comparing two returned hashes checks same-input repeatability only.",
      action:
        "Repeat the same approved case and compare the two server-returned hashes.",
      actorDetail:
        "Both hashes are returned by the server. The browser compares them as strings.",
      blocker: "Repeat the same approved case to compare returned hashes.",
    },
    ko: {
      title: "동일 사례 반복 확인",
      purpose:
        "같은 자료를 같은 조건으로 한 번 더 실행합니다. 두 결과 해시를 비교하는 것은 같은 입력에 대한 재현성만 확인하는 일입니다.",
      action: "같은 사례를 다시 실행하고 두 결과 해시가 같은지 비교하세요.",
      actorDetail:
        "두 해시 모두 서버가 반환한 값이고, 화면은 그 둘을 문자열로 비교합니다.",
      blocker: "같은 사례를 다시 실행해 두 결과 해시를 비교하세요.",
    },
  },
  panel: {
    en: {
      heading: "Same-input repeatability",
      note: "Repeat the approved case and compare the returned hashes. This checks same-input repeatability only.",
      repeat: "Repeat the same approved case",
      running: "Replaying…",
      previous: "Previous returned hash",
      repeated: "Repeated returned hash",
      match: "MATCH · same-input repeatability",
      mismatch: "MISMATCH · retry or inspect the returned results",
    },
    ko: {
      heading: "같은 입력의 반복 가능성",
      note: "승인된 사례를 반복하고 반환된 해시를 비교하세요. 같은 입력의 반복 가능성만 확인합니다.",
      repeat: "같은 사례 다시 실행",
      running: "분석 실행 중…",
      previous: "이전 반환 해시",
      repeated: "반복 반환 해시",
      match: "일치 · 같은 입력 반복 가능",
      mismatch: "불일치 · 다시 실행하거나 결과 확인",
    },
  },
  satisfied: (view) => view.repeatMatches,
  railAction: (view, language) => ({
    kind: "perform",
    label: repeatLabel(view, language),
    disabled: view.repeatBlocked,
    done: view.repeatMatches,
    run: () => view.runReplay(true),
  }),
  // Once a repeat has come back, what is missing is a match, not a repeat.
  blockerFor: (view, language) =>
    view.previousHash && view.completeResult
      ? replayCopy[language].rail.hashesDiffer
      : null,
};

export function repeatLabel(view: ReplayView, language: Language) {
  const text = repeatStep.panel[language];
  return view.running ? text.running : text.repeat;
}
