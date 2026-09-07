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

/**
 * Two closes a couple of index points apart land within a few pixels of each
 * other, so their labels would overprint. Placement keeps the reading order and
 * pushes each label down to a minimum gap; the marks themselves stay exactly
 * where the value puts them.
 */
const LABEL_GAP = 14;

export function spaced<T extends { y: number }>(labels: readonly T[]): T[] {
  const ordered = [...labels].sort((left, right) => left.y - right.y);
  let previous = Number.NEGATIVE_INFINITY;
  return ordered.map((label) => {
    const y = Math.max(label.y, previous + LABEL_GAP);
    previous = y;
    return { ...label, y };
  });
}

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
 * Both legs of the session, drawn from the four published prices.
 *
 * A daily record carries no intraday time, so the chart never orders the two
 * extremes. What it draws is the band the session traded inside — its high and
 * its low — and the line from the open to the close, whose two endpoints are
 * the only moments the record actually fixes. The distance between a tall band
 * and a nearly flat line is the whole observation, and none of it claims to
 * know when the day reached either edge.
 */
export function SessionPathChart({
  caption,
  note,
  legs,
  previousClose,
  language,
  compact = false,
}: {
  caption?: string;
  note?: string;
  legs: readonly { name: string; day: SessionDay }[];
  /** A prior close belongs to one leg, so a caller has to name which. */
  previousClose?: { value: string; label: string };
  language: Language;
  compact?: boolean;
}) {
  const width = 720;
  const top = compact ? 18 : 30;
  const bottom = compact ? 128 : 190;
  const left = 8;
  const right = width - (compact ? 8 : 150);
  const y = verticalScale(
    [
      ...legs.flatMap(({ day }) => [day.high, day.low, day.open, day.close]),
      ...(previousClose ? [previousClose.value] : []),
    ],
    top,
    bottom,
  );
  const t = (en: string, ko: string) => (language === "ko" ? ko : en);
  return (
    <figure className={compact ? "session-figure compact" : "session-figure"}>
      {caption ? <figcaption>{caption}</figcaption> : null}
      <svg
        aria-label={[
          ...legs.map(({ name, day }) =>
            t(
              `${name}: opened ${day.open} and closed ${day.close}, trading between a session high of ${day.high} and a session low of ${day.low}. The daily record does not say when either extreme occurred. ${day.netChange} against the previous close.`,
              `${name}: 시가 ${day.open}, 종가 ${day.close}. 그날 고가 ${day.high}와 저가 ${day.low} 사이에서 움직였습니다. 두 값이 언제 나왔는지는 일별 자료에 없습니다. 전일 대비 ${day.netChange}.`,
            ),
          ),
          // The reference line is a mark on the chart, so it is named wherever
          // it is drawn, including the compact form that has no room for text.
          ...(previousClose
            ? [
                t(
                  `A dashed line marks the ${previousClose.label}, ${previousClose.value}.`,
                  `점선은 ${previousClose.label} ${previousClose.value}입니다.`,
                ),
              ]
            : []),
        ].join(" ")}
        className="session-svg"
        role="img"
        viewBox={`0 0 ${width} ${compact ? 148 : 226}`}
      >
        {legs.map(({ name, day }, index) => (
          <g className="session-leg" data-leg={index} key={`band-${name}`}>
            <rect
              className="session-band"
              height={Math.max(y(day.low) - y(day.high), 1)}
              width={right - left}
              x={left}
              y={y(day.high)}
            />
            <line
              className="session-extreme"
              x1={left}
              x2={right}
              y1={y(day.high)}
              y2={y(day.high)}
            />
            <line
              className="session-extreme"
              x1={left}
              x2={right}
              y1={y(day.low)}
              y2={y(day.low)}
            />
          </g>
        ))}
        {previousClose ? (
          <>
            <line
              className="session-previous"
              x1={left}
              x2={right}
              y1={y(previousClose.value)}
              y2={y(previousClose.value)}
            />
            <text
              className="session-tick"
              x={compact ? left + 4 : right + 8}
              y={y(previousClose.value) - 5}
            >
              {previousClose.label} {previousClose.value}
            </text>
          </>
        ) : null}
        {legs.map(({ name, day }, index) => (
          <g className="session-leg" data-leg={index} key={`line-${name}`}>
            <line
              className="session-path"
              x1={left}
              x2={right}
              y1={y(day.open)}
              y2={y(day.close)}
            />
            <circle
              className="session-point"
              cx={left}
              cy={y(day.open)}
              r={compact ? 3 : 4}
            />
            <circle
              className="session-point"
              cx={right}
              cy={y(day.close)}
              r={compact ? 3 : 4}
            />
          </g>
        ))}
        {compact
          ? null
          : spaced(
              legs.map(({ name, day }, index) => ({
                key: name,
                leg: index,
                text: `${name} ${day.close}`,
                y: y(day.close) + 4,
              })),
            ).map((label) => (
              <text
                className="session-value session-leg"
                data-leg={label.leg}
                key={label.key}
                x={right + 8}
                y={label.y}
              >
                {label.text}
              </text>
            ))}
        {compact
          ? null
          : legs.slice(0, 1).map(({ day }) => (
              <g key="edges">
                <text
                  className="session-value"
                  x={left + 6}
                  y={y(day.high) - 8}
                >
                  {t("session high", "그날 고가")} {day.high}
                </text>
                <text
                  className="session-value"
                  x={left + 6}
                  y={y(day.low) + 18}
                >
                  {t("session low", "그날 저가")} {day.low}
                </text>
                <text className="session-tick" x={left} y={bottom + 26}>
                  {t("open", "시가")} {day.open}
                </text>
                <text
                  className="session-tick"
                  textAnchor="end"
                  x={right}
                  y={bottom + 26}
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

/**
 * A diagram of the shape the rule looks for, drawn with no values and no
 * instrument.
 *
 * It is not this session, and it is not any session: it carries no price, no
 * time and no name, and its caption says so. What it shows is the quantity the
 * rule measures — the distance from a session's high back down to its close —
 * so a reader meets the idea before meeting the number. Every figure that
 * belongs to the real day is drawn from the committed record elsewhere on the
 * page, never from here.
 */
export function ReversalDiagram({
  caption,
  labels,
  note,
}: {
  caption: string;
  labels: {
    previousClose: string;
    high: string;
    close: string;
    reversal: string;
  };
  note: string;
}) {
  const baseline = 132;
  const path =
    "M 24 132 C 90 128, 120 62, 176 58 S 250 176, 300 168 S 396 106, 452 100";
  return (
    <figure className="session-figure reversal-diagram">
      <figcaption>{caption}</figcaption>
      <svg
        aria-label={`${caption}. ${note}`}
        className="session-svg"
        role="img"
        viewBox="0 0 520 200"
      >
        <line
          className="session-previous"
          x1="24"
          x2="452"
          y1={baseline}
          y2={baseline}
        />
        <text className="session-tick" x="24" y={baseline + 18}>
          {labels.previousClose}
        </text>
        <path className="diagram-path" d={path} />
        <circle className="diagram-point" cx="176" cy="58" r="5" />
        <text className="session-value" textAnchor="middle" x="176" y="44">
          {labels.high}
        </text>
        <circle className="diagram-point" cx="452" cy="100" r="5" />
        <text className="session-value" x="462" y="104">
          {labels.close}
        </text>
        {/* The measured quantity: high back down to close. */}
        <line className="diagram-measure" x1="490" x2="490" y1="58" y2="100" />
        <line className="diagram-measure" x1="484" x2="496" y1="58" y2="58" />
        <line className="diagram-measure" x1="484" x2="496" y1="100" y2="100" />
        <text
          className="session-annotation"
          data-direction="fall"
          textAnchor="end"
          x="480"
          y="83"
        >
          {labels.reversal}
        </text>
      </svg>
      <p className="session-note">{note}</p>
    </figure>
  );
}
