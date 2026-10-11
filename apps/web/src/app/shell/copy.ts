import type { Bilingual } from "../i18n/language";

/** A destination: its label, its route and, for the menu, one line on it. */
export type NavigationItem = readonly [
  label: string,
  href: string,
  note: string,
];
export type NavigationGroup = readonly [string, readonly NavigationItem[]];

interface ShellCopy {
  readonly skipToContent: string;
  readonly brand: string;
  readonly navigationLabel: string;
  /**
   * Two groups. The first holds what a visitor comes to do and sits in the
   * bar; the second explains how it works and opens from one menu.
   */
  readonly navigation: readonly [NavigationGroup, NavigationGroup];
  readonly menu: string;
  readonly closeMenu: string;
  readonly languageLabel: string;
  /**
   * The disclosures every page carries: what runs here and on which data, and
   * what is still planned.
   */
  readonly footerStatus: string;
  readonly footerPlanned: string;
}

export const shellCopy: Bilingual<ShellCopy> = {
  en: {
    skipToContent: "Skip to content",
    brand: "WeaveTrail",
    navigationLabel: "Primary navigation",
    navigation: [
      [
        "Explore",
        [
          ["Try it", "/replay", "Five steps with an example case"],
          ["Home", "/", "What you can do here"],
          ["Model comparison", "/evals", "How the AI model is chosen"],
        ],
      ],
      [
        "How it works",
        [
          ["Why WeaveTrail", "/why", "What it gives a reviewer"],
          [
            "How it runs",
            "/architecture",
            "Who does what: the AI, you and fixed rules",
          ],
        ],
      ],
    ],
    menu: "Menu",
    closeMenu: "Close menu",
    languageLabel: "Language",
    footerStatus: "Runs on synthetic demo data · provenance recorded",
    footerPlanned: "Live AI suggestions and evidence export are planned.",
  },
  ko: {
    skipToContent: "본문으로 건너뛰기",
    brand: "WeaveTrail",
    navigationLabel: "주 메뉴",
    navigation: [
      [
        "둘러보기",
        [
          ["체험하기", "/replay", "예시 사례로 5단계 체험"],
          ["홈", "/", "여기서 할 수 있는 일"],
          ["모델 비교", "/evals", "AI 모델을 고르는 방법"],
        ],
      ],
      [
        "작동 방식",
        [
          ["왜 WeaveTrail인가", "/why", "검토자가 얻는 것"],
          [
            "작동 원리",
            "/architecture",
            "AI와 검토자, 계산 규칙이 나눠 맡는 일",
          ],
        ],
      ],
    ],
    menu: "메뉴",
    closeMenu: "메뉴 닫기",
    languageLabel: "언어",
    footerStatus: "시연용 합성 자료로 동작합니다 · 출처 기록 있음",
    footerPlanned: "실시간 AI 제안과 근거 내보내기는 계획 단계입니다.",
  },
};

/**
 * The language switch names each language in that language, so its labels
 * are the same whichever language is showing.
 */
export const languageOptions = [
  {
    value: "en",
    label: "English",
    short: "EN",
    description: "Show this site in English",
  },
  {
    value: "ko",
    label: "한국어",
    short: "한",
    description: "이 사이트를 한국어로 봅니다",
  },
] as const;
