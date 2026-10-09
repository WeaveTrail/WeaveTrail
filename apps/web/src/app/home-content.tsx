"use client";

import Link from "next/link";
import React from "react";

import {
  FAILURE_LOG_ENTRIES,
  definitionLinks,
  fraction,
  percent,
} from "./evals/model-comparison-data";
import { GUIDE_STAGES, guideStageNames, type GuideStage } from "./guide-stages";
import type { HomeSelection } from "./home-selection";
import { useCopy, useLanguage, type Language } from "./i18n/language";

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

interface Stage {
  /** Who acts in this stage, said in words so it never rests on colour. */
  readonly actor: string;
  readonly text: string;
}

interface Reason {
  readonly title: string;
  readonly text: string;
}

interface BoardItem {
  readonly title: string;
  readonly text: string;
}

/** The evaluation facts the "runs today" board cites, read on the server. */
export interface HomeEvaluation {
  readonly candidates: number;
  readonly runDate: string | null;
}

interface HomeCopy {
  readonly answer: AnswerCopy;
  readonly flowLabel: string;
  readonly flowTitle: string;
  readonly stages: Readonly<Record<GuideStage, Stage>>;
  readonly flowStop: { readonly state: string; readonly text: string };
  readonly whyKicker: string;
  readonly whyHeading: string;
  readonly reasons: readonly Reason[];
  readonly boardKicker: string;
  readonly boardHeading: string;
  readonly runsToday: string;
  readonly planned: string;
  readonly comparison: (candidates: number, runDate: string | null) => string;
  readonly comparisonTitle: string;
  readonly comparisonLink: string;
  readonly probes: BoardItem;
  readonly probesLink: string;
  readonly failureLog: (entries: number) => string;
  readonly failureLogTitle: string;
  readonly failureLogLink: string;
  readonly guided: BoardItem;
  readonly guidedLink: string;
  readonly plannedItems: readonly BoardItem[];
  readonly boundary: string;
  readonly gateLinkText: string;
  readonly boundaryTail: string;
}

/**
 * Voice copy — the headline, the section headings and the calls to action —
 * is written in each language rather than translated from the other. The
 * explanatory prose beneath it says the same things in both, with the same
 * scope and the same hedging. Stage names come from the guided walkthrough,
 * so the home page and Case Replay never name a stage differently.
 */
export const homeCopy: Readonly<Record<Language, HomeCopy>> = {
  en: {
    answer: ANSWER_EN,
    flowLabel: "How a proposal reaches a result",
    flowTitle: "From proposal to evidence",
    stages: {
      propose: {
        actor: "Model",
        text: "Says which field each column of an unfamiliar file holds. The validator rejects anything outside the contract.",
      },
      approve: {
        actor: "Person",
        text: "Nothing goes further until a person approves that exact proposal.",
      },
      verify: {
        actor: "Versioned code",
        text: "Runs the approved input and returns SUPPORTED, NOT_SUPPORTED or INCONCLUSIVE, with the same hash every time.",
      },
      trace: {
        actor: "Source rows",
        text: "Every finding opens down to its source row and that row's hash.",
      },
    },
    flowStop: {
      state: "REVIEW_REQUIRED · pre-replay",
      text: "A rejected or unclear proposal stops here, before anything runs, for a person to look at. It is a review need, never a result.",
    },
    whyKicker: "Why it is needed",
    whyHeading: "A model reads the data. It never decides the result.",
    reasons: [
      {
        title: "Every file names its columns differently",
        text: "Is amt a quantity or an amount? Link one column wrongly and the whole result changes.",
      },
      {
        title: "A model can be wrong quietly",
        text: "It can link a column that is not there, or follow an instruction written inside a cell. Those failures are measured, not assumed away.",
      },
      {
        title: "So each model is measured and fenced in",
        text: "Candidates are compared on a sealed set beside a non-model baseline, chosen only by a rule fixed before the run, and kept behind a validator and a person.",
      },
    ],
    boardKicker: "What is built",
    boardHeading: "What runs today, and what is planned",
    runsToday: "Runs today",
    planned: "Planned",
    comparisonTitle: "Model comparison on the held-out set",
    comparison: (candidates, runDate) =>
      `${candidates} candidate models and a non-model baseline, scored by the same scorer${runDate ? `, run on ${runDate}` : ""}.`,
    comparisonLink: "See the model comparison",
    probes: {
      title: "Validator tested with hostile output",
      text: "Invented columns, broken JSON and unknown conversions are written on purpose; every pull request checks that the validator rejects each one.",
    },
    probesLink: "See how models fail",
    failureLogTitle: "AI failure log",
    failureLog: (entries) =>
      `${entries} entries so far, each with the assumption, the counterexample and what was done about it.`,
    failureLogLink: "Read the failure log",
    guided: {
      title: "One case, start to finish",
      text: "A synthetic case walked through the four stages, from the AI proposal to the source row.",
    },
    guidedLink: "Walk through a case",
    plannedItems: [
      {
        title: "One escalation, then a person",
        text: "An unclear or rejected proposal goes once to a stronger model that never sees the first answer; if it is still unresolved, a person decides.",
      },
      {
        title: "Try a change",
        text: "Alter a development column layout from a fixed list and watch the proposal path react. No free text and no held-out data.",
      },
      {
        title: "Case scope proposals",
        text: "The AI picks what to examine only from values the dataset profile offers; anything outside it is rejected.",
      },
    ],
    boundary:
      "Results describe support for a versioned pattern hypothesis on synthetic data. They are not a finding of guilt, a causal claim or investment advice.",
    gateLinkText: "Where it fits",
    boundaryTail: " explains the setting this question comes from.",
  },
  ko: {
    answer: ANSWER_KO,
    flowLabel: "제안이 결과에 이르는 길",
    flowTitle: "제안에서 근거까지",
    stages: {
      propose: {
        actor: "모델",
        text: "처음 보는 파일의 각 열이 어느 항목인지 제안합니다. 계약에 맞지 않는 제안은 검증기가 거절합니다.",
      },
      approve: {
        actor: "사람",
        text: "사람이 그 제안을 그대로 승인하기 전에는 다음 단계로 가지 않습니다.",
      },
      verify: {
        actor: "버전이 고정된 코드",
        text: "승인된 입력을 실행해 SUPPORTED, NOT_SUPPORTED, INCONCLUSIVE 가운데 하나를 내고, 언제나 같은 해시를 냅니다.",
      },
      trace: {
        actor: "원본 행",
        text: "모든 판단 근거는 원본 거래자료의 행과 그 행의 해시까지 열어 볼 수 있습니다.",
      },
    },
    flowStop: {
      state: "REVIEW_REQUIRED · 분석 실행 이전",
      text: "거절되거나 모호한 제안은 아무것도 실행하기 전에 여기서 멈추고 사람이 확인합니다. 검토가 필요하다는 뜻이며, 결과가 아닙니다.",
    },
    whyKicker: "필요한 이유",
    whyHeading: "모델은 데이터를 읽을 뿐, 결과를 정하지 않습니다.",
    reasons: [
      {
        title: "파일마다 열 이름이 다릅니다",
        text: "amt는 수량일까요, 금액일까요? 열 하나를 잘못 연결하면 결과 전체가 달라집니다.",
      },
      {
        title: "모델은 조용히 틀릴 수 있습니다",
        text: "없는 열을 연결하거나 셀 안에 적힌 지시를 따를 수 있습니다. 이런 실패를 짐작하지 않고 측정합니다.",
      },
      {
        title: "그래서 측정하고, 울타리 안에 둡니다",
        text: "후보 모델을 봉인된 집합에서 비모델 기준선과 함께 비교하고, 실행 전에 정한 규칙으로만 고르며, 검증기와 사람 뒤에 둡니다.",
      },
    ],
    boardKicker: "만든 것",
    boardHeading: "지금 동작하는 것과 계획",
    runsToday: "지금 동작",
    planned: "계획",
    comparisonTitle: "보관 평가 집합의 모델 비교",
    comparison: (candidates, runDate) =>
      `후보 모델 ${candidates}개와 비모델 기준선을 같은 채점기로 평가했습니다${runDate ? `(${runDate} 실행)` : ""}.`,
    comparisonLink: "모델 비교 보기",
    probes: {
      title: "적대 출력으로 시험한 검증기",
      text: "없는 열, 깨진 JSON, 모르는 변환을 일부러 만들어 넣고, 검증기가 모두 거절하는지 PR마다 확인합니다.",
    },
    probesLink: "모델이 틀리는 방식 보기",
    failureLogTitle: "AI 실패 기록",
    failureLog: (entries) =>
      `지금까지 ${entries}건입니다. 항목마다 가정, 반례, 그에 대한 조치를 적습니다.`,
    failureLogLink: "실패 기록 읽기",
    guided: {
      title: "사례 하나를 처음부터 끝까지",
      text: "합성 사례 하나를 네 과정으로 따라가며, AI의 제안에서 원본 행까지 갑니다.",
    },
    guidedLink: "사례 따라가기",
    plannedItems: [
      {
        title: "상위 모델 한 번, 그다음 사람",
        text: "모호하거나 거절된 제안은 첫 답을 보지 않는 상위 모델에 한 번만 넘기고, 그래도 풀리지 않으면 사람이 정합니다.",
      },
      {
        title: "바꿔 보기",
        text: "개발용 열 구성을 정해진 목록 안에서 바꾸고 제안 경로가 어떻게 반응하는지 봅니다. 자유 입력과 보관 평가 집합은 쓰지 않습니다.",
      },
      {
        title: "조사 범위 제안",
        text: "AI는 데이터셋 프로필에 있는 값 안에서만 조사 범위를 고르고, 밖의 값은 거절됩니다.",
      },
    ],
    boundary:
      "결과는 합성 자료 위에서 버전이 고정된 패턴 가설을 얼마나 뒷받침하는지 나타냅니다. 유죄 판단도, 인과 주장도, 투자 조언도 아닙니다.",
    gateLinkText: "어디에 쓰이나",
    boundaryTail: "에서 이 질문이 나온 맥락을 설명합니다.",
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

export function HomeContent({
  selection,
  evaluation,
}: {
  selection: HomeSelection;
  evaluation: HomeEvaluation;
}) {
  const text = useCopy(homeCopy);
  const stageNames = useCopy(guideStageNames);
  const { language } = useLanguage();
  const answer = text.answer;
  const links = definitionLinks(language);
  const failureLog = `https://github.com/WeaveTrail/WeaveTrail/blob/develop/docs/AI_FAILURE_LOG${language === "ko" ? ".ko" : ""}.md`;
  const sentence =
    selection.state === "planned"
      ? answer.planned[selection.reason]
      : selection.escalation === null
        ? answer.primaryOnly(selection.primary)
        : answer.selected(selection.primary, selection.escalation);

  return (
    <main className="home">
      <section className="home-hero shell" aria-labelledby="home-question">
        <div className="hero home-answer">
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
              <strong id={`${termId(key)}-title`}>
                {answer.terms[key][0]}
              </strong>
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
        </div>

        <figure className="home-flow" aria-labelledby="home-flow-title">
          <figcaption id="home-flow-title">
            <span className="eyebrow">{text.flowLabel}</span>
            <strong>{text.flowTitle}</strong>
          </figcaption>
          <ol>
            {GUIDE_STAGES.map((stage, index) => (
              <li data-stage={stage} key={stage}>
                <span className="home-flow-index" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h2>
                    {stageNames[stage]}
                    <span className="home-flow-actor">
                      {text.stages[stage].actor}
                    </span>
                  </h2>
                  <p>{text.stages[stage].text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="home-flow-stop">
            <span className="home-flow-state">{text.flowStop.state}</span>
            {text.flowStop.text}
          </p>
        </figure>
      </section>

      <section className="home-band" aria-labelledby="home-why">
        <div className="shell">
          <div className="section-heading">
            <span>{text.whyKicker}</span>
            <h2 id="home-why">{text.whyHeading}</h2>
          </div>
          <ol className="home-reasons">
            {text.reasons.map((reason) => (
              <li key={reason.title}>
                <h3>{reason.title}</h3>
                <p>{reason.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="shell home-board" aria-labelledby="home-built">
        <div className="section-heading">
          <span>{text.boardKicker}</span>
          <h2 id="home-built">{text.boardHeading}</h2>
        </div>
        <div className="home-board-columns">
          <div>
            <h3 className="home-board-label" data-status="implemented">
              {text.runsToday}
            </h3>
            <ul className="home-board-list">
              <li data-status="implemented">
                <h4>{text.comparisonTitle}</h4>
                <p>
                  {text.comparison(evaluation.candidates, evaluation.runDate)}
                </p>
                <Link href="/evals">{text.comparisonLink}</Link>
              </li>
              <li data-status="implemented">
                <h4>{text.probes.title}</h4>
                <p>{text.probes.text}</p>
                <Link href="/evals?view=failures">{text.probesLink}</Link>
              </li>
              <li data-status="implemented">
                <h4>{text.failureLogTitle}</h4>
                <p>{text.failureLog(FAILURE_LOG_ENTRIES.length)}</p>
                <a href={failureLog}>{text.failureLogLink}</a>
              </li>
              <li data-status="implemented">
                <h4>{text.guided.title}</h4>
                <p>{text.guided.text}</p>
                <Link href="/replay?mode=guided">{text.guidedLink}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="home-board-label" data-status="planned">
              {text.planned}
            </h3>
            <ul className="home-board-list">
              {text.plannedItems.map((item) => (
                <li data-status="planned" key={item.title}>
                  <h4>{item.title}</h4>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="home-boundary">
          {text.boundary} <Link href="/why">{text.gateLinkText}</Link>
          {text.boundaryTail}
        </p>
      </section>
    </main>
  );
}
