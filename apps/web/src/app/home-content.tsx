"use client";

import Link from "next/link";
import React from "react";

import { useCopy, type Language } from "./i18n/language";

interface Role {
  readonly step: string;
  readonly title: string;
  readonly text: string;
}

interface HomeCopy {
  readonly eyebrow: string;
  readonly headingLead: string;
  readonly headingEmphasis: string;
  readonly heroCopy: string;
  readonly walkThrough: string;
  readonly whyTheGate: string;
  readonly statusLabel: string;
  readonly statusStrong: string;
  readonly statusPlanned: string;
  readonly boundaryKicker: string;
  readonly boundaryHeading: string;
  readonly roles: readonly Role[];
  readonly applicationKicker: string;
  readonly question: string;
  readonly resultLabel: string;
  readonly reviewState: string;
  readonly disclaimer: string;
  readonly gateLinkText: string;
  readonly disclaimerTail: string;
}

const copy: Readonly<Record<Language, HomeCopy>> = {
  en: {
    eyebrow: "AI-assisted · deterministic by design",
    headingLead: "Turn uncertain signals into ",
    headingEmphasis: "replayable evidence.",
    heroCopy:
      "AI surveillance finds the candidate. WeaveTrail adds the gate between that result and the judgement a person signs: a confirmed scope, a re-verification by versioned code, and every source row it rests on.",
    walkThrough: "Walk through a case",
    whyTheGate: "Why the gate sits here",
    statusLabel: "Current implementation status",
    statusStrong: "Synthetic cases and published quotes · fixture provider",
    statusPlanned:
      "Live AI proposals and independent bundle export are planned.",
    boundaryKicker: "Trust boundary",
    boundaryHeading: "AI proposes. Versioned code decides.",
    roles: [
      {
        step: "01",
        title: "Interpret",
        text: "Constrained mapping proposals turn heterogeneous columns into a reviewable event contract.",
      },
      {
        step: "02",
        title: "Approve",
        text: "Ambiguity stops at a human gate. Unapproved model output never enters replay.",
      },
      {
        step: "03",
        title: "Replay",
        text: "Versioned code orders, deduplicates, calculates, and hashes the same input the same way.",
      },
      {
        step: "04",
        title: "Trace",
        text: "Open a finding to inspect its canonical events, original source rows and row hashes.",
      },
    ],
    applicationKicker: "Bounded application",
    question:
      "Does a short-window price lift satisfy a declared concentrated-buy pattern?",
    resultLabel: "Closed result vocabulary",
    reviewState: "REVIEW_REQUIRED · pre-replay",
    disclaimer:
      "The displayed results are technical hypothesis states—not a finding of guilt, a causal claim, investment advice, an automated trading decision, or real-time surveillance.",
    gateLinkText: "Where the gate sits",
    disclaimerTail:
      " gives the reasoning behind the question and the boundaries of what it answers.",
  },
  ko: {
    eyebrow: "AI 보조 · 설계부터 결정론적",
    headingLead: "불확실한 신호를 ",
    headingEmphasis: "다시 돌려볼 수 있는 증거로.",
    heroCopy:
      "AI 감시는 후보를 찾아냅니다. WeaveTrail은 그 결과와 사람이 서명할 판단 사이에 게이트를 놓습니다. 확인된 범위, 버전이 찍힌 코드의 재검증, 그리고 그 판단이 딛고 선 원본 행 전부입니다.",
    walkThrough: "사례 따라가기",
    whyTheGate: "게이트가 왜 여기 있는가",
    statusLabel: "현재 구현 상태",
    statusStrong: "합성 사례와 공표 시세 · fixture provider",
    statusPlanned: "실시간 AI 제안과 독립 번들 내보내기는 아직 계획입니다.",
    boundaryKicker: "신뢰 경계",
    boundaryHeading: "AI는 제안하고, 버전이 찍힌 코드가 판정합니다.",
    roles: [
      {
        step: "01",
        title: "해석",
        text: "제약된 매핑 제안이 제각각인 열을 검토할 수 있는 이벤트 계약으로 바꿉니다.",
      },
      {
        step: "02",
        title: "승인",
        text: "모호한 것은 사람이 지키는 게이트에서 멈춥니다. 승인되지 않은 모델 출력은 리플레이에 들어가지 못합니다.",
      },
      {
        step: "03",
        title: "리플레이",
        text: "버전이 찍힌 코드가 같은 입력을 같은 순서로 정렬하고, 중복을 걸러내고, 계산하고, 해시합니다.",
      },
      {
        step: "04",
        title: "추적",
        text: "발견을 열면 그것이 딛고 선 정본 이벤트와 원본 소스 행, 행 해시를 그대로 봅니다.",
      },
    ],
    applicationKicker: "적용 범위 한정",
    question: "짧은 구간의 가격 상승이 선언된 매수 집중 패턴을 충족하는가?",
    resultLabel: "닫힌 결과 어휘",
    reviewState: "REVIEW_REQUIRED · 리플레이 이전",
    disclaimer:
      "여기 표시되는 결과는 기술적인 가설 상태입니다. 유죄 판단도, 인과 주장도, 투자 조언도, 자동 매매 결정도, 실시간 감시도 아닙니다.",
    gateLinkText: "게이트가 놓인 자리",
    disclaimerTail: "에서 이 질문의 근거와 답할 수 있는 범위를 설명합니다.",
  },
};

export function HomeContent() {
  const text = useCopy(copy);

  return (
    <main>
      <section className="hero shell">
        <div className="eyebrow">{text.eyebrow}</div>
        <h1>
          {text.headingLead}
          <em>{text.headingEmphasis}</em>
        </h1>
        <p className="hero-copy">{text.heroCopy}</p>
        <div className="hero-actions">
          <Link className="button primary" href="/replay?mode=guided">
            {text.walkThrough}
          </Link>
          <Link className="button secondary" href="/why">
            {text.whyTheGate}
          </Link>
        </div>
        <div className="status-strip" aria-label={text.statusLabel}>
          <span className="status-dot" />
          <strong>{text.statusStrong}</strong>
          <span>{text.statusPlanned}</span>
        </div>
      </section>

      <section className="shell system-section">
        <div className="section-heading">
          <span>{text.boundaryKicker}</span>
          <h2>{text.boundaryHeading}</h2>
        </div>
        <div className="role-grid">
          {text.roles.map((role) => (
            <article className="role-card" key={role.step}>
              <span className="role-step">{role.step}</span>
              <h3>{role.title}</h3>
              <p>{role.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell question-panel">
        <div>
          <span className="kicker">{text.applicationKicker}</span>
          <h2>{text.question}</h2>
        </div>
        <div className="result-stack" aria-label={text.resultLabel}>
          <span>SUPPORTED</span>
          <span>NOT_SUPPORTED</span>
          <span>INCONCLUSIVE</span>
          <span className="review-state">{text.reviewState}</span>
        </div>
        <p>
          {text.disclaimer} <Link href="/why">{text.gateLinkText}</Link>
          {text.disclaimerTail}
        </p>
      </section>
    </main>
  );
}
