"use client";

import Link from "next/link";
import React from "react";

import { useLanguage } from "../i18n/language";
import type { SessionDay } from "../../lib/published-case";
import {
  INTRADAY_HIGH,
  INTRADAY_LOW,
  INTRADAY_SESSION,
} from "./intraday-session";
import { IntradaySessionChart } from "./session-chart";

export type HomeEventProps = {
  spot: SessionDay;
};

const copy = {
  ko: {
    kicker: "실제 있었던 하루",
    heading: "종가만 보면, 평범한 하루였습니다.",
    body: (day: SessionDay) =>
      `2026년 9월 3일 코스피200은 전일보다 높게 끝났습니다. 그런데 같은 날 안에서 고가 ${day.high}과 저가 ${day.low} 사이를 오갔고, 시가 ${day.open}보다 낮은 ${day.close}로 끝났습니다. 선물도 같은 모양이었습니다.`,
    ask: "이 하루가 정말 특별했을까요? 저희는 답을 내주지 않습니다. 대신 그 답을 직접 확인하는 절차를 보여 드립니다.",
    action: "이 사건 확인하러 가기",
    statLabels: ["시가", "고가", "저가", "종가"] as const,
    chartNote:
      "2026-09-03 코스피 200, 09:00–15:30을 1분 간격으로 저희가 직접 그렸습니다. 이 그래프는 판단에 쓰이지 않습니다.",
    chartLabels: { low: "저가", high: "고가", close: "종가" },
  },
  en: {
    kicker: "One real session",
    heading: "On the close alone, an ordinary day.",
    body: (day: SessionDay) =>
      `On 3 September 2026 the KOSPI 200 finished above the day before. Inside that same day it traded between a high of ${day.high} and a low of ${day.low}, and finished at ${day.close}, below its open of ${day.open}. The front-month future did the same thing.`,
    ask: "Was that day unusual? We do not hand you the answer. We show you the procedure for checking it yourself.",
    action: "Look into this session",
    statLabels: ["Open", "High", "Low", "Close"] as const,
    chartNote:
      "KOSPI 200 on 2026-09-03, 09:00-15:30, drawn by us in one-minute steps. This chart takes no part in the checks.",
    chartLabels: { low: "low", high: "high", close: "close" },
  },
};

/**
 * The entry screen turns from what the product is to what it did here, so this
 * is the first concrete thing on the page and the only block carrying a chart.
 * Every figure in it is a committed published value; nothing the rule computes
 * appears on the home page.
 */
export function HomeEvent({ spot }: HomeEventProps) {
  const { language } = useLanguage();
  const text = copy[language];
  return (
    <section className="shell event-teaser" aria-labelledby="home-event">
      <div className="event-copy">
        <span className="event-kicker">{text.kicker}</span>
        <h2 id="home-event">{text.heading}</h2>
        <p className="event-body">{text.body(spot)}</p>
        {/* Read from the committed row rather than restated here, so a
            correction to the artifact cannot leave the old figures attached to
            a real instrument. */}
        <dl className="event-stats">
          {(
            [
              [text.statLabels[0], spot.open],
              [text.statLabels[1], spot.high],
              [text.statLabels[2], spot.low],
              [text.statLabels[3], spot.close],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="event-ask">{text.ask}</p>
        <Link className="button primary" href="/case-2026-09-03">
          {text.action}
        </Link>
      </div>
      <div className="event-figure">
        <IntradaySessionChart
          compact
          high={INTRADAY_HIGH}
          labels={text.chartLabels}
          low={INTRADAY_LOW}
          note={text.chartNote}
          points={INTRADAY_SESSION}
        />
      </div>
    </section>
  );
}
