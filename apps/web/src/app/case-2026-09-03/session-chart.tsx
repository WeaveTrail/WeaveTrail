import React from "react";

import { type Language } from "../i18n/language";
import type { SessionDay } from "../../lib/published-case";

/**
 * Every value drawn here is a committed published price, read from the source
 * artifact. Floating point is used for pixel geometry only: no displayed value,
 * comparison or threshold is computed from these numbers, and every label below
 * prints the exact committed string.
 */
const px = (value: string) => Number.parseFloat(value);

const readableDate = (compact: string) =>
  `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;

type Scale = (value: string) => number;

function verticalScale(
  values: readonly string[],
  top: number,
  bottom: number,
): Scale {
  const numbers = values.map(px);
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  const span = high - low || 1;
  const pad = span * 0.12;
  const min = low - pad;
  const max = high + pad;
  return (value) => bottom - ((px(value) - min) / (max - min)) * (bottom - top);
}

/**
 * One trading day drawn from its four published prices, with the previous
 * close beside them. The shape is the whole point: where the day opened, how
 * far it reached, how far it fell back, and where it finished against the day
 * before.
 */
export function SessionDayChart({
  caption,
  day,
  previousClose,
  language,
}: {
  caption: string;
  day: SessionDay;
  /** Omitted where the artifact commits one trading day and no day before it. */
  previousClose?: string;
  language: Language;
}) {
  const top = 28;
  const bottom = 196;
  const y = verticalScale(
    [
      day.high,
      day.low,
      day.open,
      day.close,
      ...(previousClose ? [previousClose] : []),
    ],
    top,
    bottom,
  );
  const rose = !day.netChange.startsWith("-");
  const t = (en: string, ko: string) => (language === "ko" ? ko : en);
  const label = {
    open: t("Open", "시가"),
    high: t("High", "고가"),
    low: t("Low", "저가"),
    close: t("Close", "종가"),
    previous: t("Previous close", "전일 종가"),
  };
  return (
    <figure className="session-figure">
      <figcaption>{caption}</figcaption>
      <svg
        aria-label={`${caption}: ${label.open} ${day.open}, ${label.high} ${day.high}, ${label.low} ${day.low}, ${label.close} ${day.close}`}
        className="session-svg"
        role="img"
        viewBox="0 0 340 224"
      >
        {previousClose ? (
          <>
            <line
              className="session-previous"
              x1="16"
              x2="324"
              y1={y(previousClose)}
              y2={y(previousClose)}
            />
            <text className="session-tick" x="16" y={y(previousClose) - 6}>
              {label.previous} {previousClose}
            </text>
          </>
        ) : null}
        <line
          className="session-range"
          x1="150"
          x2="150"
          y1={y(day.high)}
          y2={y(day.low)}
        />
        <line
          className="session-mark"
          x1="126"
          x2="150"
          y1={y(day.open)}
          y2={y(day.open)}
        />
        <line
          className="session-mark"
          x1="150"
          x2="174"
          y1={y(day.close)}
          y2={y(day.close)}
        />
        <text
          className="session-value"
          textAnchor="end"
          x="120"
          y={y(day.open) + 4}
        >
          {label.open} {day.open}
        </text>
        <text className="session-value" x="180" y={y(day.close) + 4}>
          {label.close} {day.close}
        </text>
        <text
          className="session-value"
          textAnchor="middle"
          x="150"
          y={y(day.high) - 8}
        >
          {label.high} {day.high}
        </text>
        <text
          className="session-value"
          textAnchor="middle"
          x="150"
          y={y(day.low) + 16}
        >
          {label.low} {day.low}
        </text>
        <line
          className="session-giveback"
          x1="252"
          x2="252"
          y1={y(day.high)}
          y2={y(day.close)}
        />
        <text
          className="session-annotation"
          data-direction="fall"
          x="258"
          y={(y(day.high) + y(day.close)) / 2}
        >
          {t("high to close", "고가 → 종가")}
        </text>
        <text
          className="session-annotation"
          data-direction={rose ? "rise" : "fall"}
          textAnchor="end"
          x="324"
          y={y(day.close) + 4}
        >
          {t("vs previous close", "전일 대비")} {day.netChange}
        </text>
      </svg>
    </figure>
  );
}

/**
 * Every trading day in the approved baseline range, each drawn as its published
 * high-to-low span with a mark at its close. The analysed date is the only one
 * coloured; nothing here is ranked or scored, because ranking is the rule's
 * work and it has not run yet.
 */
export function BaselineRangeChart({
  caption,
  days,
  analysedDate,
  language,
}: {
  caption: string;
  days: readonly SessionDay[];
  analysedDate: string;
  language: Language;
}) {
  const top = 20;
  const bottom = 176;
  const left = 12;
  const right = 708;
  const y = verticalScale(
    days.flatMap(({ high, low }) => [high, low]),
    top,
    bottom,
  );
  const step = (right - left) / Math.max(days.length - 1, 1);
  const t = (en: string, ko: string) => (language === "ko" ? ko : en);
  return (
    <figure className="session-figure">
      <figcaption>{caption}</figcaption>
      <svg
        aria-label={t(
          `Published daily high-to-low span for ${days.length} trading days, with ${analysedDate} marked`,
          `${days.length}거래일의 발행처 공개 고가–저가 구간이며 ${analysedDate}이 표시되어 있습니다`,
        )}
        className="session-svg"
        role="img"
        viewBox="0 0 720 200"
      >
        {days.map((entry, index) => {
          const x = left + index * step;
          const analysed = readableDate(entry.tradingDate) === analysedDate;
          return (
            <g key={entry.tradingDate} data-analysed={analysed}>
              <line
                className="baseline-span"
                x1={x}
                x2={x}
                y1={y(entry.high)}
                y2={y(entry.low)}
              />
              <circle
                className="baseline-close"
                cx={x}
                cy={y(entry.close)}
                r="1.8"
              />
            </g>
          );
        })}
        <text
          className="session-tick"
          textAnchor="end"
          x={right}
          y={bottom + 20}
        >
          {analysedDate}
        </text>
        <text className="session-tick" x={left} y={bottom + 20}>
          {readableDate(days[0]!.tradingDate)}
        </text>
      </svg>
    </figure>
  );
}
