"use client";

import React from "react";

import { useCopy, type Language } from "../i18n/language";

const REPOSITORY = "https://github.com/WeaveTrail/WeaveTrail";

/** The files each statement points to, resolved at the served revision. */
const evidencePaths = {
  route: "apps/web/src/app/api/replay/route.ts",
  retention: "apps/web/src/app/api/check/pasted-text-retention.test.ts",
  browser: "apps/web/src/app/browser-data-boundary.test.ts",
  provider: "apps/web/src/app/provider-client-boundary.test.ts",
  budget: "apps/web/src/lib/public-model-budget.test.ts",
  document: "docs/DATA_HANDLING.md",
  documentKo: "docs/DATA_HANDLING.ko.md",
} as const;

type Evidence = keyof typeof evidencePaths;

export function evidenceUrl(evidence: Evidence, revision: string): string {
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
          "No route checks pasted text. Case Replay accepts only registered synthetic source rows and explicit approvals.",
        planned: false,
        links: [["Check route", "route"]],
      },
      {
        question: "Reviewer text",
        answer:
          "Case Replay approvals send a reviewer reference and reasons a person types. They are validated only, never returned, stored, logged or sent to a model. Type nothing personal or confidential there.",
        planned: false,
        links: [["Retention test", "retention"]],
      },
      {
        question: "Storage",
        answer:
          "Replay approvals are not stored. Configured public model requests use shared daily counters: a daily HMAC visitor key, request count and global reserved-call count, expiring at 00:00 KST. Raw IPs are never stored or logged by the application.",
        planned: false,
        links: [
          ["Retention test", "retention"],
          ["Daily budget test", "budget"],
        ],
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
          "Fixture-mode replay approvals call no model. Configured mapping uses eligible synthetic sources; settings stay on the server and production uses fixture mode.",
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
    ],
    outsideLabel: "Outside the code",
    outside:
      "The tests check this repository's source, not a deployed build or the hosting account. No route plans to take pasted text or share links. In configured mode, the mapping route already sends an eligible synthetic source's columns and sample rows to a model provider. Enabling that call in production is planned and must update the retention test and this page together.",
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
          "붙여넣은 글을 확인하는 경로는 없습니다. 사례 재현은 등록된 합성 원본 행과 명시적인 승인만 받습니다.",
        planned: false,
        links: [["확인 경로", "route"]],
      },
      {
        question: "검토자 입력",
        answer:
          "사례 따라가기의 승인은 사람이 입력한 검토자 참조와 확인 이유를 보냅니다. 검증에만 쓰며, 응답으로 돌려주거나 저장·기록하거나 모델에 보내지 않습니다. 개인 정보나 기밀은 적지 마십시오.",
        planned: false,
        links: [["보관 금지 테스트", "retention"]],
      },
      {
        question: "저장",
        answer:
          "재현 승인은 저장하지 않습니다. 공개 실제 모델 요청을 설정하면 일일 HMAC 방문자 키, 요청 횟수와 전체 예약 호출 횟수를 공유 저장소에 남기고 00:00 KST에 만료시킵니다. 앱은 원시 IP를 저장하거나 로그에 남기지 않습니다.",
        planned: false,
        links: [
          ["보관 금지 테스트", "retention"],
          ["일일 예산 테스트", "budget"],
        ],
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
          "픽스처 모드 재현 승인은 모델을 호출하지 않습니다. 설정된 항목 연결은 허용된 합성 소스를 쓰며 공급자 설정은 서버에만 남고 운영은 픽스처 모드를 사용합니다.",
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
    ],
    outsideLabel: "코드 밖의 범위",
    outside:
      "테스트는 이 저장소의 소스를 확인하며, 배포된 빌드나 호스팅 계정은 확인하지 않습니다. 붙여넣은 글이나 공유 링크를 받을 경로는 계획에 없습니다. 설정된 모드에서는 항목 연결 경로가 이미 허용된 합성 원본의 열과 표본 행을 모델 공급자에게 보냅니다. 운영 배포에서 이 호출을 켜는 일은 계획이며, 그 변경은 보관 금지 테스트와 이 페이지를 함께 고쳐야 합니다.",
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
