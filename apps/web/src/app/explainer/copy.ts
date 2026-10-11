import type { Bilingual } from "../i18n/language";

/** The words every explanatory page shares. */
export const explainerCopy: Bilingual<{
  readonly more: string;
  readonly implemented: string;
  readonly planned: string;
  readonly onThisPage: string;
}> = {
  en: {
    more: "Details",
    implemented: "Runs today",
    planned: "Planned",
    onThisPage: "On this page",
  },
  ko: {
    more: "자세히",
    implemented: "지금 동작",
    planned: "계획",
    onThisPage: "이 페이지의 내용",
  },
};
