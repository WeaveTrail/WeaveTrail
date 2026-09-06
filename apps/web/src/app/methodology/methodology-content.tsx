"use client";

import React from "react";

import { useCopy, type Language } from "../i18n/language";

type MethodologyCopy = {
  eyebrow: string;
  heading: string;
  lede: string;
  quotesLabel: string;
  quotes: readonly string[];
  resultsLabel: string;
  states: readonly (readonly [string, string])[];
  responsibilityLabel: string;
  responsibilities: readonly (readonly [string, string])[];
};

export const methodologyCopy: Readonly<Record<Language, MethodologyCopy>> = {
  en: {
    eyebrow: "Methodology & boundaries",
    heading: "A narrow question with explicit abstention.",
    lede: "The implemented synthetic reference cases evaluate a versioned technical pattern. They do not produce legal or causal conclusions.",
    quotesLabel: "Published daily quotations",
    quotes: [
      "Working mode also normalizes a published daily quotation source after explicit mapping review. The source panel records its provider, trading date, licence and attribution.",
      "Daily quotes have no participant identities, execution side or individual execution time. Mapping approval can produce a normalization hash; case approval is unavailable and no pattern verdict is produced. A date anchor and aggregate volume do not establish individual executions.",
    ],
    resultsLabel: "Closed result vocabulary",
    states: [
      [
        "SUPPORTED",
        "Validated data satisfies every required threshold in the approved rule version.",
      ],
      [
        "NOT_SUPPORTED",
        "Data is sufficient, but one or more required thresholds are not satisfied.",
      ],
      [
        "INCONCLUSIVE",
        "Approved inputs entered replay, but valid evidence was insufficient for the declared comparison.",
      ],
      [
        "REVIEW_REQUIRED",
        "A pre-replay mapping, identity, scope, or approval problem requires human review; this is not a replay result.",
      ],
    ],
    responsibilityLabel: "Responsibility split",
    responsibilities: [
      [
        "AI may",
        "Propose column meanings, bounded case scope, and human-readable explanations.",
      ],
      [
        "Code must",
        "Validate, order, deduplicate, calculate, evaluate, hash, and preserve traceability.",
      ],
      [
        "Neither may",
        "Determine guilt, invent missing critical facts, recommend trades, or execute orders.",
      ],
    ],
  },
  ko: {
    eyebrow: "방법론과 경계",
    heading: "답할 범위와 답하지 않을 범위를 분명히 합니다.",
    lede: "합성 기준 사례로 버전이 붙은 패턴을 평가합니다. 법적·인과적 결론은 내리지 않습니다.",
    quotesLabel: "공개 일별 시세",
    quotes: [
      "워킹 모드에서는 검토한 공개 일별 시세도 정규화합니다. 소스 패널에 제공자, 거래일, 라이선스, 출처를 기록합니다.",
      "일별 시세에는 참여자, 체결 방향, 개별 시각이 없습니다. 정규화 해시는 만들 수 있지만 패턴은 평가하지 않습니다.",
    ],
    resultsLabel: "결과 표현 방식",
    states: [
      ["SUPPORTED", "검증된 데이터가 승인된 규칙의 모든 임계값을 충족합니다."],
      [
        "NOT_SUPPORTED",
        "데이터는 충분하지만 임계값 하나 이상을 충족하지 못합니다.",
      ],
      ["INCONCLUSIVE", "선언된 비교에 필요한 증거가 부족합니다."],
      [
        "REVIEW_REQUIRED",
        "리플레이 전에 사람이 검토할 문제가 있습니다. 결과가 아닙니다.",
      ],
    ],
    responsibilityLabel: "책임의 구분",
    responsibilities: [
      [
        "AI가 할 수 있는 일",
        "열의 의미, 한정된 사례 범위, 사람이 읽을 설명을 제안합니다.",
      ],
      [
        "코드가 해야 하는 일",
        "검증, 정렬, 중복 제거, 계산, 평가, 해시, 추적 가능성 보존을 맡습니다.",
      ],
      [
        "둘 다 할 수 없는 일",
        "유죄를 판단하거나, 빠진 핵심 사실을 만들어내거나, 거래를 권하거나, 주문을 실행하지 않습니다.",
      ],
    ],
  },
};

export function MethodologyContent() {
  const text = useCopy(methodologyCopy);
  return (
    <main className="shell page-shell methodology">
      <div className="page-heading">
        <span className="eyebrow">{text.eyebrow}</span>
        <h1>{text.heading}</h1>
        <p>{text.lede}</p>
      </div>
      <section className="panel">
        <span className="panel-label">{text.quotesLabel}</span>
        {text.quotes.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>
      <section className="method-grid">
        <article className="panel">
          <span className="panel-label">{text.resultsLabel}</span>
          {text.states.map(([state, meaning]) => (
            <div className="state-row" key={state}>
              <strong>{state}</strong>
              <p>{meaning}</p>
            </div>
          ))}
        </article>
        <article className="panel">
          <span className="panel-label">{text.responsibilityLabel}</span>
          {text.responsibilities.map(([title, detail]) => (
            <div className="responsibility" key={title}>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
          ))}
        </article>
      </section>
    </main>
  );
}
