import type { Language } from "../../i18n/language";
import type { ReplayView } from "../use-case-replay";
import type { PanelCopy } from "./step";

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
export const repeatStep: PanelCopy<RepeatPanel> = {
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
};

export function repeatLabel(view: ReplayView, language: Language) {
  const text = repeatStep.panel[language];
  return view.running ? text.running : text.repeat;
}
