import React from "react";

import { type Language } from "../i18n/language";
import type { SessionDay } from "../../lib/published-case";

/**
 * Every value drawn here is a committed published price, read from the source
 * artifact and printed beside its mark as the exact committed string.
 *
 * No price is ever converted to binary floating point. Each decimal string is
 * parsed to a scaled integer at one common scale, and the span, the padding and
 * the offset are all computed in that integer space. The single division is the
 * last step, on the unitless fraction an SVG coordinate needs, after every
 * price arithmetic is done.
 */
const DECIMAL_SCALE = 6n;

export function scaledPrice(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole = "", fraction = ""] = value.replace("-", "").split(".");
  const padded = `${fraction}${"0".repeat(Number(DECIMAL_SCALE))}`.slice(
    0,
    Number(DECIMAL_SCALE),
  );
  const magnitude = BigInt(`${whole === "" ? "0" : whole}${padded}`);
  return negative ? -magnitude : magnitude;
}

const readableDate = (compact: string) =>
  `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;

type Scale = (value: string) => number;

/** Ratio precision for the one division; well inside a double's exact range. */
const RATIO_UNITS = 1_000_000n;

export function verticalScale(
  values: readonly string[],
  top: number,
  bottom: number,
): Scale {
  const scaled = values.map(scaledPrice);
  let low = scaled[0]!;
  let high = scaled[0]!;
  for (const value of scaled) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  const span = high - low;
  const padding = span === 0n ? 1n : (span * 12n) / 100n;
  const minimum = low - padding;
  const range = high + padding - minimum;
  const height = bottom - top;
  return (value) => {
    const offset = scaledPrice(value) - minimum;
    const fraction =
      Number((offset * RATIO_UNITS) / range) / Number(RATIO_UNITS);
    return bottom - fraction * height;
  };
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

/**
 * The session as it actually ran, minute by minute.
 *
 * Drawn from `intraday-session.ts`, which is presentation only: it is never
 * hashed, approved or read by a rule. The three values this line reaches — the
 * high, the low and the close — are the same three the committed daily record
 * carries, which is why the picture and the evidence below agree without the
 * picture being evidence.
 */
export function IntradaySessionChart({
  caption,
  note,
  points,
  low,
  high,
  labels,
  compact = false,
}: {
  caption?: string;
  note?: string;
  points: readonly { time: string; close: string }[];
  low: { time: string; value: string };
  high: { time: string; value: string };
  labels: { low: string; high: string; close: string };
  compact?: boolean;
}) {
  const width = 720;
  const top = compact ? 18 : 34;
  const bottom = compact ? 120 : 178;
  const left = 8;
  const right = width - (compact ? 8 : 128);
  const y = verticalScale(
    points.map(({ close }) => close),
    top,
    bottom,
  );
  const step = (right - left) / Math.max(points.length - 1, 1);
  const at = (index: number) => left + index * step;
  const line = points
    .map(
      ({ close }, index) =>
        `${index === 0 ? "M" : "L"} ${at(index).toFixed(1)} ${y(close).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L ${at(points.length - 1).toFixed(1)} ${bottom} L ${left} ${bottom} Z`;
  const indexOf = (time: string) =>
    points.findIndex((point) => point.time === time);
  const last = points[points.length - 1]!;
  const marks = [
    {
      at: indexOf(high.time),
      value: high.value,
      label: labels.high,
      time: high.time,
      place: -14,
    },
    {
      at: indexOf(low.time),
      value: low.value,
      label: labels.low,
      time: low.time,
      place: 22,
    },
  ];
  return (
    <figure className={compact ? "session-figure compact" : "session-figure"}>
      {caption ? <figcaption>{caption}</figcaption> : null}
      <svg
        aria-label={`${caption ?? ""} ${labels.high} ${high.value} ${high.time}. ${labels.low} ${low.value} ${low.time}. ${labels.close} ${last.close} ${last.time}.`}
        className="session-svg"
        role="img"
        viewBox={`0 0 ${width} ${compact ? 138 : 210}`}
      >
        <path className="intraday-area" d={area} />
        <path className="intraday-line" d={line} />
        {marks.map((mark) =>
          mark.at < 0 ? null : (
            <g key={mark.label}>
              <line
                className="intraday-guide"
                x1={at(mark.at)}
                x2={at(mark.at)}
                y1={y(mark.value)}
                y2={bottom}
              />
              <circle
                className="intraday-mark"
                cx={at(mark.at)}
                cy={y(mark.value)}
                r={compact ? 3 : 4.5}
              />
              {/* The two extremes are the point of the chart, so they are
                  named in both forms rather than left as bare marks. */}
              <text
                className="session-value"
                textAnchor="middle"
                x={at(mark.at)}
                y={y(mark.value) + mark.place}
              >
                {mark.label} {mark.value} · {mark.time}
              </text>
            </g>
          ),
        )}
        {compact ? null : (
          <>
            <text className="session-value" x={right + 8} y={y(last.close) + 4}>
              {labels.close} {last.close}
            </text>
            <text className="session-tick" x={left} y={bottom + 22}>
              {points[0]!.time}
            </text>
            <text
              className="session-tick"
              textAnchor="end"
              x={right}
              y={bottom + 22}
            >
              {last.time}
            </text>
          </>
        )}
      </svg>
      {note ? <p className="session-note">{note}</p> : null}
    </figure>
  );
}
