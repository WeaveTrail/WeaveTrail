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
          [
            "Walk through a case",
            "/replay",
            "One case, proposal to source row",
          ],
          ["Home", "/", "What it does, with an example screen"],
          ["Model comparison", "/evals", "Every candidate on the held-out set"],
        ],
      ],
      [
        "How it works",
        [
          ["Where it fits", "/why", "The review step this tool supports"],
          ["Architecture", "/architecture", "Who may do what, and where"],
          [
            "Methodology",
            "/methodology",
            "The three results and how to read them",
          ],
          [
            "Expected results",
            "/expectations",
            "What each committed case returns",
          ],
          [
            "Data handling",
            "/data-handling",
            "What is stored and what never is",
          ],
        ],
      ],
    ],
    menu: "Menu",
    closeMenu: "Close menu",
    languageLabel: "Language",
    footerStatus: "Fixture mode · synthetic cases, provenance recorded",
    footerPlanned:
      "Live AI proposals and independent Evidence Bundle export are planned.",
  },
  ko: {
    skipToContent: "본문으로 건너뛰기",
    brand: "WeaveTrail",
    navigationLabel: "주 메뉴",
    navigation: [
      [
        "둘러보기",
        [
          ["사례 따라가기", "/replay", "제안에서 원본 행까지, 사례 하나"],
          ["홈", "/", "하는 일과 예시 화면"],
          ["모델 비교", "/evals", "보관 평가 집합의 모든 후보"],
        ],
      ],
      [
        "작동 방식",
        [
          ["어디에 쓰이나", "/why", "이 도구가 돕는 검토 단계"],
          ["아키텍처", "/architecture", "누가 어디서 무엇을 하는가"],
          ["방법론", "/methodology", "세 가지 결과와 읽는 법"],
          ["기대 결과", "/expectations", "커밋된 사례마다 나오는 결과"],
          ["데이터 처리", "/data-handling", "저장하는 것과 저장하지 않는 것"],
        ],
      ],
    ],
    menu: "메뉴",
    closeMenu: "메뉴 닫기",
    languageLabel: "언어",
    footerStatus: "fixture 모드 · 합성 사례, 출처 기록 있음",
    footerPlanned:
      "실시간 AI 제안과 독립적인 증거 번들 내보내기는 아직 계획입니다.",
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
