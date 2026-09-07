"use client";

import Link from "next/link";
import React from "react";

import { useLanguage } from "../i18n/language";
import type { SessionDay } from "../../lib/published-case";
import { SessionPathChart } from "./session-chart";

export type HomeEventProps = {
  spot: SessionDay;
  future: SessionDay;
  previousClose: string;
};

const copy = {
  ko: {
    kicker: "실제 있었던 하루",
    heading: "종가만 보면, 평범한 하루였습니다.",
    body: "2026년 9월 3일 코스피200은 전일보다 높게 끝났습니다. 그런데 같은 날 안에서 1050.77까지 올랐다가 1009.7까지 내려갔고, 1032.82로 돌아와 끝났습니다. 선물도 같은 모양이었습니다.",
    ask: "이 하루가 정말 특별했을까요? 저희는 답을 내주지 않습니다. 대신 그 답을 직접 확인하는 절차를 보여 드립니다.",
    action: "이 사건 확인하러 가기",
    stats: [
      ["시가", "1046.17"],
      ["고가", "1050.77"],
      ["저가", "1009.7"],
      ["종가", "1032.82"],
    ] as const,
    chartNote:
      "금융위원회가 공개한 일별 값입니다. 시가와 종가만 시각이 정해져 있고, 고가와 저가가 언제 나왔는지는 일별 자료에 없습니다. 그 구간을 점선으로 둔 이유입니다.",
    legs: ["코스피 200", "코스피200 선물"] as const,
  },
  en: {
    kicker: "One real session",
    heading: "On the close alone, an ordinary day.",
    body: "On 3 September 2026 the KOSPI 200 finished above the day before. Inside that same day it reached 1050.77, fell to 1009.7, and came back to close at 1032.82. The front-month future did the same thing.",
    ask: "Was that day unusual? We do not hand you the answer. We show you the procedure for checking it yourself.",
    action: "Look into this session",
    stats: [
      ["Open", "1046.17"],
      ["High", "1050.77"],
      ["Low", "1009.7"],
      ["Close", "1032.82"],
    ] as const,
    chartNote:
      "Published daily values from the FSC. Only the open and the close are fixed in time; a daily record does not say when the high and the low happened, which is why that stretch is dashed.",
    legs: ["KOSPI 200", "KOSPI 200 future"] as const,
  },
};

/**
 * The entry screen turns from what the product is to what it did here, so this
 * is the first concrete thing on the page and the only block carrying a chart.
 * Every figure in it is a committed published value; nothing the rule computes
 * appears on the home page.
 */
export function HomeEvent({ spot, future, previousClose }: HomeEventProps) {
  const { language } = useLanguage();
  const text = copy[language];
  return (
    <section className="shell event-teaser" aria-labelledby="home-event">
      <div className="event-copy">
        <span className="event-kicker">{text.kicker}</span>
        <h2 id="home-event">{text.heading}</h2>
        <p className="event-body">{text.body}</p>
        <dl className="event-stats">
          {text.stats.map(([label, value]) => (
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
        <SessionPathChart
          compact
          language={language}
          legs={[
            { name: text.legs[0], day: spot },
            { name: text.legs[1], day: future },
          ]}
          note={text.chartNote}
          previousClose={previousClose}
        />
      </div>
    </section>
  );
}
