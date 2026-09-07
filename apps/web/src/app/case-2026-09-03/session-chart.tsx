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
        aria-label={[
          caption,
          `${label.open} ${day.open}`,
          `${label.high} ${day.high}`,
          `${label.low} ${day.low}`,
          `${label.close} ${day.close}`,
          ...(previousClose ? [`${label.previous} ${previousClose}`] : []),
          // The page's claim rests on these two relations, so the accessible
          // name carries them rather than the four prices alone.
          t(
            `the session ran from its high ${day.high} back down to its close ${day.close}`,
            `장중 고가 ${day.high}에서 종가 ${day.close}까지 되돌렸습니다`,
          ),
          t(
            `against the previous close it changed by ${day.netChange}`,
            `전일 종가 대비 변화는 ${day.netChange}입니다`,
          ),
        ].join(". ")}
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

/**
 * Both legs of the session as one path.
 *
 * Daily records carry no intraday time, so only the open and the close are
 * placed on the time axis, at the ends where they belong. The high and the low
 * are the session's extremes and their moment is unknown, so the segments that
 * reach them are dashed and the caption says why. This is the shape of the
 * day, not a record of when the day did it.
 */
export function SessionPathChart({
  caption,
  note,
  legs,
  previousClose,
  previousCloseLabel,
  language,
  compact = false,
}: {
  caption?: string;
  note?: string;
  legs: readonly { name: string; day: SessionDay }[];
  previousClose?: string;
  previousCloseLabel?: string;
  language: Language;
  compact?: boolean;
}) {
  const width = 720;
  const top = compact ? 16 : 28;
  const bottom = compact ? 132 : 200;
  const left = 8;
  const right = width - (compact ? 8 : 96);
  const y = verticalScale(
    [
      ...legs.flatMap(({ day }) => [day.high, day.low, day.open, day.close]),
      ...(previousClose ? [previousClose] : []),
    ],
    top,
    bottom,
  );
  const t = (en: string, ko: string) => (language === "ko" ? ko : en);
  // Four positions across the session. Only the first and the last are claims
  // about time; the middle two are ordered so the path reads as one stroke.
  const at = [
    left,
    left + (right - left) * 0.34,
    left + (right - left) * 0.66,
    right,
  ];
  const path = (day: SessionDay) => {
    const fell = scaledPrice(day.close) < scaledPrice(day.open);
    const middle = fell ? [y(day.high), y(day.low)] : [y(day.low), y(day.high)];
    return {
      middle,
      points: [y(day.open), middle[0]!, middle[1]!, y(day.close)],
    };
  };
  return (
    <figure className={compact ? "session-figure compact" : "session-figure"}>
      {caption ? <figcaption>{caption}</figcaption> : null}
      <svg
        aria-label={legs
          .map(({ name, day }) =>
            t(
              `${name}: opened ${day.open}, reached ${day.high}, fell to ${day.low}, closed ${day.close}, ${day.netChange} against the previous close`,
              `${name}: 시가 ${day.open}, 고가 ${day.high}, 저가 ${day.low}, 종가 ${day.close}, 전일 대비 ${day.netChange}`,
            ),
          )
          .join(". ")}
        className="session-svg"
        role="img"
        viewBox={`0 0 ${width} ${compact ? 150 : 232}`}
      >
        {previousClose ? (
          <>
            <line
              className="session-previous"
              x1={left}
              x2={right}
              y1={y(previousClose)}
              y2={y(previousClose)}
            />
            {compact ? null : (
              <text
                className="session-tick"
                x={right + 6}
                y={y(previousClose) + 4}
              >
                {previousCloseLabel ?? t("previous close", "전일 종가")}{" "}
                {previousClose}
              </text>
            )}
          </>
        ) : null}
        {legs.map(({ name, day }, index) => {
          const { points } = path(day);
          const anchored = `M ${at[0]} ${points[0]} L ${at[1]} ${points[1]}`;
          const dashed = `M ${at[1]} ${points[1]} L ${at[2]} ${points[2]}`;
          const tail = `M ${at[2]} ${points[2]} L ${at[3]} ${points[3]}`;
          return (
            <g className="session-leg" data-leg={index} key={name}>
              <path className="session-path" d={anchored} />
              <path className="session-path estimated" d={dashed} />
              <path className="session-path" d={tail} />
              {points.map((point, order) => (
                <circle
                  className="session-point"
                  cx={at[order]}
                  cy={point}
                  key={order}
                  r={compact ? 3 : 4}
                />
              ))}
              {compact ? null : (
                <text
                  className="session-value"
                  x={right + 6}
                  y={points[3]! + 4}
                >
                  {name} {day.close}
                </text>
              )}
            </g>
          );
        })}
        {compact
          ? null
          : legs.slice(0, 1).map(({ day }) => (
              <g key="extremes">
                <text
                  className="session-value"
                  textAnchor="middle"
                  x={at[1]}
                  y={y(day.high) - 10}
                >
                  {t("high", "고가")} {day.high}
                </text>
                <text
                  className="session-value"
                  textAnchor="middle"
                  x={at[2]}
                  y={y(day.low) + 18}
                >
                  {t("low", "저가")} {day.low}
                </text>
                <text className="session-tick" x={left} y={bottom + 22}>
                  {t("open", "시가")} {day.open}
                </text>
                <text
                  className="session-tick"
                  textAnchor="end"
                  x={right}
                  y={bottom + 22}
                >
                  {t("close", "종가")} {day.close}
                </text>
              </g>
            ))}
      </svg>
      {note ? <p className="session-note">{note}</p> : null}
    </figure>
  );
}
