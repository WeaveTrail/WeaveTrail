"use client";

import React from "react";

import { useLanguage } from "../i18n/language";

type Check = {
  name: string;
  status: "Implemented" | "Planned";
  detail: string;
};

const koreanChecks = [
  [
    "행 순서 불변성",
    "같은 이벤트의 순서를 섞어도 정본 해시는 하나여야 합니다.",
  ],
  ["리터럴 골든 해시", "커밋된 fixture를 정해진 정본 결과 해시에 고정합니다."],
  [
    "완전히 같은 중복 행 허용",
    "동일한 소스 행을 넣어도 정본 이벤트는 바뀌지 않아야 합니다.",
  ],
  [
    "식별자 충돌 거부",
    "event 또는 소스 식별자가 충돌한 채 재사용되면 거부합니다. 커밋된 FIX 충돌 사례는 결과 해시 없이 INPUT_REVIEW_REQUIRED에서 멈춥니다.",
  ],
  ["시각 형식 동등성", "동등한 offset과 Z 시각을 같은 순간으로 정규화합니다."],
  [
    "밀리초 미만 순서",
    "지원하는 정밀도는 보존하고 그보다 세밀한 시각은 거부합니다.",
  ],
  [
    "로캘과 무관한 순서",
    "로캘 데이터 없이 UTF-16 코드 단위로 정본 키를 정렬합니다.",
  ],
  ["변동 메타데이터 제외", "수집 메타데이터는 정본 결과 해시에서 제외합니다."],
  [
    "혼합 sequence 정책",
    "sequence 유무가 섞이면 실패로 처리하고, 모두 없을 때의 순서를 정합니다.",
  ],
  ["방언 수렴", "동등한 커밋 소스 방언은 하나의 정본 결과로 리플레이합니다."],
  [
    "데이터셋 프로파일 결정성",
    "행 순서와 소스 방언이 바뀌어도 데이터셋 프로파일을 일정하게 유지합니다.",
  ],
  ["매핑 승인 결속", "승인을 검증된 제안과 실제 적용된 변환에 묶습니다."],
  [
    "레코드 집합 완전성",
    "결과 해시 전에 선언된 행이나 승인된 열이 빠졌으면 거부합니다.",
  ],
  [
    "매핑 일치 보고",
    "매핑된 정본 이벤트와 각 매핑 적용의 검토 결과가 필드별로 일치하는지 보고합니다.",
  ],
  [
    "도달 가능한 매핑 검토",
    "표시된 필드는 사유가 있는 override를 요구하되, 끝까지 처리할 수 있는 경로는 남깁니다.",
  ],
  [
    "사례 분류",
    "공개 스키마 기반 합성 사례로 SUPPORTED, NOT_SUPPORTED, INCONCLUSIVE에 도달합니다. FIX 참여자 분산 사례는 비교 가능한 체결 여섯 건으로 ACTOR_CONCENTRATION과 REMOVAL_SENSITIVITY를 통과하지 못하고 나머지 세 기준은 통과합니다.",
  ],
  [
    "증거 완전성",
    "기준 사례의 각 발견 참조를 eventId와 rawRowHash를 거쳐 해시를 검증한 커밋 원본 행까지 연결합니다.",
  ],
  [
    "버전별 픽스처 평가",
    "커밋된 연결, 검토, 변형, 시나리오와 추적 건수를 재현하고 실행 환경을 별도로 기록합니다. 직접 작성한 사례로 정확도를 추정하지 않습니다.",
  ],
  [
    "독립 자료의 제공자 정확도",
    "별도로 선언한 측정 방식 아래 독립된 연결 자료로 설정된 제공자를 평가할 계획입니다.",
  ],
] as const;

export function EvalsContent({ checks }: { checks: readonly Check[] }) {
  const { language } = useLanguage();
  const ko = language === "ko";
  const heading = ko
    ? [
        "평가 목록",
        "검증한 것만 말합니다.",
        "실행할 수 있는 검증과 계획된 측정을 구분합니다.",
        "현재 평가는 합성 사례만 사용합니다. 이전 공개자료 평가는 출처가 철회된 과거 캡처입니다.",
      ]
    : [
        "Evaluation ledger",
        "Measured evidence only.",
        "This page distinguishes runnable invariants from future measurements. Targets do not become results until their cases, command, environment, and limitations are committed.",
        "The current evaluation uses synthetic cases only. Earlier published-data evaluations are historical captures with withdrawn sources.",
      ];
  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">{heading[0]}</span>
        <h1>{heading[1]}</h1>
        <p>{heading[2]}</p>
        <p>{heading[3]}</p>
        <p>
          <a
            href={`https://github.com/WeaveTrail/WeaveTrail/blob/develop/docs/EVALUATION${ko ? ".ko" : ""}.md`}
          >
            {ko
              ? "평가 정의, 재현 명령, 실행 환경과 원시 결과"
              : "Evaluation cases, reproduction command, environment and raw results"}
          </a>
        </p>
      </div>
      <section className="eval-list">
        {checks.map((check, index) => {
          const localized = koreanChecks[index];
          return (
            <article className="eval-row" key={check.name}>
              <span
                className={
                  check.status === "Implemented" ? "pill implemented" : "pill"
                }
              >
                {ko
                  ? check.status === "Implemented"
                    ? "구현됨"
                    : "계획"
                  : check.status}
              </span>
              <h2>{ko ? localized?.[0] : check.name}</h2>
              <p>{ko ? localized?.[1] : check.detail}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
