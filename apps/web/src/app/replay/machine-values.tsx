"use client";

import React, { useState } from "react";

import { type Language } from "../i18n/language";
import { useReplayLanguage } from "./replay-language";

/**
 * One statement per displayed hash: what it covers and what a comparison
 * proves. Every hash the workbench prints reads its wording from this table,
 * so a change to a hash's scope is a change in one place.
 */
export const HASH_SCOPES = {
  sourceArtifact: {
    label: "Source artifact hash",
    covers:
      "the committed bytes of the whole source artifact, before any mapping.",
    proves:
      "A match proves the rows under review come from the artifact this hash names. A mismatch proves the submitted artifact is not the committed one.",
  },
  approvedArtifact: {
    label: "Approved artifact hash",
    covers:
      "the exact artifact a person approved, canonically serialized: the proposal alone. A reviewer's override reasons travel in the approval record beside this hash and are not inside it.",
    proves:
      "A match proves the request carries the artifact that was approved. A mismatch proves the approval does not authorize the request, and the replay boundary refuses it.",
  },
  canonicalResult: {
    label: "Canonical result hash",
    covers:
      "the engine version, the canonical event projection and the evaluation when one is present. It does not cover complete approval records, every mapping or manifest field, or the source trace.",
    proves:
      "A match across two runs proves the covered material is identical: the same engine version, canonical event projection and evaluation. It does not prove the two requests carried the same approval records, mapping or manifest fields. A mismatch proves some of the covered material differed. Neither establishes authenticity or real-market accuracy.",
  },
  rawRow: {
    label: "Raw row hash",
    covers:
      "the canonicalized source coordinate and parsed column values of the row this canonical event came from, not the artifact's original bytes. Those are covered by the source artifact hash.",
    proves:
      "A match proves the canonical event still resolves to that committed row. A mismatch proves the coordinate or a parsed value changed after the event was derived.",
  },
} as const;

export type HashScope = keyof typeof HASH_SCOPES;

/**
 * The same four statements in Korean. The scope of each claim is the same in
 * both languages: a hash may not be said to cover more, or to prove more, on
 * one surface than on the other.
 */
export const HASH_SCOPES_KO: Readonly<
  Record<HashScope, { label: string; covers: string; proves: string }>
> = {
  sourceArtifact: {
    label: "원본 자료 해시",
    covers: "연결하기 전, 원본 거래자료 파일 전체의 바이트입니다.",
    proves:
      "값이 같으면 지금 검토하는 행들이 이 해시가 가리키는 파일에서 나왔다는 뜻입니다. 다르면 제출된 파일이 커밋된 그 파일이 아니라는 뜻입니다.",
  },
  approvedArtifact: {
    label: "승인한 내용의 해시",
    covers:
      "사람이 승인한 내용 그 자체를 정해진 방식으로 직렬화한 것, 즉 제안 하나입니다. 검토자가 남긴 이유는 이 해시 안이 아니라 승인 기록에 함께 담깁니다.",
    proves:
      "값이 같으면 이 요청이 승인받은 그 내용을 그대로 담고 있다는 뜻입니다. 다르면 그 승인은 이 요청을 허가하지 않으며, 분석 단계에서 요청을 거부합니다.",
  },
  canonicalResult: {
    label: "분석 결과 해시",
    covers:
      "엔진 버전과 정리된 거래 기록, 그리고 평가가 있을 때는 그 평가까지입니다. 승인 기록 전체나 연결·조사 범위의 모든 항목, 근거 추적은 포함하지 않습니다.",
    proves:
      "두 번 실행한 값이 같으면 위에 적은 범위가 서로 같다는 뜻입니다. 두 요청이 같은 승인 기록이나 같은 연결·범위 항목을 담았다는 뜻은 아닙니다. 값이 다르면 그 범위 안의 무언가가 달랐다는 뜻입니다. 어느 쪽도 자료의 진위나 실제 시장과의 일치를 보증하지는 않습니다.",
  },
  rawRow: {
    label: "원본 행 해시",
    covers:
      "이 거래 기록이 나온 원본 행의 위치 정보와 읽어들인 열 값입니다. 파일 원본 바이트는 원본 자료 해시가 맡습니다.",
    proves:
      "값이 같으면 이 거래 기록이 여전히 그 커밋된 행으로 이어진다는 뜻입니다. 다르면 기록을 만든 뒤에 행 위치나 읽어들인 값이 바뀌었다는 뜻입니다.",
  },
};

const hashScopes = (language: Language) =>
  language === "ko" ? HASH_SCOPES_KO : HASH_SCOPES;

/** Abbreviate for reading. The exact value stays available beside it. */
export function abbreviateHash(value: string): string {
  return value.length > 20 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
}

/**
 * Basis points to their plain-language percentage, by shifting the decimal
 * point two places. String arithmetic only: no float ever touches a displayed
 * value. Returns null for anything that is not a decimal string.
 */
export function bpsToPercent(value: string): string | null {
  const parsed = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!parsed) return null;
  const [, sign, whole, fraction = ""] = parsed;
  let digits = `${whole}${fraction}`;
  let point = whole!.length - 2;
  if (point <= 0) {
    digits = `${"0".repeat(1 - point)}${digits}`;
    point = 1;
  }
  const whole_part = digits.slice(0, point);
  // Trailing zeros are dropped below two decimal places only, so the rendered
  // percentage carries the same value as the basis-point string it came from.
  const fraction_part = digits.slice(point).replace(/(\d\d)0+$/, "$1");
  return `${sign}${whole_part}.${fraction_part}`;
}

/**
 * Render an instant a reviewer can read without decoding it, from the exact
 * canonical string. Anything that does not match the canonical shape is
 * returned unchanged rather than reformatted into something it is not.
 */
export function readableInstant(value: string): string {
  const parsed =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!parsed) return value;
  const [, date, time, offset] = parsed;
  return `${date} ${time} (${offset === "Z" ? "UTC" : `UTC${offset}`})`;
}

/** Publisher-format trading dates (YYYYMMDD) as a reviewer reads them. */
export function readableCompactDate(value: string): string {
  const parsed = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  return parsed ? `${parsed[1]}-${parsed[2]}-${parsed[3]}` : value;
}

export function HashValue({
  scope,
  value,
  label,
}: {
  scope: HashScope;
  value: string;
  label?: string;
}) {
  const language = useReplayLanguage();
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const { covers, proves } = hashScopes(language)[scope];
  const name = label ?? hashScopes(language)[scope].label;
  return (
    <div className="machine-hash">
      <span className="machine-label">{name}</span>
      <code className="machine-abbrev">{abbreviateHash(value)}</code>
      <p className="machine-note">
        {language === "ko"
          ? `이 해시가 덮는 범위: ${covers}`
          : `Covers ${covers}`}
      </p>
      <details>
        <summary>
          {language === "ko"
            ? "전체 값 보기"
            : `Show the full ${name.toLowerCase()}`}
        </summary>
        <code className="machine-full">{value}</code>
        <button
          className="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => setCopiedValue(value),
              () => setCopiedValue(null),
            );
          }}
          type="button"
        >
          {copiedValue === value
            ? language === "ko"
              ? "전체 값을 복사했습니다"
              : "Copied the full value"
            : language === "ko"
              ? "전체 값 복사"
              : "Copy the full value"}
        </button>
        <p className="machine-note">{proves}</p>
      </details>
    </div>
  );
}

export function Instant({ value }: { value: string }) {
  const readable = readableInstant(value);
  if (readable === value) return <code>{value}</code>;
  return (
    <span className="machine-instant">
      <time dateTime={value}>{readable}</time>
      <code>{value}</code>
    </span>
  );
}

/**
 * What each gate tests, the unit its values carry, and how its threshold is
 * compared. Every gate in this rule passes at or above its threshold.
 */
export const GATE_READINGS = {
  PRICE_CHANGE: {
    unit: "bps",
    label: "Price rise",
    tests:
      "Peak price rise from the first eligible trade, in basis points (100 bps = 1%).",
  },
  AGGRESSIVE_BUY_SHARE: {
    unit: "bps",
    label: "Aggressive buy share",
    tests:
      "Share of eligible trade value (price × quantity) from BUY events, in basis points.",
  },
  ACTOR_CONCENTRATION: {
    unit: "bps",
    label: "Actor concentration",
    tests:
      "Share of BUY trade value from the approved actor group, in basis points.",
  },
  REPEATED_EXECUTION: {
    unit: "count",
    label: "Repeated execution",
    tests:
      "Number of approved-actor aggressive buys above the reference price.",
  },
  REMOVAL_SENSITIVITY: {
    unit: "bps",
    label: "Change without the approved actors",
    tests:
      "Difference in price-rise basis points when the approved actor group's trades are removed; a mechanical comparison.",
  },
} as const;

export type GateName = keyof typeof GATE_READINGS;

/**
 * The same five checks named the way the product describes them in Korean, so
 * a reader meets a check by what it measures before meeting its identifier.
 */
export const GATE_READINGS_KO: Readonly<
  Record<GateName, { label: string; tests: string }>
> = {
  PRICE_CHANGE: {
    label: "가격 상승 정도",
    tests:
      "조사 구간의 첫 거래 이후 가격이 가장 많이 오른 폭입니다. 단위는 bp이고 100bp가 1%입니다.",
  },
  AGGRESSIVE_BUY_SHARE: {
    label: "매수 집중 정도",
    tests:
      "조사 대상 거래대금(가격 × 수량) 가운데 매수 거래가 차지하는 비중입니다. 단위는 bp입니다.",
  },
  ACTOR_CONCENTRATION: {
    label: "특정 거래 주체의 집중 정도",
    tests:
      "매수 거래대금 가운데 승인된 조사 대상 거래 주체가 차지하는 비중입니다. 단위는 bp입니다.",
  },
  REPEATED_EXECUTION: {
    label: "반복 거래 횟수",
    tests: "조사 대상 거래 주체가 기준 가격 위에서 매수한 횟수입니다.",
  },
  REMOVAL_SENSITIVITY: {
    label: "조사 대상을 뺐을 때의 변화",
    tests:
      "조사 대상 거래 주체의 거래를 빼고 다시 계산했을 때 가격 상승 폭이 얼마나 달라지는지입니다. 원인을 가리는 것이 아니라 기계적인 비교입니다.",
  },
};

/** What a gate measures, in the reader's language. */
export function gateReading(
  gate: GateName,
  language: Language,
): { label: string; tests: string } {
  return language === "ko" ? GATE_READINGS_KO[gate] : GATE_READINGS[gate];
}

/**
 * Reported rates are truncated to four fractional digits, while the engine
 * compares and subtracts the exact ratio. A reported value can therefore sit
 * just below a threshold it passes, and the panel says so rather than letting
 * the reported value be read as the comparison operand.
 */
export const REPORTED_VALUE_NOTE =
  "Rates are reported truncated to four decimals. Every verdict and difference is computed on the exact value, so a reported value can sit just below a threshold it passes.";

export const REPORTED_VALUE_NOTE_KO =
  "화면에 보이는 비율은 소수점 넷째 자리에서 자른 값입니다. 통과 여부와 차이는 자르지 않은 정확한 값으로 계산하므로, 통과한 항목이라도 표시된 값은 기준선보다 살짝 낮아 보일 수 있습니다.";

export const reportedValueNote = (language: Language) =>
  language === "ko" ? REPORTED_VALUE_NOTE_KO : REPORTED_VALUE_NOTE;

export function Bps({ value }: { value: string }) {
  const percent = bpsToPercent(value);
  return (
    <span className="machine-measure">
      {value} bps{percent === null ? "" : ` (${percent}%)`}
    </span>
  );
}

export function GateReading({
  gate,
  observedValue,
  threshold,
}: {
  gate: GateName;
  observedValue: string;
  threshold: string;
}) {
  const language = useReplayLanguage();
  const { unit } = GATE_READINGS[gate];
  if (unit === "count")
    return language === "ko" ? (
      <span>
        관측값 {observedValue} · 기준 {threshold} 이상이면 충족
      </span>
    ) : (
      <span>
        Observed {observedValue} · passes at {threshold} or more
      </span>
    );
  return language === "ko" ? (
    <span>
      관측값 <Bps value={observedValue} /> · 기준 <Bps value={threshold} />{" "}
      이상이면 충족
    </span>
  ) : (
    <span>
      Observed <Bps value={observedValue} /> · passes at{" "}
      <Bps value={threshold} /> or more
    </span>
  );
}

/**
 * What each canonical event field is, stated where the field is displayed.
 * Units come from the contract: prices and quantities are exact decimal
 * strings, and no source carries a currency, so none is shown.
 */
export const EVENT_FIELD_NOTES: Record<string, string> = {
  eventId:
    "Canonical identity: dataset, venue and source event identity joined. Not a hash.",
  sourceEventId: "The identifier the source assigned to this record.",
  eventTime:
    "The instant the source reported, normalized to UTC by the engine. The source's own offset stays in the committed source row below.",
  price:
    "Executed price per unit, as an exact decimal string. The source carries no currency.",
  quantity: "Executed quantity, in units, as an exact decimal string.",
  sequence:
    "The source's own ordering value, and the canonical secondary sort key: canonical order sorts by event time, then by this value when two events share a time, then by canonical identity.",
};

export const EVENT_FIELD_NOTES_KO: Record<string, string> = {
  eventId:
    "정리된 거래 기록의 고유 이름입니다. 데이터셋과 시장, 원본이 붙인 식별자를 이어 붙인 값이며 해시가 아닙니다.",
  sourceEventId: "원본 자료가 이 기록에 붙여 둔 식별자입니다.",
  eventTime:
    "원본이 알려 온 시각을 UTC로 맞춘 값입니다. 원본이 쓰던 시간대는 아래 커밋된 원본 행에 그대로 남아 있습니다.",
  price:
    "한 단위당 체결 가격이며, 반올림 없는 정확한 문자열입니다. 원본에 통화 표시가 없어 통화는 붙이지 않습니다.",
  quantity: "체결 수량이며, 반올림 없는 정확한 문자열입니다.",
  sequence:
    "원본이 매겨 둔 순서 값이자 정렬의 두 번째 기준입니다. 먼저 체결 시각으로 정렬하고, 시각이 같으면 이 값으로, 그래도 같으면 기록의 고유 이름으로 정렬합니다.",
};

/** What a canonical event field is, in the reader's language. */
export function eventFieldNote(
  field: string,
  language: Language,
): string | undefined {
  return language === "ko"
    ? EVENT_FIELD_NOTES_KO[field]
    : EVENT_FIELD_NOTES[field];
}
