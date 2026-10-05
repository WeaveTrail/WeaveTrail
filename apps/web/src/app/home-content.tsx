"use client";

import Link from "next/link";
import React from "react";

import { useCopy, type Language } from "./i18n/language";

interface Position {
  readonly name: string;
  readonly text: string;
  readonly here?: true;
}

interface Role {
  readonly step: string;
  readonly title: string;
  readonly text: string;
}

interface HomeCopy {
  readonly headingLead: string;
  readonly headingEmphasis: string;
  readonly heroCopy: string;
  readonly walkThrough: string;
  readonly whereItFits: string;
  readonly positionKicker: string;
  readonly positionHeading: string;
  readonly positionLabel: string;
  readonly positions: readonly Position[];
  readonly positionNote: string;
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

/**
 * Voice copy — the headline, the section headings and the calls to action —
 * is written in each language rather than translated from the other. The
 * explanatory prose beneath it says the same things in both, with the same
 * scope and the same hedging.
 */
export const homeCopy: Readonly<Record<Language, HomeCopy>> = {
  en: {
    headingLead: "AI raised the alert. ",
    headingEmphasis: "Verify it before you sign.",
    heroCopy:
      "Market surveillance and AI analysis raise an unusual-trading candidate. A person confirms the scope, versioned code re-verifies it, and each finding opens onto its source rows.",
    walkThrough: "Walk through a case",
    whereItFits: "Where it fits",
    positionKicker: "Where it fits",
    positionHeading: "After the alert. Before the judgement.",
    positionLabel: "Where WeaveTrail sits in an investigation",
    positions: [
      {
        name: "Surveillance and AI analysis",
        text: "A system already in place watches the market and raises a candidate.",
      },
      {
        name: "WeaveTrail",
        text: "Confirm the scope the alert assumed, re-verify it with versioned code, and read the evidence underneath.",
        here: true,
      },
      {
        name: "The investigator decides",
        text: "A person reads the result and the rows under it, and answers for the judgement.",
      },
    ],
    positionNote:
      "It does not detect or replace surveillance. It verifies the alert before a person decides the case.",
    boundaryKicker: "Trust boundary",
    boundaryHeading: "AI proposes. Versioned code decides.",
    roles: [
      {
        step: "01",
        title: "Interpret",
        text: "A constrained mapper proposes what each source column means. It computes nothing.",
      },
      {
        step: "02",
        title: "Approve",
        text: "A person approves that exact proposal. Unapproved model output never enters replay.",
      },
      {
        step: "03",
        title: "Replay",
        text: "Versioned code orders, deduplicates, calculates and hashes the same input the same way.",
      },
      {
        step: "04",
        title: "Trace",
        text: "Open a finding to reach its canonical events, its original source rows and their row hashes.",
      },
    ],
    applicationKicker: "Bounded application",
    question:
      "Does a short-window price lift satisfy a declared concentrated-buy pattern?",
    resultLabel: "Closed result vocabulary",
    reviewState: "REVIEW_REQUIRED · pre-replay",
    disclaimer:
      "The displayed results are technical hypothesis states—not a finding of guilt, a causal claim, investment advice, an automated trading decision, or real-time surveillance.",
    gateLinkText: "Where it fits",
    disclaimerTail:
      " sets out the reasoning behind the question and the boundaries of what it answers.",
  },
  ko: {
    headingLead: "AI를 믿지 않아도 ",
    headingEmphasis: "사용할 수 있는 금융 AI.",
    heroCopy:
      "시장감시와 AI 분석이 이상거래 후보를 올립니다. 그다음 사람이 범위를 확인하고, 버전이 고정된 코드가 다시 검증합니다. 발견은 원본 행까지 확인할 수 있습니다.",
    walkThrough: "사례 따라가기",
    whereItFits: "어디에 쓰이나",
    positionKicker: "쓰이는 자리",
    positionHeading: "알림이 나온 뒤, 판단이 내려지기 전.",
    positionLabel: "조사 과정에서 WeaveTrail이 놓이는 자리",
    positions: [
      {
        name: "감시와 AI 분석",
        text: "이미 돌아가고 있는 시스템이 시장을 지켜보다가 후보를 올립니다.",
      },
      {
        name: "WeaveTrail",
        text: "알림이 전제한 범위를 확인하고, 버전이 고정된 코드로 다시 검증하고, 그 아래 증거를 읽습니다.",
        here: true,
      },
      {
        name: "조사자의 판단",
        text: "사람이 결과와 그 아래 행을 읽고, 판단에 자기 이름을 겁니다.",
      },
    ],
    positionNote:
      "탐지 기능을 대체하지 않습니다. 알림이 나온 뒤부터 사람이 판단하기 전까지의 검증 단계입니다.",
    boundaryKicker: "신뢰 경계",
    boundaryHeading: "AI는 제안하고, 판정은 코드가 합니다.",
    roles: [
      {
        step: "01",
        title: "해석",
        text: "제약된 매퍼가 소스의 각 열이 무엇을 뜻하는지 제안합니다. 계산은 하지 않습니다.",
      },
      {
        step: "02",
        title: "승인",
        text: "사람이 그 제안을 그대로 승인합니다. 승인받지 않은 모델 출력은 리플레이에 들어가지 못합니다.",
      },
      {
        step: "03",
        title: "리플레이",
        text: "버전이 고정된 코드가 같은 입력을 같은 방식으로 정렬하고, 중복을 걸러내고, 계산하고, 해시합니다.",
      },
      {
        step: "04",
        title: "추적",
        text: "발견을 열면 정본 이벤트와 원본 소스 행, 그 행의 해시까지 그대로 따라갑니다.",
      },
    ],
    applicationKicker: "적용 범위",
    question: "짧은 구간의 가격 상승이 선언된 매수 집중 패턴을 충족하는가?",
    resultLabel: "닫힌 결과 어휘",
    reviewState: "REVIEW_REQUIRED · 리플레이 이전",
    disclaimer:
      "여기 표시되는 결과는 기술적인 가설 상태입니다. 유죄 판단도, 인과 주장도, 투자 조언도, 자동 매매 결정도, 실시간 감시도 아닙니다.",
    gateLinkText: "어디에 쓰이나",
    disclaimerTail:
      "에서 이 질문을 세운 근거와 답할 수 있는 범위를 설명합니다.",
  },
};

export function HomeContent() {
  const text = useCopy(homeCopy);

  return (
    <main>
      <section className="hero shell">
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
            {text.whereItFits}
          </Link>
        </div>
      </section>

      <section className="shell system-section">
        <div className="section-heading">
          <span>{text.positionKicker}</span>
          <h2>{text.positionHeading}</h2>
        </div>
        <ol className="position-chain" aria-label={text.positionLabel}>
          {text.positions.map((position) => (
            <li
              className={position.here ? "position-here" : undefined}
              key={position.name}
            >
              <strong>{position.name}</strong>
              <p>{position.text}</p>
            </li>
          ))}
        </ol>
        <p className="position-note">{text.positionNote}</p>
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
