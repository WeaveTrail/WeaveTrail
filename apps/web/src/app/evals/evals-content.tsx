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
    "공개 시세의 도출과 정규화",
    "커밋된 응답에서 나온 바이트를 재현하고, 불변 해시로 일별 아티팩트를 정규화합니다. 평가 전에 신뢰하지 않는 행위자 사례는 거부합니다. 규칙 벤치마크는 아닙니다.",
  ],
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
    "event 또는 소스 식별자가 충돌한 채 재사용되면 거부합니다.",
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
  ["사례 분류", "합성 사례 세 개를 선언된 규칙 결과에 고정합니다."],
  ["증거 완전성", "각 발견을 eventId에서 rawRowHash까지 연결합니다."],
] as const;

export function EvalsContent({ checks }: { checks: readonly Check[] }) {
  const { language } = useLanguage();
  const ko = language === "ko";
  const heading = ko
    ? [
        "평가 목록",
        "검증한 것만 말합니다.",
        "실행할 수 있는 검증과 계획된 측정을 구분합니다.",
        "규칙 결과는 합성 사례로 검증합니다. 공개 일별 시세의 출처는 워킹 모드에 표시합니다.",
      ]
    : [
        "Evaluation ledger",
        "Measured evidence only.",
        "This page distinguishes runnable invariants from future measurements. Targets do not become results until their cases, command, environment, and limitations are committed.",
        "Rule outcome benchmarks use synthetic cases. The published daily quote artifact is separate normalization and refusal evidence, with provenance shown in working mode.",
      ];
  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">{heading[0]}</span>
        <h1>{heading[1]}</h1>
        <p>{heading[2]}</p>
        <p>{heading[3]}</p>
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
