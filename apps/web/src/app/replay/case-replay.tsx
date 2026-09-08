"use client";

import React, { useEffect, useRef, useState } from "react";

import type {
  ReplayResultResponse,
  ReplayReviewResponse,
  ReplayScenario,
  ReplayRequest,
  ApprovalRecord,
  CaseManifest,
  CaseManifestProposal,
  RapidPriceLiftResult,
  SchemaMappingProposal,
  SourceTrace,
  WorkflowState,
  MappingResponse,
} from "@weavetrail/contracts";
import {
  MappingResponseSchema,
  requiresMappingOverride,
} from "@weavetrail/contracts";
import type { SourceProvenance } from "@weavetrail/contracts";
import {
  canonicalJson,
  type CanonicalJsonInput,
} from "@weavetrail/replay-engine/canonical-json";
import { scenarioOptionLabel } from "./scenario-labels";
import { shuffleSourceRows } from "./shuffle-source-rows";
import {
  Bps,
  eventFieldNote,
  gateReading,
  GateReading,
  HashValue,
  Instant,
  readableCompactDate,
  reportedValueNote,
  type GateName,
} from "./machine-values";
import {
  ReplayLanguageContext,
  replayText,
  useReplayLanguage,
} from "./replay-language";
import { type Language } from "../i18n/language";

type Mutation = "baseline" | "shuffle" | "duplicate";

export type ReplayScenarioOption = {
  value: ReplayScenario;
  label: string;
  purpose: "REVIEWER_FACING" | "ENGINE_REGRESSION";
  sourceArtifactHash: string;
  rows: ReplayRequest["rows"];
  availableMutations: readonly Mutation[];
  manifest?: CaseManifestProposal;
  provenance?: SourceProvenance;
  mappingRequestRequired?: boolean;
};

export type CaseReplayProps = {
  providerMode: "fixture";
  proposals: Record<string, SchemaMappingProposal>;
  scenarios: ReplayScenarioOption[];
  guided?: boolean;
  mappingExample?: boolean;
  onMappingApprovalChange?: (approved: boolean) => void;
  onGuideComplete?: () => void;
  /** English unless a language-aware caller supplies otherwise. */
  language?: Language;
};

const workedCase = "published-execution-fix44.csv";
const reviewExample = "published-execution-h0stcnt0.jsonl";

/** Where the rail sends a visitor whose step is performed in the case column. */
export const GUIDE_TARGET_EXAMPLE = "guide-target-example";
export const GUIDE_TARGET_EVIDENCE = "guide-target-evidence";

// Each guided step opens with the one thing the visitor must do, then says why
// the step exists and which authority acted in it: a model proposed, a person
// approved, or versioned code decided. `Committed input` names the steps where
// none of the three has acted yet.
type GuideStep = {
  title: string;
  purpose: string;
  action: string;
  actor:
    | "Committed input"
    | "A model proposed it"
    | "A person approved it"
    | "Versioned code decided it";
  actorDetail: string;
  refusal?: string;
};

export const guideSteps: readonly GuideStep[] = [
  {
    title: "Read the source",
    purpose:
      "The committed case, untouched. These column names are the source's own dialect and carry no agreed meaning yet; establishing what they denote is the next step.",
    action:
      "Read the committed source rows and their original values, then continue.",
    actor: "Committed input",
    actorDetail:
      "Nothing has been proposed, approved or decided at this point.",
  },
  {
    title: "Review the mapping",
    purpose:
      "A model proposes which columns mean the same thing; it cannot approve them. The proposal below comes from a deterministic fixture, so no live model call occurred.",
    action:
      "Give the example's flagged field a reviewer reason and approve it, then approve this case's own mapping proposal.",
    actor: "A model proposed it",
    actorDetail:
      "The fixture mapping provider proposes targets, transforms and evidence. It cannot approve them.",
    refusal:
      "A refusal stays on this path: the review example holds at REVIEW_REQUIRED until every flagged field has a nonblank reviewer reason.",
  },
  {
    title: "Approve the case",
    purpose:
      "You decide how far this case is scoped. Versioned code defines the allowed parameter schema, formulas and comparisons; live case proposal is planned.",
    action:
      "Read the instrument, window and threshold values, then approve this exact case manifest.",
    actor: "A person approved it",
    actorDetail:
      "You approve the scope. An approval binds to one exact artifact hash.",
  },
  {
    title: "Run the replay",
    purpose:
      "The server revalidates the exact approvals and source rows, then versioned code recomputes the case. Each request has its own workflow state.",
    action:
      "Run the approved case and wait for its returned evaluation and source trace.",
    actor: "Versioned code decided it",
    actorDetail:
      "The server revalidates both approvals before the versioned rule runs.",
  },
  {
    title: "Inspect the finding",
    purpose:
      "This result describes support for one versioned pattern hypothesis under the approved scope. Five checks are reported, each with the value observed and the threshold it is compared against.",
    action:
      "Open the source evidence under a gate to reach its canonical events and committed source rows.",
    actor: "Versioned code decided it",
    actorDetail:
      "Gates, observed values and the source trace are server-derived, not model output.",
  },
  {
    title: "Repeat the case",
    purpose:
      "Execute the same approved input again. Comparing two returned hashes checks same-input repeatability only.",
    action:
      "Repeat the same approved case and compare the two server-returned hashes.",
    actor: "Versioned code decided it",
    actorDetail:
      "Both hashes are returned by the server. The browser compares them as strings.",
  },
  {
    title: "Take the controls",
    purpose:
      "From here you choose the source and the variations yourself, and load the published market data. A refresh starts unapproved.",
    action:
      "Carry this case into working mode, where you choose the source and the variations yourself.",
    actor: "A person approved it",
    actorDetail:
      "The approvals you made stay loaded. No approval is persisted beyond this browser session.",
  },
];

/**
 * Korean narration for the same seven steps, written in the vocabulary the
 * product uses for its own screens: 원본 거래자료, 데이터 항목 연결, 조사 범위,
 * 분석 실행, 판단 항목, 판단 근거. `actor` stays the English discriminant so
 * behaviour keyed on it, and the English suite that asserts on `guideSteps`,
 * both stay unchanged; only the label shown for it is translated.
 */
const guideStepsKo: readonly GuideStep[] = [
  {
    title: "원본 거래자료 확인",
    purpose:
      "조사 대상이 된 거래자료를 손대지 않은 그대로 봅니다. 열 이름은 자료를 만든 쪽이 쓰던 말이라, 어떤 항목이 무엇을 뜻하는지는 아직 정해지지 않았습니다.",
    action: "아래 원본 거래자료의 열 이름과 값을 훑어본 뒤 계속하세요.",
    actor: "Committed input",
    actorDetail: "이 시점에는 제안된 것도, 승인된 것도, 판정된 것도 없습니다.",
  },
  {
    title: "데이터 항목 연결 검토",
    purpose:
      "어떤 항목끼리 같은 뜻인지는 AI가 초안만 제안합니다. 아래 제안은 미리 준비된 예시 제안이며, 실시간 모델 호출은 일어나지 않았습니다.",
    action:
      "먼저 아래 예시에서 표시된 항목에 확인 이유를 적어 승인한 다음, 이 사례의 연결 제안을 승인하세요.",
    actor: "A model proposed it",
    actorDetail:
      "제안까지가 AI의 몫입니다. 대상 항목과 변환, 근거를 내놓을 뿐 승인은 하지 못합니다.",
    refusal:
      "확인이 필요한 항목에 이유를 적기 전까지, 예시는 REVIEW_REQUIRED에서 멈춘 채 진행되지 않습니다.",
  },
  {
    title: "조사 범위 승인",
    purpose:
      "이 사례를 어떤 범위로 조사할지는 사람이 정합니다. 계산에 쓰는 항목과 수식, 비교 방식은 버전이 고정된 코드가 미리 정해 둔 것입니다.",
    action:
      "종목과 기간, 판단 기준 값을 확인한 뒤 이 조사 범위를 그대로 승인하세요.",
    actor: "A person approved it",
    actorDetail:
      "범위를 승인하는 것은 사용자입니다. 승인은 지금 보고 있는 내용 하나에만 묶입니다.",
  },
  {
    title: "분석 실행",
    purpose:
      "서버가 승인한 내용과 원본 행을 하나씩 다시 확인한 뒤, 미리 정해진 기준으로 거래 움직임을 다시 계산합니다.",
    action: "승인한 사례를 실행하고 결과와 근거가 돌아올 때까지 기다리세요.",
    actor: "Versioned code decided it",
    actorDetail:
      "판정하는 것은 AI의 답이 아니라 버전이 고정된 코드입니다. 서버는 실행 전에 두 승인을 다시 검증합니다.",
  },
  {
    title: "판단 근거 확인",
    purpose:
      "결과는 하나의 패턴 가설을 승인된 범위 안에서 얼마나 뒷받침하는지만 말합니다. 다섯 개 판단 항목마다 관측값과 기준 충족 여부가 함께 나옵니다.",
    action:
      "판단 항목 하나의 근거를 열어, 그 값이 나온 원본 거래자료까지 따라가 보세요.",
    actor: "Versioned code decided it",
    actorDetail:
      "판단 항목과 관측값, 근거 추적은 모두 서버가 계산한 값이며 모델이 지어낸 문장이 아닙니다.",
  },
  {
    title: "동일 사례 반복 확인",
    purpose:
      "같은 자료를 같은 조건으로 한 번 더 실행합니다. 두 결과 해시를 비교하는 것은 같은 입력에 대한 재현성만 확인하는 일입니다.",
    action: "같은 사례를 다시 실행하고 두 결과 해시가 같은지 비교하세요.",
    actor: "Versioned code decided it",
    actorDetail:
      "두 해시 모두 서버가 반환한 값이고, 화면은 그 둘을 문자열로 비교합니다.",
  },
  {
    title: "직접 조작으로 이동",
    purpose:
      "여기서부터는 원본 자료를 직접 고르고 거래 순서를 바꾸는 등 입력을 바꿔 결과가 어떻게 달라지는지 볼 수 있습니다. 공개 시장데이터도 같은 화면에서 불러옵니다.",
    action:
      "이 사례와 승인 내용을 그대로 가지고 직접 조작 화면으로 넘어가세요.",
    actor: "A person approved it",
    actorDetail:
      "지금까지 한 승인은 그대로 남습니다. 다만 어떤 승인도 이 브라우저 세션을 넘어 저장되지는 않습니다.",
  },
];

interface GuideUi {
  readonly blockers: readonly string[];
  readonly hashesDiffer: string;
  readonly readyToContinue: string;
  readonly toContinue: (reason: string) => string;
  readonly readingAhead: (step: number, title: string) => string;
  readonly stepHeading: (step: number, title: string) => string;
  readonly stepOf: (step: number, total: number) => string;
  readonly whatThisShows: string;
  readonly whatYouDo: string;
  readonly whoActed: string;
  readonly completed: string;
  readonly currentStep: string;
  readonly back: string;
  readonly continueLabel: string;
  readonly navigationInRail: string;
  readonly navigationAtEnd: string;
  readonly progressLabel: string;
  readonly controlsHeading: string;
  readonly goToExample: string;
  readonly goToEvidence: string;
  readonly stepListLabel: string;
}

export const guideUi: Readonly<Record<Language, GuideUi>> = {
  en: {
    blockers: [
      "",
      "Approve the separate mapping review example and this case's mapping to continue.",
      "Approve the mapping, then this exact case manifest.",
      "Run the approved case and wait for its evaluation and source trace.",
      "Open a finding's source evidence to continue.",
      "Repeat the same approved case to compare returned hashes.",
      "",
    ],
    hashesDiffer:
      "The returned hashes differ. Retry the same approved case or inspect the results.",
    readyToContinue: "Ready to continue.",
    toContinue: (reason) => `To continue: ${reason}`,
    readingAhead: (step, title) =>
      ` You are reading ahead: step ${step}, ${title}, is not completed.`,
    stepHeading: (step, title) => `Step ${step} · ${title}`,
    stepOf: (step, total) => `Step ${step} of ${total}`,
    whatThisShows: "What this shows",
    whatYouDo: "What you do",
    whoActed: "Who acted",
    completed: "Completed",
    currentStep: "Current step",
    back: "Back",
    continueLabel: "Continue",
    navigationInRail: "Step navigation in the step rail",
    navigationAtEnd: "Step navigation at the end of the step",
    progressLabel: "Case walkthrough progress",
    controlsHeading: "Case Replay controls",
    goToExample: "Go to the review example",
    goToEvidence: "Go to the finding evidence",
    stepListLabel: "All steps",
  },
  ko: {
    blockers: [
      "",
      "별도 검토 예시와 이 사례의 연결 제안을 모두 승인해야 계속할 수 있습니다.",
      "연결 제안을 먼저 승인하고, 이어서 이 조사 범위를 승인하세요.",
      "승인한 사례를 실행하고 결과와 근거가 나올 때까지 기다리세요.",
      "판단 근거를 하나 열어야 계속할 수 있습니다.",
      "같은 사례를 다시 실행해 두 결과 해시를 비교하세요.",
      "",
    ],
    hashesDiffer:
      "두 결과 해시가 서로 다릅니다. 같은 사례를 다시 실행하거나 결과를 확인하세요.",
    readyToContinue: "계속할 수 있습니다.",
    toContinue: (reason) => `계속하려면: ${reason}`,
    readingAhead: (step, title) =>
      ` 앞서 읽고 있습니다. ${step}단계 "${title}"를 아직 완료하지 않았습니다.`,
    stepHeading: (step, title) => `${step}단계 · ${title}`,
    stepOf: (step, total) => `${total}단계 중 ${step}단계`,
    whatThisShows: "이 단계가 필요한 이유",
    whatYouDo: "이번에 할 일",
    whoActed: "누가 했는가",
    completed: "완료",
    currentStep: "현재 단계",
    back: "이전",
    continueLabel: "계속",
    navigationInRail: "단계 목록에서 단계 이동하기",
    navigationAtEnd: "단계 끝에서 단계 이동하기",
    progressLabel: "사례 따라가기 진행 상황",
    controlsHeading: "직접 조작 컨트롤",
    goToExample: "검토 예시로 이동",
    goToEvidence: "판단 근거로 이동",
    stepListLabel: "전체 단계",
  },
};

export const guideStepsByLanguage: Readonly<
  Record<Language, readonly GuideStep[]>
> = {
  en: guideSteps,
  ko: guideStepsKo,
};

const actorLabels: Readonly<
  Record<Language, Record<GuideStep["actor"], string>>
> = {
  en: {
    "Committed input": "Committed input",
    "A model proposed it": "A model proposed it",
    "A person approved it": "A person approved it",
    "Versioned code decided it": "Versioned code decided it",
  },
  ko: {
    "Committed input": "커밋된 입력",
    "A model proposed it": "모델이 제안했습니다",
    "A person approved it": "사람이 승인했습니다",
    "Versioned code decided it": "버전이 고정된 코드가 판정했습니다",
  },
};

const configuredProposalOverride: Readonly<
  Record<Language, { purpose: string; action: string }>
> = {
  en: {
    purpose:
      "The worked case follows published FIX 4.4 execution fields. The separate H0STCNT0 example has no participant field and stops until a reviewer acknowledges that absence. Review each proposal's displayed provider and evidence before approval.",
    action:
      "Review and approve the separate example's mapping, then approve the worked case's own mapping.",
  },
  ko: {
    purpose:
      "이 사례는 공개 FIX 4.4 체결 항목을 따릅니다. 별도의 H0STCNT0 예시에는 참여자 항목이 없으며, 검토자가 그 부재를 확인하기 전까지 멈춥니다. 승인하기 전에 제안마다 표시된 제공자와 근거를 확인하세요.",
    action:
      "별도 예시의 연결 제안을 검토해 승인한 뒤, 이 사례의 연결 제안을 승인하세요.",
  },
};

export function ApprovalReceipt({ approval }: { approval: ApprovalRecord }) {
  const language = useReplayLanguage();
  const t = (en: string, ko: string) => replayText(language, en, ko);
  return (
    <dl className="approval-receipt">
      <div>
        <dt>{t("Approved artifact hash", "승인된 아티팩트 해시")}</dt>
        <dd>
          <HashValue
            scope="approvedArtifact"
            value={approval.approvedArtifactHash}
          />
        </dd>
      </div>
      <div>
        <dt>{t("Reviewer", "검토자")}</dt>
        <dd>{approval.reviewerRef}</dd>
      </div>
      <div>
        <dt>{t("Decision", "결정")}</dt>
        <dd>{approval.decision}</dd>
      </div>
      <div>
        <dt>{t("Approved at", "승인 시각")}</dt>
        <dd>
          <Instant value={approval.approvedAt} />
        </dd>
      </div>
      {approval.overrides.map(({ fieldPath, reason }) => (
        <div key={fieldPath}>
          <dt>{fieldPath}</dt>
          <dd>{reason}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SourceRows({ scenario }: { scenario: ReplayScenarioOption }) {
  const language = useReplayLanguage();
  const t = (en: string, ko: string) => replayText(language, en, ko);
  return (
    <section
      className="source-preview"
      aria-label={t("Committed source rows", "커밋된 원본 거래자료")}
    >
      <p>
        {t("Artifact", "아티팩트")}: <code>{scenario.value}</code>
      </p>
      <HashValue scope="sourceArtifact" value={scenario.sourceArtifactHash} />
      <p>
        {t(
          `These ${scenario.provenance?.kind ?? "synthetic"} source records are fixed. Values below are the original strings, before mapping, shown in committed order.`,
          "이 원본 기록은 고정되어 있습니다. 아래 값은 항목을 연결하기 전의 원본 그대로입니다.",
        )}
      </p>
      {scenario.provenance && (
        <SourceProvenanceDetails provenance={scenario.provenance} />
      )}
      {scenario.rows.map((row) => (
        <details
          key={row.coordinate.rowNumber}
          open={
            row.coordinate.rowNumber === scenario.rows[0]?.coordinate.rowNumber
          }
        >
          <summary>
            {t("Source row", "원본 행")} {row.coordinate.rowNumber}
          </summary>
          <dl className="source-values">
            {Object.entries(row.values).map(([column, value]) => (
              <div key={column}>
                <dt>{column}</dt>
                <dd>
                  <code>{value}</code>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
    </section>
  );
}

export function SourceProvenanceDetails({
  provenance,
}: {
  provenance: SourceProvenance;
}) {
  const language = useReplayLanguage();
  const t = (en: string, ko: string) => replayText(language, en, ko);
  if (provenance.kind === "synthetic")
    return (
      <section aria-label={t("Synthetic source provenance", "합성 자료 출처")}>
        <h3>{provenance.title}</h3>
        <p>
          {t("Attribution", "출처 표기")}: {provenance.attribution}
        </p>
        <p>
          <a href={provenance.recordUrl}>
            {t("Open the complete source record", "전체 원본 기록 열기")}
          </a>
        </p>
      </section>
    );
  return (
    <section aria-label={t("Published source provenance", "공개 자료 출처")}>
      <h3>{provenance.title}</h3>
      <p>
        {provenance.titleEnglish} · {provenance.provider}
      </p>
      <dl>
        {provenance.basDtRange ? (
          <div>
            <dt>{t("Trading date range", "거래일 범위")} (basDt)</dt>
            <dd>
              {readableCompactDate(provenance.basDtRange.begin)}{" "}
              {t("through", "부터")}{" "}
              {readableCompactDate(provenance.basDtRange.endInclusive)}{" "}
              <code>{provenance.basDtRange.begin}</code> {t("through", "부터")}{" "}
              <code>{provenance.basDtRange.endInclusive}</code>
            </dd>
          </div>
        ) : (
          <div>
            <dt>{t("Trading date", "거래일")} (basDt)</dt>
            <dd>
              {readableCompactDate(provenance.basDt)}{" "}
              <code>{provenance.basDt}</code>
            </dd>
          </div>
        )}
        <div>
          <dt>{t("Retrieved", "수집 시각")}</dt>
          <dd>
            <Instant value={provenance.retrievedAt} />
          </dd>
        </div>
        <div>
          <dt>{t("Venue scope", "거래소 범위")}</dt>
          <dd>
            {provenance.venue.value} · {provenance.venue.basis}
          </dd>
        </div>
        <div>
          <dt>{t("Recorded usage permission", "기록된 이용 허가")}</dt>
          <dd>{provenance.licence.label}</dd>
        </div>
        <div>
          <dt>{t("Permission verified", "허가 확인 시각")}</dt>
          <dd>
            <Instant value={provenance.licence.checkedAt} />
          </dd>
        </div>
        <div>
          <dt>{t("Attribution requirements", "출처 표기 요건")}</dt>
          <dd>{provenance.licence.attributionRequirements}</dd>
        </div>
      </dl>
      <p>{provenance.licence.attribution}</p>
      <p>
        <a href={provenance.originUrl}>
          {t("Official source distribution", "공식 배포처")}
        </a>{" "}
        ·{" "}
        <a href={provenance.licence.termsUrl}>
          {t("Source terms", "이용 조건")}
        </a>
        {" · "}
        <a href={provenance.recordUrl}>
          {t("Complete source record", "전체 원본 기록")}
        </a>
      </p>
    </section>
  );
}

export function DailyQuoteSemantics() {
  const language = useReplayLanguage();
  const t = (en: string, ko: string) => replayText(language, en, ko);
  return (
    <section aria-label="Daily quote interpretation">
      <h3>
        {t("Artifact kind", "아티팩트 종류")}: <code>DAILY_QUOTE</code>
      </h3>
      <p>
        {t(
          "The trading date is interpreted as a day-start anchor at 00:00:00+09:00, not an observed execution time or a publisher-returned offset.",
          "거래일은 하루의 시작 시각일 뿐 개별 체결 시각이 아닙니다.",
        )}
      </p>
      <p>
        {t(
          "Price represents the daily closing price. Quantity represents daily aggregate volume. Each interpretation requires a nonblank reviewer reason before mapping approval.",
          "가격은 일별 종가이고, 수량은 그날의 총 거래량입니다. 승인하려면 항목마다 확인 이유가 필요합니다.",
        )}
      </p>
    </section>
  );
}

export function DailyQuoteCaseLimitation({
  normalized,
}: {
  normalized: boolean;
}) {
  const language = useReplayLanguage();
  const t = (en: string, ko: string) => replayText(language, en, ko);
  return (
    <section aria-label="Daily quote case limitation">
      <h3>{t("Case approval unavailable", "사례 승인을 할 수 없음")}</h3>
      <p>
        {normalized
          ? t("Daily quotes normalized. ", "일별 시세를 정규화했습니다.")
          : t(
              "Mapping approval enables source normalization. ",
              "연결 제안을 승인하면 원본 자료를 정리할 수 있습니다.",
            )}{" "}
      </p>
      <p>
        {t(
          "The normalized actor profile is empty. Daily quotes supply a trading-date anchor and daily aggregates, with no individual execution time or detail.",
          "일별 시세에는 참여자, 체결 방향, 개별 체결 시각이 없습니다.",
        )}
      </p>
      <p>
        {t(
          "A future case requires admissible genuine executions with execution time, side, actor identity, price and quantity, followed by separately reviewed case approval. Adding an actor alone cannot turn daily quotes into trades.",
          "사례 평가에는 별도로 검토한 체결 데이터가 필요합니다.",
        )}
      </p>
    </section>
  );
}

export const APPROVAL_HASH_ERROR =
  "Approval hash could not be computed. Approval and replay remain blocked.";

type ApprovalHashCrypto = {
  subtle?: Pick<SubtleCrypto, "digest">;
};

/** One field the proposal flagged, with the label its row is titled by. */
export type FlaggedMappingField = {
  readonly fieldPath: string;
  readonly label: string;
};

/**
 * The fields a person has to answer for before this proposal can be approved,
 * in the order their rows appear. Deriving the summary that names them, the
 * blocked check and the overrides an approval carries from one list is what
 * keeps those three from disagreeing about which fields are flagged.
 */
export function flaggedMappingFields(
  proposal: SchemaMappingProposal,
): readonly FlaggedMappingField[] {
  const mapped = proposal.fields.flatMap((field, index) =>
    requiresMappingOverride(field)
      ? [{ fieldPath: `fields.${index}`, label: field.sourceColumn }]
      : [],
  );
  const absent =
    "unmappedFields" in proposal
      ? proposal.unmappedFields.flatMap((field, index) =>
          requiresMappingOverride(field)
            ? [
                {
                  fieldPath: `unmappedFields.${index}`,
                  label: field.targetField,
                },
              ]
            : [],
        )
      : [];
  return [...mapped, ...absent];
}

/** The flagged fields still without a reviewer reason. */
export function unresolvedMappingFields(
  proposal: SchemaMappingProposal,
  reasons: Readonly<Record<string, string>>,
): readonly FlaggedMappingField[] {
  return flaggedMappingFields(proposal).filter(
    ({ fieldPath }) => !reasons[fieldPath]?.trim(),
  );
}

export function mappingOverrides(
  proposal: SchemaMappingProposal,
  reasons: Readonly<Record<string, string>>,
): ApprovalRecord["overrides"] {
  return flaggedMappingFields(proposal).flatMap(({ fieldPath }) => {
    const reason = reasons[fieldPath]?.trim();
    return reason ? [{ fieldPath, reason }] : [];
  });
}

export function hasUnresolvedMappingReview(
  proposal: SchemaMappingProposal,
  reasons: Readonly<Record<string, string>>,
): boolean {
  return unresolvedMappingFields(proposal, reasons).length > 0;
}

export function resetReplayForScenarioChange(scenario: ReplayScenario) {
  return {
    scenario,
    approval: null,
    caseApproval: null,
    result: null,
    error: null,
  } satisfies {
    scenario: ReplayScenario;
    approval: ApprovalRecord | null;
    caseApproval: ApprovalRecord | null;
    result: ReplayResultResponse | null;
    error: string | null;
  };
}

export async function approvalFor(
  artifact: CanonicalJsonInput,
  overrides: ApprovalRecord["overrides"] = [],
  cryptoProvider: ApprovalHashCrypto | undefined = globalThis.crypto,
): Promise<ApprovalRecord> {
  try {
    if (cryptoProvider?.subtle === undefined) {
      throw new Error("Web Crypto is unavailable");
    }
    const bytes = new TextEncoder().encode(canonicalJson(artifact));
    const digest = await cryptoProvider.subtle.digest("SHA-256", bytes);
    const approvedArtifactHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return {
      approvedArtifactHash,
      reviewerRef: "reviewer:local-lab",
      decision: "APPROVED",
      overrides,
      approvedAt: new Date().toISOString(),
    };
  } catch {
    throw new Error(APPROVAL_HASH_ERROR);
  }
}

export async function attemptApproval(
  artifact: CanonicalJsonInput,
  overrides: ApprovalRecord["overrides"] = [],
  cryptoProvider: ApprovalHashCrypto | undefined = globalThis.crypto,
): Promise<{ approval: ApprovalRecord | null; error: string | null }> {
  try {
    return {
      approval: await approvalFor(artifact, overrides, cryptoProvider),
      error: null,
    };
  } catch {
    return { approval: null, error: APPROVAL_HASH_ERROR };
  }
}

export function RapidPriceLiftEvaluation({
  evaluation,
  sourceTrace,
  scenario,
  onEvidenceOpen,
  advancesStep = false,
}: {
  evaluation: RapidPriceLiftResult;
  sourceTrace: SourceTrace;
  scenario: ReplayScenario;
  onEvidenceOpen?: () => void;
  advancesStep?: boolean;
}) {
  const language = useReplayLanguage();
  const t = (en: string, ko: string) => replayText(language, en, ko);
  return (
    <section className="result-summary" aria-label="Pattern hypothesis result">
      <div className="evaluation-heading">
        <strong data-result={evaluation.result}>{evaluation.result}</strong>
        <code>
          {evaluation.ruleId}@{evaluation.ruleVersion}
        </code>
      </div>
      <div className="evaluation-block">
        {evaluation.result === "INCONCLUSIVE" ? (
          <>
            <p>
              {t("Reason", "사유")}: {evaluation.reason}
            </p>
            <p>
              {t(
                "No evaluated finding evidence is available.",
                "평가된 발견 증거가 없습니다.",
              )}
            </p>
          </>
        ) : (
          <div className="gate-list">
            <p className="machine-note">{reportedValueNote(language)}</p>
            {evaluation.findings.map((finding, index) => (
              <div
                className="gate-row"
                key={finding.gate}
                id={`gate-${finding.gate}`}
              >
                <strong>
                  {gateReading(finding.gate as GateName, language).label}
                </strong>
                <code className="gate-id">{finding.gate}</code>
                <GateReading
                  gate={finding.gate as GateName}
                  observedValue={finding.observedValue}
                  threshold={finding.threshold}
                />
                <b data-passed={finding.passed}>
                  {finding.passed ? "PASS" : "FAIL"}
                </b>
                <p className="gate-description">
                  {gateReading(finding.gate as GateName, language).tests}
                </p>
                <small>{finding.referencedEventIds.join(" · ")}</small>
                <details
                  className={
                    advancesStep
                      ? "source-evidence step-action"
                      : "source-evidence"
                  }
                  onToggle={(event) => {
                    if (event.currentTarget.open) onEvidenceOpen?.();
                  }}
                >
                  <summary id={index === 0 ? GUIDE_TARGET_EVIDENCE : undefined}>
                    {t(
                      `Inspect source evidence for ${finding.gate}`,
                      `판단 근거 열기: ${gateReading(finding.gate as GateName, language).label}`,
                    )}
                    <small>
                      {t(
                        "The canonical events this check counted, and the committed source row behind each one.",
                        "이 판단이 센 거래 기록과, 그 기록이 나온 원본 행을 그대로 펼쳐 봅니다.",
                      )}
                    </small>
                  </summary>
                  {sourceTrace.entries
                    .filter(({ event }) =>
                      finding.referencedEventIds.includes(event.eventId),
                    )
                    .map(({ event, sourceRow }) => (
                      <article
                        key={event.eventId}
                        aria-label={`Source evidence for ${event.eventId}`}
                      >
                        <h3>{t("Canonical event", "정리된 거래 기록")}</h3>
                        <dl>
                          {Object.entries(event).map(([field, value]) => (
                            <div key={field}>
                              <dt>{field}</dt>
                              <dd>
                                {value !== undefined &&
                                field === "rawRowHash" ? (
                                  <HashValue scope="rawRow" value={value} />
                                ) : value !== undefined &&
                                  (field === "eventTime" ||
                                    field === "receivedAt") ? (
                                  <Instant value={value} />
                                ) : (
                                  <code>{value}</code>
                                )}
                                {eventFieldNote(field, language) ? (
                                  <small className="machine-note">
                                    {eventFieldNote(field, language)}
                                  </small>
                                ) : null}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <h3>{t("Committed source row", "커밋된 원본 행")}</h3>
                        <dl>
                          <div>
                            <dt>{t("Artifact", "아티팩트")}</dt>
                            <dd>{scenario}</dd>
                          </div>
                          <div>
                            <dt>sourceArtifactHash</dt>
                            <dd>
                              <HashValue
                                scope="sourceArtifact"
                                value={sourceRow.coordinate.sourceArtifactHash}
                              />
                            </dd>
                          </div>
                          <div>
                            <dt>{t("Source row number", "원본 행 번호")}</dt>
                            <dd>{sourceRow.coordinate.rowNumber}</dd>
                          </div>
                        </dl>
                        <h3>{t("Raw column values", "원본 열 값")}</h3>
                        <dl className="source-values">
                          {Object.entries(sourceRow.values).map(
                            ([column, value]) => (
                              <div key={column}>
                                <dt>{column}</dt>
                                <dd>
                                  <code>{value}</code>
                                </dd>
                              </div>
                            ),
                          )}
                        </dl>
                      </article>
                    ))}
                </details>
              </div>
            ))}
          </div>
        )}
        {evaluation.sensitivity ? (
          <div className="sensitivity-block">
            <strong>
              {t("Mechanical sensitivity comparison", "기계적 민감도 비교")}
            </strong>
            <small className="machine-note">
              {reportedValueNote(language)}
            </small>
            <a href="#gate-REMOVAL_SENSITIVITY">
              {t(
                "Inspect removal sensitivity evidence",
                "제거 민감도 증거 보기",
              )}
            </a>
            <span>
              {t("Price change", "가격 변화")}:{" "}
              <Bps value={evaluation.sensitivity.priceChangeBps} />
            </span>
            <span>
              {t("Without approved actor group", "승인된 행위자 그룹 제외")}:{" "}
              <Bps
                value={
                  evaluation.sensitivity.priceChangeBpsWithoutApprovedActors
                }
              />
            </span>
            <span>
              {t("Metric difference", "지표 차이")}:{" "}
              <Bps value={evaluation.sensitivity.removalSensitivityBps} />
            </span>
          </div>
        ) : null}
        <small>
          {t("Non-comparable events", "비교할 수 없는 이벤트")}:{" "}
          {evaluation.nonComparableEventCount}
        </small>
      </div>
    </section>
  );
}

/**
 * What each state means, in one line. The code is the contract's own value and
 * stays exactly as returned; the sentence beside it is what the code is for.
 */
const workflowStateMeaning: Readonly<
  Record<Language, Record<WorkflowState, string>>
> = {
  en: {
    UPLOADED: "The source rows are committed. Nothing has been proposed yet.",
    MAPPING_PROPOSED:
      "A model proposed what the columns mean. Nobody approved it yet.",
    // Reached both by a flagged field without a reason and by a proposal that
    // was rejected or never obtained, which produces no fields to review at
    // all. The sentence has to hold for both.
    MAPPING_REVIEW_REQUIRED:
      "The mapping cannot be approved as it stands: a flagged field is waiting for a reason, or no validated proposal has been accepted.",
    // Also the end state of a source that has no case manifest at all, so it
    // cannot promise a case approval that will never be offered.
    MAPPING_APPROVED:
      "You approved what the columns mean. No case has been approved or evaluated.",
    CASE_PROPOSED: "A case scope is proposed. Nobody approved it yet.",
    CASE_REVIEW_REQUIRED:
      "The server refused the case scope or its approval, so no rule ran.",
    CASE_APPROVED: "You approved the scope. The case has not been run yet.",
    INPUT_REVIEW_REQUIRED:
      "The submitted input did not pass validation, so nothing ran.",
    REPLAYED:
      "Versioned code recomputed the case from the approved input and returned this result.",
    EXPORTED:
      "A result written into an evidence bundle. Bundle export is planned, so this surface does not reach this state.",
  },
  ko: {
    UPLOADED: "원본 행이 그대로 올라와 있습니다. 아직 제안된 것은 없습니다.",
    MAPPING_PROPOSED:
      "AI가 항목의 뜻을 제안했습니다. 아직 아무도 승인하지 않았습니다.",
    MAPPING_REVIEW_REQUIRED:
      "지금 상태로는 연결 제안을 승인할 수 없습니다. 확인이 필요한 항목이 이유를 기다리고 있거나, 검증을 통과한 제안을 아직 받지 못했습니다.",
    MAPPING_APPROVED:
      "항목의 뜻을 승인했습니다. 승인되거나 평가된 조사 범위는 아직 없습니다.",
    CASE_PROPOSED:
      "조사 범위가 제안되었습니다. 아직 아무도 승인하지 않았습니다.",
    CASE_REVIEW_REQUIRED:
      "서버가 조사 범위나 그 승인을 받아들이지 않아 아무 규칙도 실행되지 않았습니다.",
    CASE_APPROVED: "조사 범위를 승인했습니다. 아직 실행하지는 않았습니다.",
    INPUT_REVIEW_REQUIRED:
      "보낸 입력이 검증을 통과하지 못해 아무것도 실행되지 않았습니다.",
    REPLAYED:
      "버전이 고정된 코드가 승인된 입력으로 다시 계산해 이 결과를 돌려주었습니다.",
    EXPORTED:
      "결과를 증거 묶음으로 내보낸 상태입니다. 증거 묶음 내보내기는 계획 단계라 이 화면은 이 상태에 이르지 않습니다.",
  },
};

export function WorkflowStateBadge({ state }: { state: WorkflowState }) {
  const language = useReplayLanguage();
  return (
    <div className="workflow-state" data-state={state}>
      <strong>{replayText(language, "Workflow state", "워크플로 상태")}</strong>
      <code>{state}</code>
      <small>{workflowStateMeaning[language][state]}</small>
    </div>
  );
}

const mutationOptions: Readonly<
  Record<
    Language,
    ReadonlyArray<{ value: Mutation; label: string; detail: string }>
  >
> = {
  en: [
    {
      value: "baseline",
      label: "Baseline",
      detail: "Original committed order",
    },
    {
      value: "shuffle",
      label: "Shuffle source rows",
      detail:
        "Change submitted order before mapping; coordinates and values stay fixed",
    },
    {
      value: "duplicate",
      label: "Duplicate a derived event",
      detail: "Repeat one event after mapping; source rows stay fixed",
    },
  ],
  ko: [
    {
      value: "baseline",
      label: "원본 그대로",
      detail: "커밋된 원본 자료의 순서를 그대로 씁니다",
    },
    {
      value: "shuffle",
      label: "거래 순서 바꾸기",
      detail: "제출하는 순서만 바꿉니다. 행의 위치와 값은 그대로입니다",
    },
    {
      value: "duplicate",
      label: "거래 하나 반복하기",
      detail: "정리된 거래 기록 하나를 반복합니다. 원본 행은 그대로입니다",
    },
  ],
};

export function CaseReplay({
  proposals,
  providerMode,
  scenarios,
  guided = false,
  mappingExample = false,
  onMappingApprovalChange,
  onGuideComplete,
  language = "en",
}: CaseReplayProps) {
  const requestGeneration = useRef(0);
  const [focusPending, setFocusPending] = useState(false);
  const previousGuided = useRef(guided);
  const lastSubmittedRows = useRef<ReplayRequest["rows"] | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<string[] | null>(null);
  const [chapter, setChapter] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [exampleApproved, setExampleApproved] = useState(false);
  const [evidenceOpened, setEvidenceOpened] = useState(false);
  const [previousHash, setPreviousHash] = useState<string | null>(null);
  const guidedScenario =
    scenarios.find(({ value }) => value === workedCase)?.value ??
    scenarios[0]!.value;
  const [scenario, setScenario] = useState<ReplayScenario>(guidedScenario);
  const [mutation, setMutation] = useState<Mutation>("baseline");
  const [result, setResult] = useState<ReplayResultResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(
    null,
  );
  const [approval, setApproval] = useState<ApprovalRecord | null>(null);
  const [caseApproval, setCaseApproval] = useState<ApprovalRecord | null>(null);
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>(
    {},
  );
  const [requestedMapping, setRequestedMapping] =
    useState<MappingResponse | null>(null);
  const [requestingMapping, setRequestingMapping] = useState(false);
  const selectedScenario = scenarios.find(({ value }) => value === scenario)!;
  const selectedMutations = selectedScenario.availableMutations;
  const proposal =
    requestedMapping?.proposal ??
    proposals[selectedScenario.sourceArtifactHash]!;
  const proposalPending =
    selectedScenario.mappingRequestRequired === true &&
    requestedMapping === null;
  const displayedProviderMode = requestedMapping?.mode ?? providerMode;
  const unresolvedFields = unresolvedMappingFields(proposal, reviewReasons);
  const unresolvedReview = unresolvedFields.length > 0;
  // Both the worked case and the review example render a proposal, so the
  // input ids have to say which of the two they belong to.
  const reviewScope = mappingExample ? "example" : "case";
  const reviewInputId = (fieldPath: string) =>
    `mapping-review-${reviewScope}-${fieldPath.replace(".", "-")}`;
  const exampleScenario =
    scenarios.find(({ value }) => value === reviewExample) ??
    scenarios.find(({ value }) => value === "concentrated-buy-dialect-b.jsonl");
  const completeResult =
    result?.workflowState === "REPLAYED" &&
    "evaluation" in result &&
    "sourceTrace" in result;
  const repeatMatches =
    completeResult &&
    previousHash !== null &&
    previousHash === result.replay.canonicalResultHash;
  const stepSatisfied = [
    true,
    approval !== null && exampleApproved,
    approval !== null && caseApproval !== null,
    completeResult,
    completeResult && evidenceOpened,
    repeatMatches,
    true,
  ];
  const ui = guideUi[language];
  const t = (en: string, ko: string) => replayText(language, en, ko);
  const stepBlockers = ui.blockers.map((blocker, index) =>
    index === 5 && previousHash && completeResult ? ui.hashesDiffer : blocker,
  );
  const canContinue = stepSatisfied[chapter];
  const blockedReason = stepBlockers[chapter];
  // Read-ahead is allowed, so an earlier step can still be unmet while the
  // visitor reads a later one. Completion means the visitor satisfied the step
  // themselves and it still holds.
  const unmetEarlierStep = stepSatisfied
    .slice(0, chapter)
    .findIndex((satisfied) => !satisfied);
  const stepCompleted = (step: number) =>
    completedSteps.includes(step) && stepSatisfied[step] === true;
  const show = (step: number) => !guided || chapter === step;

  useEffect(() => {
    if (guided && !previousGuided.current) {
      requestGeneration.current += 1;
      setChapter(0);
      setCompletedSteps([]);
      setExampleApproved(false);
      setEvidenceOpened(false);
      setPreviousHash(null);
      lastSubmittedRows.current = null;
      setSubmittedOrder(null);
      setScenario(guidedScenario);
      setMutation("baseline");
      setResult(null);
      setRunning(false);
      setError(null);
      setWorkflowState(null);
      setApproval(null);
      setCaseApproval(null);
      setReviewReasons({});
      setRequestedMapping(null);
      setRequestingMapping(false);
    }
    previousGuided.current = guided;
  }, [guided, guidedScenario]);

  function goToChapter(next: number) {
    setFocusPending(true);
    setChapter(next);
  }

  function completeChapter(step: number) {
    setCompletedSteps((current) =>
      current.includes(step) ? current : [...current, step],
    );
  }

  function advanceChapter() {
    if (!canContinue) return;
    completeChapter(chapter);
    goToChapter(chapter + 1);
  }

  function focusChapterTitle(node: HTMLHeadingElement | null) {
    if (node && focusPending) {
      node.focus();
      setFocusPending(false);
    }
  }

  const activeSteps = guideStepsByLanguage[language];
  const guideStep =
    chapter === 1 && exampleScenario?.mappingRequestRequired
      ? { ...activeSteps[1]!, ...configuredProposalOverride[language] }
      : activeSteps[chapter]!;
  const panelLabel = (order: string, label: string) =>
    guided ? label : `${order} · ${label}`;

  // Rendered inline rather than as a nested component so the same controls open
  // and close the step without duplicating their disabled and blocked state.
  function stepControls(place: "rail" | "end") {
    return (
      <nav
        aria-label={place === "rail" ? ui.navigationInRail : ui.navigationAtEnd}
        className="journey-controls"
      >
        <button
          className="button"
          disabled={chapter === 0}
          onClick={() => goToChapter(chapter - 1)}
          type="button"
        >
          {ui.back}
        </button>
        {chapter < activeSteps.length - 1 && (
          <button
            aria-describedby={canContinue ? undefined : "guide-requirement"}
            className="button primary"
            disabled={!canContinue}
            onClick={advanceChapter}
            type="button"
          >
            {ui.continueLabel}
          </button>
        )}
      </nav>
    );
  }

  /**
   * The one control that advances the current step, offered in the rail so
   * performing a step never depends on finding its control in the case column.
   * A step whose work happens inside the case content — writing a reviewer
   * reason, opening a finding's evidence — gets a control that goes there and
   * takes focus with it, rather than one that does the work for the visitor.
   */
  type StepAction = {
    kind: "perform" | "locate";
    action:
      | "approve-mapping"
      | "reveal-example"
      | "approve-case"
      | "run-replay"
      | "reveal-evidence"
      | "repeat-replay"
      | "complete-guide";
    label: string;
    disabled: boolean;
    /** Whether this action has already been carried out on this step. The
     *  step's continue condition cannot answer this: a step that gates nothing
     *  is satisfied from the start while its action is still outstanding. */
    done?: boolean;
  };

  /**
   * The step is performed at an input inside the review example, so the
   * control goes to the field still waiting for a reason rather than to the
   * example's own heading, which is already on screen and moves nothing.
   */
  function revealExampleWork() {
    if (typeof document === "undefined") return;
    const example = document.querySelector(".mapping-example");
    if (!example) return;
    // In order of what the step is actually waiting for: a field without a
    // reason, then the request that has to produce a proposal at all, then the
    // approval. A disabled control cannot take focus, so one is only offered
    // when it can be acted on.
    // The request control stays rendered after a proposal arrives, so it is
    // only a candidate while the example has none: offering it afterwards
    // would send the visitor to re-request a proposal they already approved.
    const proposalShown = example.querySelector(".mapping-preview") !== null;
    const candidates = [
      example.querySelector<HTMLElement>('[data-review-unresolved="true"]'),
      proposalShown
        ? null
        : example.querySelector<HTMLElement>(".request-mapping"),
      document.getElementById(GUIDE_TARGET_EXAMPLE),
    ];
    const next = candidates.find(
      (candidate): candidate is HTMLElement =>
        candidate !== null && !candidate.matches(":disabled"),
    );
    if (!next) return;
    next.scrollIntoView({ block: "center", behavior: "smooth" });
    next.focus({ preventScroll: true });
  }

  function focusReviewInput(fieldPath: string) {
    if (typeof document === "undefined") return;
    const input = document.getElementById(reviewInputId(fieldPath));
    if (!input) return;
    input.scrollIntoView({ block: "center", behavior: "smooth" });
    input.focus({ preventScroll: true });
  }

  function revealTarget(id: string) {
    if (typeof document === "undefined") return;
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.focus({ preventScroll: true });
  }

  function completeGuide() {
    if (!repeatMatches) return;
    completeChapter(chapter);
    setFocusPending(true);
    onGuideComplete?.();
  }

  const normalizingOnly =
    selectedScenario.manifest === undefined &&
    "eventType" in proposal.constants;
  const approveMappingLabel = approval
    ? t("Mapping approved locally", "연결 제안을 승인했습니다")
    : t("Approve executed mapping", "연결 제안 승인");
  const approveCaseLabel = caseApproval
    ? t("Case approved locally", "조사 범위를 승인했습니다")
    : t("Approve case manifest", "조사 범위 승인");
  const runLabel = normalizingOnly
    ? running
      ? t("Normalizing…", "자료 정리 중…")
      : t("Normalize source", "원본 자료 정리")
    : running
      ? t("Replaying…", "분석 실행 중…")
      : t("Run deterministic replay", "분석 실행");
  const repeatLabel = running
    ? t("Replaying…", "분석 실행 중…")
    : t("Repeat the same approved case", "같은 사례 다시 실행");
  const workingModeLabel = t("Continue in working mode", "직접 조작으로 이동");
  const approveMappingBlocked =
    unresolvedReview || proposalPending || requestingMapping;
  const runBlocked =
    running ||
    approval === null ||
    (selectedScenario.manifest !== undefined && caseApproval === null);
  const repeatBlocked =
    running || !approval || !caseApproval || (!completeResult && !previousHash);

  const stepActions: readonly (StepAction | null)[] = [
    null,
    exampleApproved || !exampleScenario
      ? {
          kind: "perform",
          action: "approve-mapping",
          label: approveMappingLabel,
          disabled: approveMappingBlocked,
          done: approval !== null,
        }
      : {
          kind: "locate",
          action: "reveal-example",
          label: ui.goToExample,
          disabled: false,
        },
    {
      kind: "perform",
      action: "approve-case",
      label: approveCaseLabel,
      disabled: !approval,
      done: caseApproval !== null,
    },
    {
      kind: "perform",
      action: "run-replay",
      label: runLabel,
      disabled: runBlocked,
      done: completeResult,
    },
    completeResult
      ? {
          kind: "locate",
          action: "reveal-evidence",
          label: ui.goToEvidence,
          disabled: false,
        }
      : null,
    {
      kind: "perform",
      action: "repeat-replay",
      label: repeatLabel,
      disabled: repeatBlocked,
      done: repeatMatches,
    },
    {
      kind: "perform",
      action: "complete-guide",
      label: workingModeLabel,
      disabled: !repeatMatches,
    },
  ];
  const stepAction = guided ? (stepActions[chapter] ?? null) : null;

  function performStepAction(action: StepAction["action"]) {
    switch (action) {
      case "approve-mapping":
        return approveMapping();
      case "reveal-example":
        return revealExampleWork();
      case "approve-case":
        return approveCase();
      case "run-replay":
        return runReplay();
      case "reveal-evidence":
        return revealTarget(GUIDE_TARGET_EVIDENCE);
      case "repeat-replay":
        return runReplay(true);
      case "complete-guide":
        return completeGuide();
    }
  }

  function invalidateResult() {
    requestGeneration.current += 1;
    setResult(null);
    setError(null);
    setWorkflowState(null);
    setRunning(false);
    setRequestingMapping(false);
    setEvidenceOpened(false);
    setPreviousHash(null);
    setSubmittedOrder(null);
    return requestGeneration.current;
  }

  async function approveMapping() {
    if (unresolvedReview || proposalPending || requestingMapping) return;
    const generation = invalidateResult();
    setCaseApproval(null);
    setApproval(null);
    onMappingApprovalChange?.(false);
    const attempt = await attemptApproval(
      proposal,
      mappingOverrides(proposal, reviewReasons),
    );
    if (generation !== requestGeneration.current) return;
    setApproval(attempt.approval);
    onMappingApprovalChange?.(attempt.approval !== null);
    setError(attempt.error);
  }

  async function requestMapping() {
    const generation = invalidateResult();
    setApproval(null);
    setCaseApproval(null);
    setReviewReasons({});
    setRequestedMapping(null);
    onMappingApprovalChange?.(false);
    setRequestingMapping(true);
    try {
      const response = await fetch("/api/mapping", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      if (!response.ok) throw new Error("Mapping request rejected");
      const mapping = MappingResponseSchema.parse(await response.json());
      if (generation !== requestGeneration.current) return;
      if (
        mapping.proposal.sourceArtifactHash !==
        selectedScenario.sourceArtifactHash
      )
        throw new Error("Mapping artifact mismatch");
      setRequestedMapping(mapping);
      setWorkflowState("MAPPING_PROPOSED");
    } catch {
      if (generation !== requestGeneration.current) return;
      setWorkflowState("MAPPING_REVIEW_REQUIRED");
      setError(
        t(
          "REVIEW_REQUIRED: Mapping proposal unavailable or rejected. Request a new proposal before approval.",
          "REVIEW_REQUIRED · 연결 제안을 받지 못했거나 거부되었습니다. 승인하기 전에 새 제안을 요청하세요.",
        ),
      );
    } finally {
      if (generation === requestGeneration.current) setRequestingMapping(false);
    }
  }

  async function approveCase() {
    if (approval === null || selectedScenario.manifest === undefined) return;
    const generation = invalidateResult();
    setCaseApproval(null);
    const attempt = await attemptApproval(selectedScenario.manifest);
    if (generation !== requestGeneration.current) return;
    setCaseApproval(attempt.approval);
    setError(attempt.error);
  }

  async function runReplay(repeat = false) {
    if (
      running ||
      !approval ||
      proposalPending ||
      requestingMapping ||
      unresolvedReview ||
      (repeat && !completeResult && previousHash === null) ||
      (selectedScenario.manifest && !caseApproval)
    )
      return;
    const comparisonHash = repeat
      ? (previousHash ??
        (completeResult ? result.replay.canonicalResultHash : null))
      : null;
    const generation = invalidateResult();
    setPreviousHash(comparisonHash);
    setRunning(true);
    try {
      const rows =
        repeat && lastSubmittedRows.current
          ? lastSubmittedRows.current
          : mutation === "shuffle"
            ? shuffleSourceRows(
                selectedScenario.rows,
                lastSubmittedRows.current ?? selectedScenario.rows,
              )
            : [...selectedScenario.rows];
      const request: ReplayRequest = {
        scenario,
        mutation,
        rows,
        mappingApproval: approval,
        ...(requestedMapping?.mode === "ai"
          ? { mappingReceipt: requestedMapping.mappingReceipt }
          : {}),
        ...(selectedScenario.manifest && caseApproval
          ? {
              caseManifest: {
                ...selectedScenario.manifest,
                approval: caseApproval,
              } satisfies CaseManifest,
            }
          : {}),
      };
      lastSubmittedRows.current = request.rows;
      setSubmittedOrder(
        request.rows.map(({ coordinate }) => coordinate.rowNumber),
      );
      const response = await fetch("/api/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const review = (await response.json()) as ReplayReviewResponse;
        if (generation !== requestGeneration.current) return;
        setWorkflowState(review.workflowState);
        throw new Error(review.issues.map(({ message }) => message).join(" "));
      }
      const replayResult = (await response.json()) as ReplayResultResponse;
      if (generation !== requestGeneration.current) return;
      setWorkflowState(replayResult.workflowState);
      setResult(replayResult);
    } catch (cause) {
      if (generation !== requestGeneration.current) return;
      setError(cause instanceof Error ? cause.message : "Replay failed");
    } finally {
      if (generation === requestGeneration.current) setRunning(false);
    }
  }

  return (
    <ReplayLanguageContext.Provider value={language}>
      <section
        className={
          guided
            ? "replay-journey guided-split"
            : mappingExample
              ? "replay-journey"
              : "replay-grid"
        }
      >
        {!mappingExample && (
          <header className="journey-header panel">
            {guided ? (
              <>
                <div className="rail-lead">
                  <p className="rail-progress">
                    <span>{ui.stepOf(chapter + 1, activeSteps.length)}</span>
                    <span
                      aria-hidden="true"
                      className="rail-meter"
                      style={{
                        // The bar is decoration for the count beside it, which
                        // is what a screen reader announces.
                        ["--rail-meter-fill" as string]: `${((chapter + 1) / activeSteps.length) * 100}%`,
                      }}
                    />
                  </p>
                  <h2 ref={focusChapterTitle} tabIndex={-1}>
                    {ui.stepHeading(chapter + 1, guideStep.title)}
                  </h2>
                  <p className="step-instruction">{guideStep.action}</p>
                  <div className="rail-actions">
                    <p
                      className="step-requirement"
                      data-met={canContinue && unmetEarlierStep === -1}
                      id="guide-requirement"
                      role="status"
                    >
                      {canContinue
                        ? ui.readyToContinue
                        : ui.toContinue(blockedReason ?? "")}
                      {unmetEarlierStep === -1
                        ? ""
                        : ui.readingAhead(
                            unmetEarlierStep + 1,
                            activeSteps[unmetEarlierStep]!.title,
                          )}
                    </p>
                    {stepAction ? (
                      // The rail's control is the one a visitor is told to
                      // use, so it has to stop asking once the step is done.
                      // Emphasis marks the work still outstanding; a step
                      // already satisfied steps back to a quiet control.
                      <button
                        className={
                          stepAction.kind === "perform"
                            ? `button${stepAction.done ? "" : " primary step-action"}`
                            : "button step-locate"
                        }
                        data-approved={
                          stepAction.kind === "perform"
                            ? stepAction.done === true
                            : undefined
                        }
                        disabled={stepAction.disabled}
                        onClick={() => performStepAction(stepAction.action)}
                        type="button"
                      >
                        {stepAction.label}
                      </button>
                    ) : null}
                    {stepControls("rail")}
                  </div>
                </div>
                <div className="rail-scroll">
                  <dl className="step-intent">
                    <div>
                      <dt>{ui.whatThisShows}</dt>
                      <dd>{guideStep.purpose}</dd>
                    </div>
                    <div>
                      <dt>{ui.whoActed}</dt>
                      <dd>
                        <strong>
                          {actorLabels[language][guideStep.actor]}
                        </strong>{" "}
                        {guideStep.actorDetail}
                      </dd>
                    </div>
                  </dl>
                  {guideStep.refusal ? (
                    <p className="step-refusal" data-status="REVIEW_REQUIRED">
                      {guideStep.refusal}
                    </p>
                  ) : null}
                  <h3 className="rail-list-heading">{ui.stepListLabel}</h3>
                  <ol
                    className="journey-progress"
                    aria-label={ui.progressLabel}
                  >
                    {activeSteps.map((step, index) => (
                      <li
                        key={step.title}
                        aria-current={chapter === index ? "step" : undefined}
                      >
                        <button
                          className="journey-step"
                          data-complete={stepCompleted(index)}
                          onClick={() => goToChapter(index)}
                          type="button"
                        >
                          <span>
                            {index + 1}. {step.title}
                          </span>
                          {stepCompleted(index) || chapter === index ? (
                            <small>
                              {stepCompleted(index)
                                ? ui.completed
                                : ui.currentStep}
                            </small>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            ) : (
              <>
                <h2 ref={focusChapterTitle} tabIndex={-1}>
                  {ui.controlsHeading}
                </h2>
                <p>
                  {selectedScenario.manifest
                    ? t(
                        "Select a committed source, review its mapping and approve its case before running it.",
                        "원본 거래자료를 고르고, 데이터 항목 연결을 검토해 승인한 다음, 조사 범위를 승인하고 실행하세요.",
                      )
                    : t(
                        "Review the source and approve its exact mapping to normalize it. This source has no case manifest or case evaluation.",
                        "원본 자료를 검토하고 항목 연결을 그대로 승인하면 자료를 정리할 수 있습니다. 이 자료에는 조사 범위와 사례 평가가 없습니다.",
                      )}{" "}
                  {t(
                    "The input-variation controls change submitted source order or repeat one derived event after mapping.",
                    "입력 자료 변경 실험에서는 제출하는 거래 순서를 바꾸거나, 연결 후 만들어진 기록 하나를 반복할 수 있습니다.",
                  )}
                </p>
              </>
            )}
          </header>
        )}
        <div
          className="replay-control panel"
          hidden={guided && chapter >= 4 && !error}
        >
          <div hidden={!show(0) || mappingExample}>
            <span className="panel-label">
              {panelLabel("01", t("Committed source", "원본 거래자료"))}
            </span>
            <label className="scenario-select">
              <span>
                {t("Committed source artifact", "커밋된 원본 거래자료")}
              </span>
              <select
                disabled={guided}
                onChange={(event) => {
                  invalidateResult();
                  lastSubmittedRows.current = null;
                  setMutation("baseline");
                  const reset = resetReplayForScenarioChange(
                    event.target.value as ReplayScenario,
                  );
                  setScenario(reset.scenario);
                  setApproval(reset.approval);
                  setCaseApproval(reset.caseApproval);
                  setResult(reset.result);
                  setError(reset.error);
                  setWorkflowState(null);
                  setReviewReasons({});
                  setRequestedMapping(null);
                  setRequestingMapping(false);
                }}
                value={scenario}
              >
                {scenarios.map(({ label, value, provenance, purpose }) => (
                  <option key={value} value={value}>
                    {scenarioOptionLabel(
                      value,
                      label,
                      provenance?.kind ?? "synthetic",
                      purpose,
                      language,
                    )}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div hidden={!show(0) && !mappingExample}>
            <SourceRows scenario={selectedScenario} />
          </div>
          {!guided && !mappingExample && (
            <details className="advanced-controls">
              <summary>
                {t("Advanced replay variations", "입력 자료 변경 실험")}
              </summary>
              <p>
                {t(
                  selectedScenario.provenance?.kind === "real"
                    ? "This licensed published artifact offers Baseline and Shuffle. Neither control invents a value or participant, and this source has no control that attaches a pattern verdict."
                    : "This artifact offers Baseline, Shuffle, and Duplicate. Original coordinates and values stay fixed.",
                  selectedScenario.provenance?.kind === "real"
                    ? "이 라이선스 공개 자료에서는 원본 그대로와 순서 섞기를 사용할 수 있습니다. 어느 조작도 값이나 참여자를 만들지 않으며, 패턴 결과를 붙이는 조작도 없습니다."
                    : "이 자료에서는 원본 그대로, 순서 섞기, 기록 반복을 사용할 수 있습니다. 원본의 위치와 값은 그대로입니다.",
                )}
              </p>
              <div className="option-list">
                {mutationOptions[language]
                  .filter((option) => selectedMutations.includes(option.value))
                  .map((option) => (
                    <label
                      className={
                        mutation === option.value ? "option selected" : "option"
                      }
                      key={option.value}
                    >
                      <input
                        checked={mutation === option.value}
                        name="mutation"
                        onChange={() => {
                          invalidateResult();
                          setMutation(option.value);
                        }}
                        type="radio"
                        value={option.value}
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.detail}</small>
                      </span>
                    </label>
                  ))}
              </div>
            </details>
          )}
          {submittedOrder && (
            <section aria-label="Submitted source row order">
              <h3>{t("Submitted source row order", "제출한 원본 행 순서")}</h3>
              <p>
                {t(
                  "Request order before canonical event ordering. The engine sorts by eventTime, sequence and eventId, so this order does not decide the result: compare it with the ordering in the result below.",
                  "기록을 정렬하기 전, 요청에 담아 보낸 순서입니다. 엔진은 시각과 순번, 기록 번호 순으로 다시 정렬하므로 이 순서가 결과를 정하지 않습니다. 아래 결과의 순서와 비교해 보세요.",
                )}
              </p>
              <p>
                <code>{submittedOrder.join(" → ")}</code>
              </p>
            </section>
          )}
          <div hidden={!show(1)}>
            {guided && exampleScenario && (
              <details className="mapping-example" open>
                <summary>
                  {t(
                    "Separate mapping review example · H0STCNT0",
                    "별도 연결 검토 예시 · H0STCNT0",
                  )}
                </summary>
                <p>
                  {t(
                    "This is a different source without a rule manifest. Its approval cannot authorize the worked case.",
                    "이 자료에는 판단 기준이 없습니다. 여기서 한 승인은 지금 보고 있는 사례에 적용되지 않습니다.",
                  )}{" "}
                  {exampleScenario.mappingRequestRequired
                    ? t(
                        "Request a validated proposal before approval. A rejected response cannot be approved.",
                        "승인 전에 검증된 제안을 요청하세요. 거부된 응답은 승인할 수 없습니다.",
                      )
                    : t(
                        "A reason keeps the field unmapped. Removing it revokes this approval.",
                        "이유를 적으면 해당 항목을 연결하지 않은 채 그대로 둡니다. 이유를 지우면 승인이 취소됩니다.",
                      )}
                </p>
                <CaseReplay
                  proposals={proposals}
                  providerMode={providerMode}
                  scenarios={[exampleScenario]}
                  language={language}
                  mappingExample
                  onMappingApprovalChange={setExampleApproved}
                />
              </details>
            )}
            {selectedScenario.mappingRequestRequired && (
              <div>
                <p>
                  {t(
                    "Request, review and approve a mapping proposal. A failed request blocks replay.",
                    "연결 제안을 요청해 검토하고 승인하세요. 요청이 실패하면 분석을 실행할 수 없습니다.",
                  )}
                </p>
                <button
                  className="button request-mapping"
                  disabled={requestingMapping}
                  onClick={requestMapping}
                  type="button"
                >
                  {requestingMapping
                    ? t("Requesting mapping…", "연결 제안 요청 중…")
                    : t("Request mapping proposal", "연결 제안 요청")}
                </button>
              </div>
            )}
            {proposalPending ? (
              <p data-status="REVIEW_REQUIRED">
                REVIEW_REQUIRED ·{" "}
                {t(
                  "A validated mapping proposal is required before approval.",
                  "승인하려면 검증을 통과한 연결 제안이 먼저 있어야 합니다.",
                )}
              </p>
            ) : (
              <div className="mapping-preview">
                <span className="panel-label">
                  {guided
                    ? t("Proposed mapping", "데이터 항목 연결 제안")
                    : `02 · ${t("Executed mapping proposal", "실행에 쓰인 연결 제안")} · ${displayedProviderMode} · ${selectedScenario.value}`}
                </span>
                <p>
                  {displayedProviderMode === "ai"
                    ? t("Configured provider", "설정된 provider")
                    : t("Fixture provider", "Fixture provider")}
                </p>
                <p>
                  {t(
                    "Review the proposed fields, transforms and evidence. Approval binds to this exact proposal.",
                    "제안된 항목과 변환, 근거를 검토하세요. 승인은 지금 보고 있는 이 제안 하나에만 묶입니다.",
                  )}
                </p>
                <p className="machine-note">
                  {t(
                    "Each field's evidence sentence is the proposal's own text, shown exactly as it was proposed. The approval binds to these bytes, so it is never rewritten.",
                    "항목마다 붙은 근거 문장은 제안이 스스로 적어 둔 원문이며, 제안된 그대로 보여 줍니다. 승인이 이 내용에 그대로 묶이기 때문에 다시 쓰지 않습니다.",
                  )}
                </p>
                {unresolvedFields.length > 0 && (
                  <div className="review-summary" data-status="REVIEW_REQUIRED">
                    <strong>
                      {t(
                        "These fields are waiting for your reason",
                        "확인 이유를 기다리는 항목",
                      )}
                    </strong>
                    <p>
                      {t(
                        "The proposal below is shown in full. These are the fields that block approval; each one goes to its own input.",
                        "아래 제안은 전부 그대로 보여 줍니다. 그중 승인을 막고 있는 항목은 다음과 같으며, 누르면 그 입력칸으로 갑니다.",
                      )}
                    </p>
                    <ul>
                      {unresolvedFields.map(({ fieldPath, label }) => (
                        <li key={fieldPath}>
                          <button
                            className="review-jump"
                            onClick={() => focusReviewInput(fieldPath)}
                            type="button"
                          >
                            {label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {"eventType" in proposal.constants &&
                  proposal.constants.eventType === "DAILY_QUOTE" && (
                    <DailyQuoteSemantics />
                  )}
                {"compositeSourceEventId" in proposal &&
                  proposal.compositeSourceEventId !== undefined && (
                    <section
                      aria-label={t(
                        "Composite source event identity",
                        "여러 열을 합친 기록 식별자",
                      )}
                      className="mapping-row"
                    >
                      <strong>
                        {t(
                          "Composite source event identity",
                          "여러 열을 합친 기록 식별자",
                        )}
                      </strong>
                      <span>
                        {t("Ordered columns", "순서가 있는 열")}:{" "}
                        <code>
                          {proposal.compositeSourceEventId.sourceColumns.join(
                            " + ",
                          )}
                        </code>
                      </span>
                      <span>
                        {t("Transform", "변환")}:{" "}
                        <code>{proposal.compositeSourceEventId.transform}</code>
                      </span>
                      <span>
                        {t("Confidence", "확신도")}:{" "}
                        {proposal.compositeSourceEventId.confidence.toFixed(2)}
                      </span>
                      <span>
                        {t("Evidence", "근거")}:{" "}
                        {proposal.compositeSourceEventId.evidence}
                      </span>
                      <b data-status={proposal.compositeSourceEventId.status}>
                        {proposal.compositeSourceEventId.status}
                      </b>
                    </section>
                  )}
                {"compositeEventTime" in proposal &&
                  proposal.compositeEventTime !== undefined && (
                    <section
                      aria-label={t(
                        "Composite execution time",
                        "여러 열을 합친 체결 시각",
                      )}
                      className="mapping-row"
                    >
                      <strong>
                        {t(
                          "Composite execution time",
                          "여러 열을 합친 체결 시각",
                        )}
                      </strong>
                      <span>
                        {t("Ordered columns", "순서가 있는 열")}:{" "}
                        <code>
                          {proposal.compositeEventTime.sourceColumns.join(
                            " + ",
                          )}
                        </code>
                      </span>
                      <span>
                        {t("Transform", "변환")}:{" "}
                        <code>{proposal.compositeEventTime.transform}</code>
                      </span>
                      <span>
                        {t("Confidence", "확신도")}:{" "}
                        {proposal.compositeEventTime.confidence.toFixed(2)}
                      </span>
                      <span>
                        {t("Evidence", "근거")}:{" "}
                        {proposal.compositeEventTime.evidence}
                      </span>
                      <b data-status={proposal.compositeEventTime.status}>
                        {proposal.compositeEventTime.status}
                      </b>
                    </section>
                  )}
                {proposal.fields.map((field, index) => (
                  <div className="mapping-row" key={field.sourceColumn}>
                    <code>{field.sourceColumn}</code>
                    <span>→</span>
                    <code>{field.targetField ?? "unmapped"}</code>
                    <span>
                      {t("Transform", "변환")}:{" "}
                      <code>{field.transform ?? "none"}</code>
                    </span>
                    <span>
                      {t("Confidence", "확신도")}: {field.confidence.toFixed(2)}{" "}
                      (
                      {t(
                        "not a calibrated probability",
                        "보정된 확률이 아닙니다",
                      )}
                      )
                    </span>
                    <span>
                      {t("Evidence", "근거")}: {field.evidence}
                    </span>
                    <b data-status={field.status}>{field.status}</b>
                    {requiresMappingOverride(field) ? (
                      <label>
                        <span>
                          {t("Reviewer reason for", "확인 이유")}{" "}
                          {field.sourceColumn}
                        </span>
                        <input
                          aria-label={`${t("Reviewer reason for", "확인 이유")} ${field.sourceColumn}`}
                          data-review-unresolved={
                            !reviewReasons[`fields.${index}`]?.trim()
                          }
                          id={reviewInputId(`fields.${index}`)}
                          onChange={(event) => {
                            invalidateResult();
                            setCaseApproval(null);
                            setReviewReasons((current) => ({
                              ...current,
                              [`fields.${index}`]: event.target.value,
                            }));
                            setApproval(null);
                            onMappingApprovalChange?.(false);
                          }}
                          required
                          type="text"
                          value={reviewReasons[`fields.${index}`] ?? ""}
                        />
                      </label>
                    ) : null}
                  </div>
                ))}
                {"unmappedFields" in proposal &&
                  proposal.unmappedFields.map((field, index) => (
                    <div
                      className="mapping-row"
                      key={`unmapped-${field.targetField}`}
                    >
                      <code>{t("source field absent", "원본 항목 없음")}</code>
                      <span>→</span>
                      <code>{field.targetField}</code>
                      <span>
                        {t("Confidence", "확신도")}:{" "}
                        {field.confidence.toFixed(2)} (
                        {t(
                          "not a calibrated probability",
                          "보정된 확률이 아닙니다",
                        )}
                        )
                      </span>
                      <span>
                        {t("Evidence", "근거")}: {field.evidence}
                      </span>
                      <b data-status={field.status}>{field.status}</b>
                      <label>
                        <span>
                          {t("Reviewer reason for", "확인 이유")}{" "}
                          {field.targetField}
                        </span>
                        <input
                          aria-label={`${t("Reviewer reason for", "확인 이유")} ${field.targetField}`}
                          data-review-unresolved={
                            !reviewReasons[`unmappedFields.${index}`]?.trim()
                          }
                          id={reviewInputId(`unmappedFields.${index}`)}
                          onChange={(event) => {
                            invalidateResult();
                            setCaseApproval(null);
                            setReviewReasons((current) => ({
                              ...current,
                              [`unmappedFields.${index}`]: event.target.value,
                            }));
                            setApproval(null);
                            onMappingApprovalChange?.(false);
                          }}
                          required
                          type="text"
                          value={reviewReasons[`unmappedFields.${index}`] ?? ""}
                        />
                      </label>
                    </div>
                  ))}
                {unresolvedReview ? (
                  <div className="review-message" data-status="REVIEW_REQUIRED">
                    <strong>REVIEW_REQUIRED</strong>
                    <span>
                      {t(
                        "Replay is blocked until every flagged field has a reviewer reason.",
                        "표시된 항목마다 확인 이유를 적기 전까지 분석을 실행할 수 없습니다.",
                      )}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
            <button
              className={`button approve-mapping${approval ? "" : " primary"}${
                guided && chapter === 1 && !approval ? " step-action" : ""
              }`}
              data-approved={approval !== null}
              disabled={approveMappingBlocked}
              id={mappingExample ? GUIDE_TARGET_EXAMPLE : undefined}
              onClick={approveMapping}
              type="button"
            >
              {approveMappingLabel}
            </button>
            {approval && <ApprovalReceipt approval={approval} />}
          </div>
          <div hidden={!show(2) || mappingExample}>
            {selectedScenario.manifest ? (
              <div className="case-preview">
                <span className="panel-label">
                  {panelLabel(
                    "03",
                    t("Case manifest proposal", "사례 manifest 제안"),
                  )}
                </span>
                <dl>
                  <div>
                    <dt>{t("Instrument", "종목")}</dt>
                    <dd>{selectedScenario.manifest.hypothesis.instrumentId}</dd>
                  </div>
                  <div>
                    <dt>{t("Proposed actor group", "제안된 행위자 그룹")}</dt>
                    <dd>
                      {selectedScenario.manifest.hypothesis.actorIds.join(", ")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Window", "구간")}</dt>
                    <dd>
                      <Instant
                        value={selectedScenario.manifest.hypothesis.startTime}
                      />{" "}
                      —{" "}
                      <Instant
                        value={selectedScenario.manifest.hypothesis.endTime}
                      />
                    </dd>
                  </div>
                </dl>
                <p>
                  {t("Pattern", "패턴")}:{" "}
                  <code>{selectedScenario.manifest.hypothesis.pattern}</code>
                </p>
                <p>
                  {t(
                    "Authored case proposal. Live case proposal is planned.",
                    "직접 작성한 사례 제안입니다. 실시간 사례 제안은 계획 단계입니다.",
                  )}
                </p>
                {selectedScenario.manifest.rules.map((rule) => (
                  <div key={rule.ruleId} className="case-rules">
                    <h3>
                      <code>
                        {rule.ruleId}@{rule.ruleVersion}
                      </code>
                    </h3>
                    <p>
                      {caseApproval
                        ? t(
                            "Threshold values approved with this case.",
                            "이 사례와 함께 승인된 판단 기준 값입니다.",
                          )
                        : t(
                            "Threshold values proposed in this authored case.",
                            "이 사례에 제안된 판단 기준 값입니다.",
                          )}{" "}
                      {t(
                        "Versioned code defines the allowed parameter schema, formulas and comparisons. All values remain exact strings; shares and price changes use basis points (100 bps = 1%).",
                        "쓸 수 있는 항목과 수식, 비교 방식은 버전이 고정된 코드가 정합니다. 모든 값은 반올림 없는 문자열이며, 비중과 가격 변화는 bp 단위를 씁니다. 100bp가 1%입니다.",
                      )}
                    </p>
                    <dl>
                      {Object.entries(rule.parameters).map(([name, value]) => (
                        <div key={name}>
                          <dt>{name}</dt>
                          <dd>
                            <code>{value}</code>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
                <details>
                  <summary>
                    {t(
                      "Inspect the exact case proposal",
                      "정확한 사례 제안 보기",
                    )}
                  </summary>
                  <p className="machine-note">
                    {t(
                      "The exact artifact this approval binds to. The canonicalDatasetHash inside it belongs to the artifact: it names the ordered canonical event projection the replay must reproduce, and the replay boundary refuses a request whose dataset does not match it. The source artifact hash belongs to the separately approved mapping.",
                      "이 승인이 묶이는 내용 그 자체입니다. 안에 있는 canonicalDatasetHash는 이 내용에 속하며, 분석이 그대로 되살려야 할 정리된 거래 기록의 순서를 가리킵니다. 자료가 이 값과 맞지 않으면 요청을 거부합니다. 원본 자료 해시는 따로 승인한 항목 연결 쪽에 속합니다.",
                    )}
                  </p>
                  <pre
                    className="artifact-json"
                    aria-label="Exact case manifest proposal"
                  >
                    {JSON.stringify(selectedScenario.manifest, null, 2)}
                  </pre>
                </details>
                {!approval && (
                  <p>
                    {t(
                      "Approve the mapping before approving the case.",
                      "조사 범위를 승인하기 전에 데이터 항목 연결을 먼저 승인하세요.",
                    )}
                  </p>
                )}
                <p className="approval-binding">
                  {t(
                    "Approving binds to this exact case manifest in full — every field of it, not only the values listed above.",
                    "승인은 이 사례 manifest 전체에 그대로 묶입니다. 위에 나열한 값에만 묶이는 것이 아니라 모든 항목이 포함됩니다.",
                  )}
                </p>
                <button
                  className={`button approve-case${caseApproval ? "" : " primary"}${
                    guided && chapter === 2 && !caseApproval
                      ? " step-action"
                      : ""
                  }`}
                  data-approved={caseApproval !== null}
                  disabled={!approval}
                  onClick={approveCase}
                  type="button"
                >
                  {approveCaseLabel}
                </button>
                {caseApproval && <ApprovalReceipt approval={caseApproval} />}
              </div>
            ) : "eventType" in proposal.constants &&
              proposal.constants.eventType === "DAILY_QUOTE" ? (
              <DailyQuoteCaseLimitation
                normalized={result?.workflowState === "MAPPING_APPROVED"}
              />
            ) : null}
          </div>
          <div hidden={!show(3) || mappingExample}>
            <button
              className={
                guided && chapter === 3
                  ? "button primary run-button step-action"
                  : "button primary run-button"
              }
              disabled={runBlocked}
              onClick={() => runReplay()}
              type="button"
            >
              {runLabel}
            </button>
            {guided && completeResult && (
              <WorkflowStateBadge state={result.workflowState} />
            )}
          </div>
          {error ? (
            <p className="error-message" role="alert">
              <strong>REPLAY_REFUSED</strong> {error}
            </p>
          ) : null}
          {error && workflowState ? (
            <WorkflowStateBadge state={workflowState} />
          ) : null}
        </div>

        <div
          hidden={
            mappingExample ||
            (guided && chapter !== 4 && chapter !== 5 && chapter !== 6)
          }
          className="panel result-panel"
          aria-live="polite"
        >
          <span className="panel-label">
            {panelLabel("04", t("Canonical result", "분석 결과"))}
          </span>
          {result ? (
            <>
              <WorkflowStateBadge state={result.workflowState} />
              {result.workflowState === "MAPPING_APPROVED" && (
                <p>
                  {t(
                    "Mapping and normalization only. No case has been approved or evaluated.",
                    "항목 연결과 자료 정리까지만 마쳤습니다. 조사 범위를 승인하거나 평가하지는 않았습니다.",
                  )}
                </p>
              )}
              <p>
                {t("Engine version", "엔진 버전")}:{" "}
                <code>{result.replay.engineVersion}</code>
              </p>
              {"evaluation" in result && (
                <p>
                  {t("Pattern outcome", "패턴 결과")}:{" "}
                  <strong>{result.evaluation.result}</strong>{" "}
                  {t("under the approved case and", "승인된 사례와")}{" "}
                  <code>
                    {result.evaluation.ruleId}@{result.evaluation.ruleVersion}
                  </code>
                  .
                </p>
              )}
              <div className="metric-grid">
                <div>
                  <span>{t("Input", "입력")}</span>
                  <strong>{result.replay.inputEventCount}</strong>
                </div>
                <div>
                  <span>{t("Canonical", "정리 후")}</span>
                  <strong>{result.replay.canonicalEventCount}</strong>
                </div>
                <div>
                  <span>{t("Duplicates", "중복")}</span>
                  <strong>{result.replay.duplicateCount}</strong>
                </div>
              </div>
              <div className="trace-block">
                <span>{t("Canonical order", "정리된 기록 순서")}</span>
                <small className="machine-note">
                  {eventFieldNote("eventId", language)}
                </small>
                <div className="event-chain">
                  {result.replay.orderedEventIds.map((eventId) => (
                    <code key={eventId}>{eventId}</code>
                  ))}
                </div>
              </div>
              <div className="hash-block">
                <HashValue
                  scope="canonicalResult"
                  value={result.replay.canonicalResultHash}
                />
              </div>
              {"evaluation" in result ? (
                <RapidPriceLiftEvaluation
                  advancesStep={guided && chapter === 4 && !evidenceOpened}
                  evaluation={result.evaluation}
                  sourceTrace={result.sourceTrace}
                  scenario={result.scenario}
                  onEvidenceOpen={() => setEvidenceOpened(true)}
                />
              ) : null}
              <p>
                {t(
                  "Independent Evidence Bundle assembly and verification are planned. Each displayed hash states what it covers where it is shown.",
                  "증거 묶음을 따로 만들고 검증하는 기능은 아직 계획 단계입니다. 화면에 나오는 해시는 저마다 어디까지를 덮는지 그 자리에서 밝힙니다.",
                )}
              </p>
              <p>
                {t(
                  "Pattern support is not a legal or causal conclusion. Actor removal is a mechanical sensitivity comparison.",
                  "패턴을 뒷받침한다는 결과는 법적 판단도, 인과관계에 대한 결론도 아닙니다. 특정 거래 주체를 빼고 비교한 값은 기계적인 대조일 뿐입니다.",
                )}
              </p>
              <div className="boundary-note">
                <strong>{t("Fixture mode", "Fixture 모드")}</strong>
                <p>{result.boundary}</p>
              </div>
            </>
          ) : (
            <div className="empty-result">
              <span className="empty-mark" aria-hidden="true">
                WT
              </span>
              <h2>
                {selectedScenario.manifest
                  ? t("Ready to replay", "분석 실행 준비 완료")
                  : t("Ready to normalize", "자료 정리 준비 완료")}
              </h2>
              <p>
                {selectedScenario.manifest
                  ? t(
                      "Review the source and explicitly approve its mapping and case.",
                      "원본 자료를 검토하고, 데이터 항목 연결과 조사 범위를 직접 승인하세요.",
                    )
                  : t(
                      "Review the source and explicitly approve its mapping, including any required interpretation reasons. Normalization has no case evaluation.",
                      "원본 자료를 검토하고 항목 연결을 직접 승인하세요. 확인이 필요한 항목에는 이유를 함께 적어야 합니다. 자료 정리에는 사례 평가가 없습니다.",
                    )}
              </p>
            </div>
          )}
        </div>
        {!mappingExample &&
          selectedScenario.manifest &&
          (!guided || chapter === 5) && (
            <section className="panel repeat-panel">
              <h3>
                {panelLabel(
                  "05",
                  t("Same-input repeatability", "같은 입력의 반복 가능성"),
                )}
              </h3>
              <p>
                {t(
                  "Repeat the approved case and compare the returned hashes. This checks same-input repeatability only.",
                  "승인된 사례를 반복하고 반환된 해시를 비교하세요. 같은 입력의 반복 가능성만 확인합니다.",
                )}
              </p>
              <button
                className={
                  guided && chapter === 5 ? "button step-action" : "button"
                }
                disabled={repeatBlocked}
                onClick={() => runReplay(true)}
                type="button"
              >
                {repeatLabel}
              </button>
              {previousHash && (
                <div className="hash-block">
                  <HashValue
                    label={t("Previous returned hash", "이전 반환 해시")}
                    scope="canonicalResult"
                    value={previousHash}
                  />
                  {completeResult && (
                    <>
                      <HashValue
                        label={t("Repeated returned hash", "반복 반환 해시")}
                        scope="canonicalResult"
                        value={result.replay.canonicalResultHash}
                      />
                      <strong>
                        {previousHash === result.replay.canonicalResultHash
                          ? t(
                              "MATCH · same-input repeatability",
                              "일치 · 같은 입력 반복 가능",
                            )
                          : t(
                              "MISMATCH · retry or inspect the returned results",
                              "불일치 · 다시 실행하거나 결과 확인",
                            )}
                      </strong>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
        {!mappingExample && (
          <section className="panel" hidden={guided && chapter !== 6}>
            <h3>{panelLabel("06", t("What runs today", "현재 실행 범위"))}</h3>
            <p>
              {t(
                "Published-schema synthetic sources, result-coverage fallbacks, and licensed published sources run with explicit mapping approval; sources with a manifest also run one versioned rule.",
                "공개 스키마 기반 합성 자료, 결과 범위를 지키는 대체 사례, 라이선스 공개 자료를 명시적인 항목 연결 승인과 함께 실행합니다. manifest가 있는 자료에는 버전이 고정된 규칙 하나도 실행합니다.",
              )}
            </p>
            <p>
              {t(
                "Production data ingestion, access controls and durable approval records are not implemented. Live case proposals and bundle export are planned.",
                "운영용 데이터 수집, 접근 제어, 영구 승인 기록은 구현되지 않았습니다. 실시간 사례 제안과 번들 내보내기는 계획 단계입니다.",
              )}
            </p>
            {guided && (
              <button
                className={
                  chapter === 6
                    ? "button primary step-action"
                    : "button primary"
                }
                type="button"
                disabled={!repeatMatches}
                onClick={completeGuide}
              >
                {workingModeLabel}
              </button>
            )}
          </section>
        )}
        {guided && (
          <footer className="journey-footer panel">
            {stepControls("end")}
          </footer>
        )}
      </section>
    </ReplayLanguageContext.Provider>
  );
}
