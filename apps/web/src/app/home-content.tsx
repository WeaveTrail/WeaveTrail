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
 * The AI card on the first screen: the question, a one-sentence answer and
 * the control line.
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
    "Rejected, malformed or ambiguous output stops at the [[validator|validator]] or at [[reviewRequired|REVIEW_REQUIRED]]. Only [[versionedCode|versioned code]] computes a result, after a person approves.",
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
    "거절되거나 형식이 깨졌거나 모호한 출력은 [[validator|검증기]]나 [[reviewRequired|REVIEW_REQUIRED]]에서 멈춥니다. 결과는 사람이 승인한 뒤 [[versionedCode|버전이 고정된 코드]]만 계산합니다.",
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

/** The evaluation facts the "runs today" board cites, read on the server. */
export interface HomeEvaluation {
  readonly candidates: number;
  readonly runDate: string | null;
}

interface HomeCopy {
  /** What the site is, in one line, before any question about it. */
  readonly intro: {
    readonly eyebrow: string;
    readonly title: string;
    readonly lede: string;
    readonly walkMeta: string;
  };
  readonly answer: AnswerCopy;
  readonly flowLabel: string;
  /** One short line per stage; the stage name already says who acts. */
  readonly stages: Readonly<Record<GuideStage, string>>;
  readonly flowStop: { readonly state: string; readonly text: string };
  readonly whyKicker: string;
  readonly whyHeading: string;
  readonly reasons: readonly (readonly [title: string, text: string])[];
  readonly boardKicker: string;
  readonly runsToday: string;
  readonly planned: string;
  readonly comparisonTitle: string;
  readonly comparison: (candidates: number, runDate: string | null) => string;
  readonly probesTitle: string;
  readonly probes: string;
  readonly failureLogTitle: string;
  readonly failureLog: (entries: number) => string;
  readonly guidedTitle: string;
  readonly guided: string;
  readonly plannedItems: readonly string[];
  readonly boundary: string;
  readonly gateLinkText: string;
}

/**
 * Voice copy is written in each language rather than translated. The first
 * screen says what the site is and offers the walkthrough, answers which AI
 * runs here beside it, and draws the four stages below; the rest says why and
 * what exists, and every detail is one link away. Stage names
 * come from the guided walkthrough, so the two never name a stage differently.
 */
export const homeCopy: Readonly<Record<Language, HomeCopy>> = {
  en: {
    intro: {
      eyebrow: "Synthetic market-surveillance cases",
      title: "AI reads the data. Code decides the result.",
      lede: "A model suggests what each column of a trading file means. You approve it, versioned code checks the pattern, and every finding opens to its source row.",
      walkMeta: "8 steps · about 5–10 minutes · no sign-in",
    },
    answer: ANSWER_EN,
    flowLabel: "From proposal to evidence",
    stages: {
      propose: "Suggests what each column holds",
      approve: "Nothing runs until approved",
      verify:
        "SUPPORTED, NOT_SUPPORTED or INCONCLUSIVE, the same for the same approved input",
      trace: "Every finding opens to its source row",
    },
    flowStop: {
      state: "REVIEW_REQUIRED · pre-replay",
      text: "Rejected or unclear: a person checks it before anything runs. Never a result.",
    },
    whyKicker: "Why it is needed",
    whyHeading: "Where a model helps, and where it goes wrong",
    reasons: [
      [
        "Every file names columns differently",
        "Is amt a quantity or an amount? One wrong link changes the result.",
      ],
      [
        "A model can be quietly wrong",
        "It can invent a column or obey text hidden in a cell.",
      ],
      [
        "So models are measured and fenced in",
        "Chosen by a rule fixed before the run, kept behind a validator and a person.",
      ],
    ],
    boardKicker: "What is built",
    runsToday: "Runs today",
    planned: "Planned",
    comparisonTitle: "Model comparison",
    comparison: (candidates, runDate) =>
      `${candidates} models + a non-model baseline${runDate ? ` · ${runDate}` : ""}`,
    probesTitle: "Validator under hostile output",
    probes: "Checked on every pull request",
    failureLogTitle: "AI failure log",
    failureLog: (entries) => `${entries} entries`,
    guidedTitle: "Walk through a case",
    guided: "8 steps · about 5–10 minutes",
    plannedItems: [
      "Escalate once to a stronger model, then a person",
      "Try a change: alter a column layout and watch",
      "AI-proposed case scope within the dataset profile",
    ],
    boundary:
      "Results describe support for a versioned pattern hypothesis on synthetic data, not guilt, causation or investment advice.",
    gateLinkText: "Where it fits",
  },
  ko: {
    intro: {
      eyebrow: "합성 시장감시 사례",
      title: "AI는 자료를 읽고, 판정은 코드가 합니다.",
      lede: "모델이 거래 파일의 열마다 뜻을 제안하면 사람이 승인하고, 버전이 고정된 코드가 패턴을 확인합니다. 판단 근거마다 원본 행이 열립니다.",
      walkMeta: "8단계 · 약 5~10분 · 회원가입 없음",
    },
    answer: ANSWER_KO,
    flowLabel: "제안에서 근거까지",
    stages: {
      propose: "열마다 어느 항목인지 제안",
      approve: "승인 전에는 아무것도 실행하지 않음",
      verify:
        "SUPPORTED, NOT_SUPPORTED, INCONCLUSIVE 가운데 하나, 같은 승인 입력이면 언제나 같게",
      trace: "판단 근거마다 원본 행까지 열림",
    },
    flowStop: {
      state: "REVIEW_REQUIRED · 분석 실행 이전",
      text: "거절되거나 모호하면 실행 전에 사람이 확인합니다. 결과가 아닙니다.",
    },
    whyKicker: "필요한 이유",
    whyHeading: "모델이 돕는 곳, 그리고 틀리는 곳",
    reasons: [
      [
        "파일마다 열 이름이 다릅니다",
        "amt는 수량일까요, 금액일까요? 하나만 잘못 연결해도 결과가 바뀝니다.",
      ],
      [
        "모델은 조용히 틀릴 수 있습니다",
        "없는 열을 만들거나 셀 안에 숨은 지시를 따를 수 있습니다.",
      ],
      [
        "그래서 측정하고, 울타리 안에 둡니다",
        "실행 전에 정한 규칙으로 고르고, 검증기와 사람 뒤에 둡니다.",
      ],
    ],
    boardKicker: "만든 것",
    runsToday: "지금 동작",
    planned: "계획",
    comparisonTitle: "모델 비교",
    comparison: (candidates, runDate) =>
      `후보 ${candidates}개 + 비모델 기준선${runDate ? ` · ${runDate}` : ""}`,
    probesTitle: "적대 출력으로 시험한 검증기",
    probes: "PR마다 확인",
    failureLogTitle: "AI 실패 기록",
    failureLog: (entries) => `${entries}건`,
    guidedTitle: "사례 따라가기",
    guided: "8단계 · 약 5~10분",
    plannedItems: [
      "상위 모델에 한 번, 그다음 사람에게",
      "바꿔 보기: 열 구성을 바꾸고 반응 보기",
      "데이터 프로필 안에서 AI가 조사 범위 제안",
    ],
    boundary:
      "결과는 합성 자료 위에서 버전이 고정된 패턴 가설을 얼마나 뒷받침하는지 나타냅니다. 유죄, 인과, 투자 조언이 아닙니다.",
    gateLinkText: "어디에 쓰이나",
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
      <section className="home-hero shell" aria-labelledby="home-title">
        <div className="home-answer">
          <div className="home-intro">
            <span className="eyebrow">{text.intro.eyebrow}</span>
            <h1 id="home-title">{text.intro.title}</h1>
            <p className="home-lede">{text.intro.lede}</p>
            <div className="hero-actions">
              <Link className="button primary" href="/replay?mode=guided">
                {answer.walkThrough}
              </Link>
              <Link className="button secondary" href="/evals">
                {answer.seeComparison}
              </Link>
            </div>
            <p className="home-walk-meta">{text.intro.walkMeta}</p>
          </div>

          <section className="home-ai" aria-labelledby="home-question">
            <span className="eyebrow">{answer.eyebrow}</span>
            <h2 id="home-question">{withTerms(answer.question)}</h2>
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
          </section>
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
          <figcaption>
            <h2 className="eyebrow" id="home-flow-title">
              {text.flowLabel}
            </h2>
          </figcaption>
          <ol>
            {GUIDE_STAGES.map((stage, index) => (
              <li data-stage={stage} key={stage}>
                <span className="home-flow-index" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3>{stageNames[stage]}</h3>
                  <p>{text.stages[stage]}</p>
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
            {text.reasons.map(([title, body]) => (
              <li key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="shell home-board" aria-labelledby="home-built">
        <h2 className="eyebrow" id="home-built">
          {text.boardKicker}
        </h2>
        <div className="home-board-columns">
          <div>
            <h3 className="home-board-label" data-status="implemented">
              {text.runsToday}
            </h3>
            <ul className="home-board-list">
              {(
                [
                  [
                    "/evals",
                    text.comparisonTitle,
                    text.comparison(evaluation.candidates, evaluation.runDate),
                  ],
                  ["/evals?view=failures", text.probesTitle, text.probes],
                  [
                    failureLog,
                    text.failureLogTitle,
                    text.failureLog(FAILURE_LOG_ENTRIES.length),
                  ],
                  ["/replay?mode=guided", text.guidedTitle, text.guided],
                ] as const
              ).map(([href, title, meta]) => (
                <li data-status="implemented" key={href}>
                  {href.startsWith("http") ? (
                    <a href={href}>
                      <strong>{title}</strong>
                      <span>{meta}</span>
                    </a>
                  ) : (
                    <Link href={href}>
                      <strong>{title}</strong>
                      <span>{meta}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="home-board-label" data-status="planned">
              {text.planned}
            </h3>
            <ul className="home-board-list">
              {text.plannedItems.map((item) => (
                <li data-status="planned" key={item}>
                  <strong>{item}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="home-boundary">
          {text.boundary} <Link href="/why">{text.gateLinkText}</Link>
        </p>
      </section>
    </main>
  );
}
