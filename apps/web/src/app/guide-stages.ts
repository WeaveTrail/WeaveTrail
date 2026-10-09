import type { Language } from "./i18n/language";

/**
 * The four stages of the control line: AI proposes, a person approves, code
 * verifies, evidence traces back. Guided Case Replay groups its steps under
 * them and the home page draws them, so both read the names from here.
 */
export const GUIDE_STAGES = ["propose", "approve", "verify", "trace"] as const;
export type GuideStage = (typeof GUIDE_STAGES)[number];

export const guideStageNames: Readonly<
  Record<Language, Record<GuideStage, string>>
> = {
  en: {
    propose: "AI proposes",
    approve: "A person approves",
    verify: "Code verifies",
    trace: "Evidence traces back",
  },
  ko: {
    propose: "AI가 제안",
    approve: "사람이 승인",
    verify: "코드가 검증",
    trace: "근거를 원본까지 추적",
  },
};
