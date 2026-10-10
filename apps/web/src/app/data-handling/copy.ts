import type { Bilingual } from "../i18n/language";

/** The files each statement points to, resolved at the served revision. */
export const evidencePaths = {
  route: "apps/web/src/app/api/replay/route.ts",
  retention: "apps/web/src/app/api/reviewer-text-retention.test.ts",
  browser: "apps/web/src/app/browser-data-boundary.test.ts",
  provider: "apps/web/src/app/provider-client-boundary.test.ts",
  budget: "apps/web/src/lib/public-model-budget.test.ts",
  document: "docs/DATA_HANDLING.md",
  documentKo: "docs/DATA_HANDLING.ko.md",
} as const;

export type Evidence = keyof typeof evidencePaths;

interface Statement {
  readonly question: string;
  readonly answer: string;
  readonly links: readonly (readonly [label: string, evidence: Evidence])[];
}

interface DataHandlingCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly answer: string;
  readonly sections: Readonly<Record<"statements" | "outside", string>>;
  readonly statementsLine: string;
  readonly statements: readonly Statement[];
  readonly outsideLine: string;
  readonly outsideMore: readonly string[];
  readonly fullDocument: readonly [string, Evidence];
}

/**
 * What the site sends, keeps and logs, for a security or compliance reviewer.
 * Each statement names the code or test that enforces it.
 */
export const dataHandlingCopy: Bilingual<DataHandlingCopy> = {
  en: {
    eyebrow: "Data handling",
    title: "What the site sends, keeps and logs.",
    answer:
      "The site keeps no approval and no text a person types. The only thing your browser stores is your language choice.",
    sections: {
      statements: "Each statement and its evidence",
      outside: "Outside the code",
    },
    statementsLine:
      "Every statement runs today and links to the code or test that enforces it.",
    statements: [
      {
        question: "What you send",
        answer:
          "Only registered synthetic source rows and explicit approvals. No route accepts pasted text.",
        links: [["Replay route", "route"]],
      },
      {
        question: "Reviewer text",
        answer:
          "A reviewer reference and reasons are validated, then never returned, stored, logged or sent to a model. Type nothing personal there.",
        links: [["Retention test", "retention"]],
      },
      {
        question: "Storage",
        answer:
          "Approvals are not stored. Configured live model requests keep only daily counters under a daily visitor key, expiring at 00:00 KST; raw IPs are never kept.",
        links: [
          ["Retention test", "retention"],
          ["Daily budget test", "budget"],
        ],
      },
      {
        question: "Logs",
        answer:
          "The application writes nothing from a request to a log, stream or file.",
        links: [["Retention test", "retention"]],
      },
      {
        question: "Model",
        answer:
          "The walkthrough calls no model. A configured mapping model receives only an eligible synthetic source's columns and samples; its settings stay on the server.",
        links: [
          ["Retention test", "retention"],
          ["Credential boundary test", "provider"],
        ],
      },
      {
        question: "Browser",
        answer:
          "Requests go only to this site's own API, and only the language choice is kept in browser storage.",
        links: [["Browser boundary test", "browser"]],
      },
    ],
    outsideLine:
      "The tests check this repository's source, not a deployed build or the hosting account.",
    outsideMore: [
      "The hosting platform's own request logs are set in the hosting account. Following a source or evidence link opens that other site, as any link does.",
      "Production runs in fixture mode. Enabling configured mapping in production is planned, and must update the retention test and this page together.",
    ],
    fullDocument: ["Full statement with sources", "document"],
  },
  ko: {
    eyebrow: "데이터 처리",
    title: "사이트가 보내고, 남기고, 기록하는 것.",
    answer:
      "사이트는 승인도, 사람이 입력한 글도 남기지 않습니다. 브라우저에 저장되는 것은 언어 선택 하나뿐입니다.",
    sections: {
      statements: "설명과 근거",
      outside: "코드 밖의 범위",
    },
    statementsLine:
      "아래 설명은 모두 지금 동작하며, 이를 강제하는 코드나 테스트로 이어집니다.",
    statements: [
      {
        question: "보내는 것",
        answer:
          "등록된 합성 원본 행과 명시적인 승인만 보냅니다. 붙여넣은 글을 받는 경로는 없습니다.",
        links: [["분석 실행 경로", "route"]],
      },
      {
        question: "검토자 입력",
        answer:
          "검토자 참조와 확인 이유는 검증에만 쓰며, 응답으로 돌려주거나 저장·기록하거나 모델에 보내지 않습니다. 개인 정보는 적지 마십시오.",
        links: [["보관 금지 테스트", "retention"]],
      },
      {
        question: "저장",
        answer:
          "승인은 저장하지 않습니다. 설정된 실제 모델 요청은 일일 방문자 키 아래 일일 횟수만 남기고 00:00 KST에 만료시키며, 원시 IP는 남기지 않습니다.",
        links: [
          ["보관 금지 테스트", "retention"],
          ["일일 예산 테스트", "budget"],
        ],
      },
      {
        question: "로그",
        answer:
          "애플리케이션은 요청 내용을 로그, 출력 스트림, 파일에 쓰지 않습니다.",
        links: [["보관 금지 테스트", "retention"]],
      },
      {
        question: "모델",
        answer:
          "사례 따라가기는 모델을 호출하지 않습니다. 설정된 항목 연결 모델은 허용된 합성 원본의 열과 표본만 받으며, 그 설정은 서버에만 있습니다.",
        links: [
          ["보관 금지 테스트", "retention"],
          ["인증 정보 경계 테스트", "provider"],
        ],
      },
      {
        question: "브라우저",
        answer:
          "요청은 이 사이트의 API로만 가고, 브라우저 저장 공간에는 언어 선택만 남깁니다.",
        links: [["브라우저 경계 테스트", "browser"]],
      },
    ],
    outsideLine:
      "테스트는 이 저장소의 소스를 확인하며, 배포된 빌드나 호스팅 계정은 확인하지 않습니다.",
    outsideMore: [
      "호스팅 플랫폼의 요청 기록은 호스팅 계정에서 따로 설정합니다. 출처나 근거 링크를 누르면 여느 링크처럼 그 사이트가 열립니다.",
      "운영 배포는 fixture 모드로 동작합니다. 운영에서 설정된 항목 연결을 켜는 일은 계획이며, 그때는 보관 금지 테스트와 이 페이지를 함께 고쳐야 합니다.",
    ],
    fullDocument: ["출처를 포함한 전체 문서", "documentKo"],
  },
};
