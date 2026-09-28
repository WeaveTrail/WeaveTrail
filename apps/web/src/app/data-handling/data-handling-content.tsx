"use client";

import React from "react";

import { useCopy, type Language } from "../i18n/language";

const REPOSITORY = "https://github.com/WeaveTrail/WeaveTrail";

/** The files each statement points to, resolved at the served revision. */
const evidencePaths = {
  route: "apps/web/src/app/api/check/coverage/route.ts",
  retention: "apps/web/src/app/api/check/pasted-text-retention.test.ts",
  browser: "apps/web/src/app/browser-data-boundary.test.ts",
  provider: "apps/web/src/app/provider-client-boundary.test.ts",
  document: "docs/DATA_HANDLING.md",
  documentKo: "docs/DATA_HANDLING.ko.md",
} as const;

type Evidence = keyof typeof evidencePaths | "share";

export function evidenceUrl(evidence: Evidence, revision: string): string {
  if (evidence === "share") return `${REPOSITORY}/issues/159`;
  return `${REPOSITORY}/blob/${revision}/${evidencePaths[evidence]}`;
}

type Statement = {
  question: string;
  answer: string;
  planned: boolean;
  links: readonly (readonly [string, Evidence])[];
};

type DataHandlingCopy = {
  eyebrow: string;
  heading: string;
  lede: string;
  statementsLabel: string;
  now: string;
  planned: string;
  statements: readonly Statement[];
  outsideLabel: string;
  outside: string;
  fullDocument: readonly [string, Evidence];
};

export const dataHandlingCopy: Readonly<Record<Language, DataHandlingCopy>> = {
  en: {
    eyebrow: "Data handling",
    heading: "What a check sends, keeps and logs.",
    lede: "For a security or compliance reviewer. Each statement links to the code or test that enforces it.",
    statementsLabel: "Statements and their evidence",
    now: "Now",
    planned: "Planned",
    statements: [
      {
        question: "Pasted text",
        answer:
          "No route accepts pasted text yet. The one check route takes a structured scope, and a malformed or extended request is refused.",
        planned: false,
        links: [["Check route", "route"]],
      },
      {
        question: "Storage",
        answer:
          "A check request is stored nowhere. A check route loads no database, store or file writer, and the deployment has no database.",
        planned: false,
        links: [["Retention test", "retention"]],
      },
      {
        question: "Logs",
        answer:
          "The application writes nothing from a check request to a log, stream or file. The hosting platform's own request logs are set in the hosting account.",
        planned: false,
        links: [["Retention test", "retention"]],
      },
      {
        question: "Model",
        answer:
          "A check calls no model and sends no outbound request. Provider settings stay on the server, and production runs without them.",
        planned: false,
        links: [
          ["Retention test", "retention"],
          ["Credential boundary test", "provider"],
        ],
      },
      {
        question: "Browser",
        answer:
          "The site's code sends request data only to its own /api/ routes and keeps only the language choice in browser storage. Following a source or evidence link opens that other site, as any link does.",
        planned: false,
        links: [["Browser boundary test", "browser"]],
      },
      {
        question: "Share link",
        answer:
          "A share link will carry its values in the URL fragment, which the browser does not send to the server; pasted text will not be stored.",
        planned: true,
        links: [["#159", "share"]],
      },
    ],
    outsideLabel: "Outside the code",
    outside:
      "The tests check this repository's source, not a deployed build or the hosting account. Pasted-text extraction will send text to a model provider; that change must update the retention test and this page together.",
    fullDocument: ["Full statement with sources", "document"],
  },
  ko: {
    eyebrow: "데이터 처리",
    heading: "확인 요청이 보내고, 남기고, 기록하는 것.",
    lede: "보안·준법 검토자를 위한 페이지입니다. 설명마다 이를 강제하는 코드나 테스트를 연결했습니다.",
    statementsLabel: "설명과 근거",
    now: "현재",
    planned: "계획",
    statements: [
      {
        question: "붙여넣은 글",
        answer:
          "아직 붙여넣은 글을 받는 경로는 없습니다. 유일한 확인 경로는 정해진 형식의 범위만 받고, 형식이 틀리거나 항목이 더 붙은 요청은 거부합니다.",
        planned: false,
        links: [["확인 경로", "route"]],
      },
      {
        question: "저장",
        answer:
          "확인 요청은 어디에도 저장하지 않습니다. 확인 경로는 데이터베이스, 저장소, 파일 쓰기 모듈을 불러오지 않으며, 배포 환경에는 데이터베이스가 없습니다.",
        planned: false,
        links: [["보관 금지 테스트", "retention"]],
      },
      {
        question: "로그",
        answer:
          "애플리케이션은 확인 요청의 내용을 로그, 출력 스트림, 파일에 쓰지 않습니다. 호스팅 플랫폼의 요청 기록은 호스팅 계정에서 따로 설정합니다.",
        planned: false,
        links: [["보관 금지 테스트", "retention"]],
      },
      {
        question: "모델",
        answer:
          "확인할 때 모델을 호출하거나 외부로 요청을 보내지 않습니다. 공급자 설정은 서버에만 있고, 운영 환경에는 설정하지 않습니다.",
        planned: false,
        links: [
          ["보관 금지 테스트", "retention"],
          ["인증 정보 경계 테스트", "provider"],
        ],
      },
      {
        question: "브라우저",
        answer:
          "사이트 코드는 요청 데이터를 이 사이트의 /api/ 경로로만 보내고, 브라우저 저장 공간에는 언어 선택만 남깁니다. 출처나 근거 링크를 누르면 여느 링크처럼 그 사이트가 열립니다.",
        planned: false,
        links: [["브라우저 경계 테스트", "browser"]],
      },
      {
        question: "공유 링크",
        answer:
          "공유 링크는 값을 URL 조각에 담을 계획입니다. 브라우저는 이 부분을 서버로 보내지 않으며, 붙여넣은 글은 저장하지 않습니다.",
        planned: true,
        links: [["#159", "share"]],
      },
    ],
    outsideLabel: "코드 밖의 범위",
    outside:
      "테스트는 이 저장소의 소스를 확인하며, 배포된 빌드나 호스팅 계정은 확인하지 않습니다. 붙여넣은 글 분석은 글을 모델 공급자에게 보낼 계획이고, 그 변경은 보관 금지 테스트와 이 페이지를 함께 고쳐야 합니다.",
    fullDocument: ["출처를 포함한 전체 문서", "documentKo"],
  },
};

/** `revision` is the commit the page was built from, or a branch name locally. */
export function DataHandlingContent({ revision }: { revision: string }) {
  const text = useCopy(dataHandlingCopy);
  return (
    <main className="shell page-shell methodology data-handling">
      <div className="page-heading">
        <span className="eyebrow">{text.eyebrow}</span>
        <h1>{text.heading}</h1>
        <p>{text.lede}</p>
      </div>
      <section className="panel" aria-labelledby="data-handling-statements">
        <span className="panel-label" id="data-handling-statements">
          {text.statementsLabel}
        </span>
        {text.statements.map((statement) => (
          <div className="responsibility" key={statement.question}>
            <strong>
              {statement.question}{" "}
              <span className={statement.planned ? "pill" : "pill implemented"}>
                {statement.planned ? text.planned : text.now}
              </span>
            </strong>
            <p>{statement.answer}</p>
            <p>
              {statement.links.map(([label, evidence], index) => (
                <React.Fragment key={evidence}>
                  {index > 0 ? " · " : null}
                  <a href={evidenceUrl(evidence, revision)}>{label}</a>
                </React.Fragment>
              ))}
            </p>
          </div>
        ))}
      </section>
      <section className="panel method-grid">
        <span className="panel-label">{text.outsideLabel}</span>
        <p>{text.outside}</p>
        <p>
          <a href={evidenceUrl(text.fullDocument[1], revision)}>
            {text.fullDocument[0]}
          </a>
        </p>
      </section>
    </main>
  );
}
