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
    body: (day: SessionDay) =>
      `2026년 9월 3일 코스피200은 전일보다 높게 끝났습니다. 그런데 같은 날 안에서 고가 ${day.high}과 저가 ${day.low} 사이를 오갔고, 시가 ${day.open}보다 낮은 ${day.close}로 끝났습니다. 선물도 같은 모양이었습니다.`,
    ask: "이 하루가 정말 특별했을까요? 저희는 답을 내주지 않습니다. 대신 그 답을 직접 확인하는 절차를 보여 드립니다.",
    action: "이 사건 확인하러 가기",
    statLabels: ["시가", "고가", "저가", "종가"] as const,
    chartNote:
      "금융위원회가 공개한 일별 값입니다. 띠는 그날 고가와 저가 사이, 선은 시가에서 종가까지입니다. 고가와 저가가 언제 나왔는지는 일별 자료에 없어서 둘 사이의 순서는 그리지 않았습니다.",
    legs: ["코스피 200", "코스피200 선물"] as const,
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
      "Published daily values from the FSC. The band is the range between the session's high and low; the line runs from the open to the close. A daily record does not say when either extreme happened, so no order between them is drawn.",
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
        <SessionPathChart
          compact
          language={language}
          legs={[
            { name: text.legs[0], day: spot },
            { name: text.legs[1], day: future },
          ]}
          note={text.chartNote}
          previousClose={{
            value: previousClose,
            label: language === "ko" ? "현물 전일 종가" : "spot previous close",
          }}
        />
      </div>
    </section>
  );
}
