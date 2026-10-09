"use client";

import Link from "next/link";
import React from "react";

import {
  definitionLinks,
  fraction,
  percent,
} from "./evals/model-comparison-data";
import type { HomeSelection } from "./home-selection";
import { useCopy, useLanguage, type Language } from "./i18n/language";

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

export const HOME_TERM_KEYS = [
  "mapping",
  "heldOut",
  "rule",
  "primary",
  "escalation",
  "validator",
  "versionedCode",
  "reviewRequired",
] as const;
export type HomeTermKey = (typeof HOME_TERM_KEYS)[number];

/**
 * The first screen: the question, a one-sentence answer and the control line.
 * `[[key|label]]` marks a term whose plain explanation opens from it; the key
 * names an entry of `terms`.
 */
interface AnswerCopy {
  readonly eyebrow: string;
  readonly question: string;
  readonly planned: Readonly<
    Record<"notRun" | "noOutput" | "noneQualified", string>
  >;
  readonly selected: (primary: string, escalation: string) => string;
  readonly primaryOnly: (primary: string) => string;
  readonly factsLabel: string;
  readonly primaryAccuracy: string;
  readonly validOutput: string;
  readonly runDate: (date: string) => string;
  readonly control: string;
  readonly seeComparison: string;
  readonly walkThrough: string;
  readonly close: string;
  readonly terms: Readonly<Record<HomeTermKey, readonly [string, string]>>;
}

const ANSWER_EN: AnswerCopy = {
  eyebrow: "The AI here",
  question:
    "Which AI model proposes the [[mapping|column mappings]] here, and why that one?",
  planned: {
    notRun:
      "No model is chosen yet: the comparison on the [[heldOut|held-out set]] is planned, and none is chosen until a candidate passes the [[rule|rule fixed before the run]].",
    noOutput:
      "No model is chosen yet: the first run on the [[heldOut|held-out set]] returned no model output, so the comparison is planned again and none is chosen until a candidate passes the [[rule|rule fixed before the run]].",
    noneQualified:
      "No model is chosen: on the [[heldOut|held-out set]], no candidate passed the [[rule|rule fixed before the run]].",
  },
  selected: (primary, escalation) =>
    `${primary} is the [[primary|primary model]] and ${escalation} the [[escalation|escalation model]], chosen by the [[rule|rule fixed before the run]] from their results on the [[heldOut|held-out set]].`,
  primaryOnly: (primary) =>
    `${primary} is the [[primary|primary model]], chosen by the [[rule|rule fixed before the run]] from its results on the [[heldOut|held-out set]]; no other candidate qualifies as the [[escalation|escalation model]].`,
  factsLabel: "The primary model's held-out results",
  primaryAccuracy: "Exactly right on clear, abbreviated and synonym columns",
  validOutput: "Answers the validator could read",
  runDate: (date) => `Run on ${date}`,
  control:
    "What stops wrong output: a [[validator|validator]] checks every proposal against a fixed contract, a person approves it before [[versionedCode|versioned code]] computes anything, and a rejected or unclear proposal stops at [[reviewRequired|REVIEW_REQUIRED]].",
  seeComparison: "See the model comparison",
  walkThrough: "Walk through a case",
  close: "Close",
  terms: {
    mapping: [
      "Column mapping",
      "Saying which field each column of an unfamiliar data file holds, such as price or quantity, and how to convert its values.",
    ],
    heldOut: [
      "Held-out set",
      "Synthetic column layouts kept sealed until the run, so no prompt or rule was tuned on them.",
    ],
    rule: [
      "Rule fixed before the run",
      "The pass marks for valid answers, wrong mappings and needless hand-offs, and how the primary and escalation models are picked. It was committed before any candidate saw the held-out set.",
    ],
    primary: [
      "Primary model",
      "The model chosen to propose column mappings first.",
    ],
    escalation: [
      "Escalation model",
      "The second model chosen for the proposals the primary model leaves for review. Routing to it is planned, not yet running.",
    ],
    validator: [
      "Validator",
      "Code, not a model, that checks a proposal's fields and conversions against the versioned contract. A proposal it rejects goes no further.",
    ],
    versionedCode: [
      "Versioned code",
      "The replay engine at a fixed version: the same approved input always gives the same result and the same hash.",
    ],
    reviewRequired: [
      "REVIEW_REQUIRED",
      "Where a rejected or unclear proposal stops. A person has to look at it; nothing is decided for them.",
    ],
  },
};

const ANSWER_KO: AnswerCopy = {
  eyebrow: "이 사이트의 AI",
  question:
    "여기서 [[mapping|데이터 항목 연결]]을 제안하는 AI 모델은 무엇이고, 왜 그 모델인가요?",
  planned: {
    notRun:
      "아직 고른 모델이 없습니다. [[heldOut|보관 평가 집합]]에서 비교할 계획이며, [[rule|실행 전에 정한 규칙]]을 통과한 후보가 나올 때까지 모델을 고르지 않습니다.",
    noOutput:
      "아직 고른 모델이 없습니다. [[heldOut|보관 평가 집합]]의 첫 실행에서 모델 출력을 하나도 받지 못해 비교를 다시 계획했고, [[rule|실행 전에 정한 규칙]]을 통과한 후보가 나올 때까지 모델을 고르지 않습니다.",
    noneQualified:
      "고른 모델이 없습니다. [[heldOut|보관 평가 집합]]에서 [[rule|실행 전에 정한 규칙]]을 통과한 후보가 없었습니다.",
  },
  selected: (primary, escalation) =>
    `[[rule|실행 전에 정한 규칙]]에 따라 [[heldOut|보관 평가 집합]] 결과로 고른 [[primary|기본 모델]]은 ${primary}, [[escalation|상위 모델]]은 ${escalation}입니다.`,
  primaryOnly: (primary) =>
    `[[rule|실행 전에 정한 규칙]]에 따라 [[heldOut|보관 평가 집합]] 결과로 고른 [[primary|기본 모델]]은 ${primary}이며, [[escalation|상위 모델]] 자격을 갖춘 다른 후보는 없습니다.`,
  factsLabel: "기본 모델의 보관 평가 집합 결과",
  primaryAccuracy: "분명한 이름·줄인 이름·동의어 열을 정확히 연결한 비율",
  validOutput: "검증기가 읽을 수 있는 답의 비율",
  runDate: (date) => `${date} 실행`,
  control:
    "잘못된 출력을 막는 장치: [[validator|검증기]]가 모든 제안을 정해진 계약으로 검사하고, 사람이 승인한 뒤에야 [[versionedCode|버전이 고정된 코드]]가 계산하며, 거절되거나 모호한 제안은 [[reviewRequired|REVIEW_REQUIRED]]에서 멈춥니다.",
  seeComparison: "모델 비교 보기",
  walkThrough: "사례 따라가기",
  close: "닫기",
  terms: {
    mapping: [
      "데이터 항목 연결",
      "처음 보는 데이터 파일의 각 열이 가격, 수량 같은 어느 항목인지, 값을 어떻게 바꿔 읽는지 정하는 일입니다.",
    ],
    heldOut: [
      "보관 평가 집합",
      "실행 전까지 봉인해 둔 합성 열 구성입니다. 프롬프트나 규칙을 이 집합에 맞춰 고치지 않았습니다.",
    ],
    rule: [
      "실행 전에 정한 규칙",
      "유효한 답, 잘못된 연결, 불필요하게 넘긴 항목의 통과 기준과 기본 모델·상위 모델을 고르는 방법입니다. 어떤 후보도 보관 평가 집합을 보기 전에 커밋했습니다.",
    ],
    primary: [
      "기본 모델",
      "데이터 항목 연결을 먼저 제안하도록 고른 모델입니다.",
    ],
    escalation: [
      "상위 모델",
      "기본 모델이 검토 필요로 남긴 제안을 맡도록 고른 두 번째 모델입니다. 이 모델로 넘기는 경로는 계획 단계이며 아직 동작하지 않습니다.",
    ],
    validator: [
      "검증기",
      "모델이 아닌 코드입니다. 제안의 항목과 변환을 버전이 고정된 계약으로 검사하고, 거절한 제안은 더 나아가지 못합니다.",
    ],
    versionedCode: [
      "버전이 고정된 코드",
      "버전이 고정된 분석 엔진입니다. 같은 승인 입력은 언제나 같은 결과와 같은 해시를 냅니다.",
    ],
    reviewRequired: [
      "REVIEW_REQUIRED",
      "거절되거나 모호한 제안이 멈추는 상태입니다. 사람이 직접 확인해야 하며, 대신 결정되는 것은 없습니다.",
    ],
  },
};

interface HomeCopy {
  readonly answer: AnswerCopy;
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
    answer: ANSWER_EN,
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
    answer: ANSWER_KO,
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

const TERM_MARK = /\[\[(\w+)\|([^\]]+)\]\]/g;

/** The plain text of a marked sentence, as a reader sees it. */
export function plainText(marked: string): string {
  return marked.replace(TERM_MARK, "$2");
}

const termId = (key: HomeTermKey) => `home-term-${key}`;

/**
 * Splits a marked sentence into text and term buttons. Each button opens its
 * explanation as a native popover, so Enter, Space and a tap all open it and
 * Escape or a tap outside closes it.
 */
function withTerms(marked: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of marked.matchAll(TERM_MARK)) {
    const [whole, key, label] = match;
    if (match.index > last) parts.push(marked.slice(last, match.index));
    parts.push(
      <button
        className="home-term"
        key={`${key}-${match.index}`}
        popoverTarget={termId(key as HomeTermKey)}
        type="button"
      >
        {label}
      </button>,
    );
    last = match.index + whole.length;
  }
  if (last < marked.length) parts.push(marked.slice(last));
  return parts;
}

export function HomeContent({ selection }: { selection: HomeSelection }) {
  const text = useCopy(homeCopy);
  const { language } = useLanguage();
  const answer = text.answer;
  const links = definitionLinks(language);
  const sentence =
    selection.state === "planned"
      ? answer.planned[selection.reason]
      : selection.escalation === null
        ? answer.primaryOnly(selection.primary)
        : answer.selected(selection.primary, selection.escalation);

  return (
    <main>
      <section
        className="hero home-answer shell"
        aria-labelledby="home-question"
      >
        <span className="eyebrow">{answer.eyebrow}</span>
        <h1 id="home-question">{withTerms(answer.question)}</h1>
        <p
          className="home-answer-sentence"
          data-state={selection.state}
          id="home-answer"
        >
          {withTerms(sentence)}
        </p>
        {selection.state === "selected" ? (
          <dl className="home-facts" aria-label={answer.factsLabel}>
            <div>
              <dt>{answer.primaryAccuracy}</dt>
              <dd>
                <a href={links.rule}>
                  {fraction(selection.primaryAccuracy)} ·{" "}
                  {percent(selection.primaryAccuracy)}
                </a>
              </dd>
            </div>
            <div>
              <dt>{answer.validOutput}</dt>
              <dd>
                <a href={links.metrics}>
                  {fraction(selection.validOutput)} ·{" "}
                  {percent(selection.validOutput)}
                </a>
              </dd>
            </div>
          </dl>
        ) : null}
        {selection.state === "selected" ? (
          <p className="home-run">
            <a href={selection.sessionReceipt}>
              {answer.runDate(selection.runDate)}
            </a>
          </p>
        ) : null}
        <p className="home-control" id="home-control">
          {withTerms(answer.control)}
        </p>
        <div className="hero-actions">
          <Link className="button primary" href="/evals">
            {answer.seeComparison}
          </Link>
          <Link className="button secondary" href="/replay?mode=guided">
            {answer.walkThrough}
          </Link>
        </div>
        {HOME_TERM_KEYS.map((key) => (
          <div
            aria-labelledby={`${termId(key)}-title`}
            className="home-term-note"
            id={termId(key)}
            key={key}
            popover="auto"
            role="dialog"
          >
            <strong id={`${termId(key)}-title`}>{answer.terms[key][0]}</strong>
            <p>{answer.terms[key][1]}</p>
            <button
              className="button secondary"
              popoverTarget={termId(key)}
              popoverTargetAction="hide"
              type="button"
            >
              {answer.close}
            </button>
          </div>
        ))}
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
