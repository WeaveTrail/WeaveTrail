import type { Language } from "./i18n/language";

/**
 * The four stages of the control line, named for what the visitor does in
 * each: confirm the AI's column matches, set the review scope, get the
 * result, check the evidence. Guided Case Replay groups its steps under them
 * and the home page draws them, so both read the names from here.
 */
export const GUIDE_STAGES = ["propose", "approve", "verify", "trace"] as const;
export type GuideStage = (typeof GUIDE_STAGES)[number];

export const guideStageNames: Readonly<
  Record<Language, Record<GuideStage, string>>
> = {
  en: {
    propose: "Match the columns",
    approve: "Set the scope",
    verify: "Get the result",
    trace: "Check the evidence",
  },
  ko: {
    propose: "항목 맞추기",
    approve: "조사 범위 정하기",
    verify: "결과 받기",
    trace: "근거 확인하기",
  },
};
