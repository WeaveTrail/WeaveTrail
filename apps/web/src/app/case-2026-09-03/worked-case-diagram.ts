/**
 * The worked-case figure the READMEs embed, held as geometry plus one copy
 * table per language, with every number read from the committed artifacts and
 * from the rule's own output.
 *
 * It began as two hand-drawn SVGs. A drawing cannot be reproduced from the
 * archived responses it claims to show, and its bar positions were computed
 * once, by hand, against prices that can change. Here the prices come from the
 * committed rows, the multiples, the thresholds and the standing come from the
 * engine, and the bar geometry is derived from the prices rather than typed
 * beside them.
 *
 * `worked-case-diagram.test.ts` writes both committed files from this module
 * and fails when they differ. `pnpm diagram:case` rewrites them.
 */

import type { Language } from "../i18n/language";
import { sha256Canonical } from "@weavetrail/replay-engine";

import {
  publishedCaseProposal,
  replayPublishedCase,
} from "../../lib/published-case";
import { RATIO_UNITS, scaledPrice } from "./scaled-price";

export const DIAGRAM_WIDTH = 1200;
export const DIAGRAM_HEIGHT = 540;

/** The committed artifacts every figure on the diagram is read from. */
export const NAMED_ARTIFACTS = [
  "fsc-kospi-200-baseline-20260701-20260903",
  "fsc-kospi-200-futures-20260903",
] as const;

export interface DiagramLeg {
  readonly open: string;
  readonly high: string;
  readonly low: string;
  readonly close: string;
  readonly multiple: string;
  readonly multipleThreshold: string;
}

export interface WorkedCaseFigures {
  readonly analysedDate: string;
  readonly baselineStart: string;
  readonly baselineEnd: string;
  readonly legs: readonly DiagramLeg[];
  readonly rank: string;
  readonly population: string;
  readonly rankThreshold: string;
  readonly agreeingLegs: string;
  readonly agreeingThreshold: string;
}

/**
 * Runs the published case over the committed artifacts and returns what the
 * diagram prints. The approval here is a generated fixture: it satisfies the
 * hash gate so the rule can run, and it evidences no human review, which is
 * why the figure labels its own output as deterministic rather than approved.
 */
export function workedCaseFigures(): WorkedCaseFigures {
  const { proposal } = publishedCaseProposal();
  const { evaluation } = replayPublishedCase({
    approvedArtifactHash: sha256Canonical(proposal),
    reviewerRef: "reviewer:diagram-fixture",
    decision: "APPROVED",
    overrides: [],
    approvedAt: "2026-09-07T00:00:00Z",
  });
  const { analysis, findings } = evaluation;
  if (analysis === null)
    throw new Error("The published case reached no analysis to draw");
  const thresholdFor = (gate: string, legId?: string) => {
    const finding = findings.find(
      (candidate) =>
        candidate.gate === gate &&
        (legId === undefined || candidate.legId === legId),
    );
    if (finding === undefined)
      throw new Error(`The published case reported no ${gate} finding`);
    return finding;
  };
  return {
    analysedDate: analysis.analysedDate,
    baselineStart: analysis.baselineRange.startDate,
    baselineEnd: analysis.baselineRange.endDateInclusive,
    legs: analysis.legs.map((leg) => ({
      open: leg.openPrice,
      high: leg.highPrice,
      low: leg.lowPrice,
      close: leg.closePrice,
      multiple: leg.reversalMultiple,
      multipleThreshold: thresholdFor("LEG_REVERSAL_MULTIPLE", leg.legId)
        .threshold,
    })),
    rank: analysis.rank.position,
    population: analysis.rank.populationSize,
    rankThreshold: thresholdFor("BASELINE_RANK").threshold,
    agreeingLegs: thresholdFor("AGREEING_LEGS").observedValue,
    agreeingThreshold: thresholdFor("AGREEING_LEGS").threshold,
  };
}

/**
 * Standalone files name the families literally, because a committed SVG has no
 * access to the application's custom properties.
 */
const FONTS = {
  file: {
    sans: '"IBM Plex Sans","IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",Helvetica,Arial,sans-serif',
    mono: '"JetBrains Mono","IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,monospace',
  },
  inline: { sans: "var(--font-sans)", mono: "var(--font-mono)" },
} as const;

const BAR_X = 40;
const BAR_WIDTH = 340;
/** Each leg's band: the y of its heading, its bar, and its value row. */
const LEG_ROWS = [
  { heading: 222, keys: 240, bar: 256, labels: 280, values: 297 },
  { heading: 341, keys: 365, bar: 381, labels: 405, values: 422 },
] as const;
/** Each returned figure's band in the right-hand panel. */
const FIGURE_ROWS = [240, 312, 384] as const;
const PANEL_X = { day: 40, scope: 470, returned: 850 } as const;

/**
 * A price's position along its own leg's low-to-high bar. Integer arithmetic
 * throughout; the one division produces the unitless fraction the coordinate
 * needs.
 */
const alongBar = (leg: DiagramLeg, value: string): number => {
  const low = scaledPrice(leg.low);
  const span = scaledPrice(leg.high) - low;
  if (span <= 0n) return BAR_X;
  const offset = scaledPrice(value) - low;
  const fraction = Number((offset * RATIO_UNITS) / span) / Number(RATIO_UNITS);
  return Math.round((BAR_X + fraction * BAR_WIDTH) * 10) / 10;
};

/** Published prices print grouped, to two places, from the decimal string. */
const price = (value: string) => {
  const [whole = "", fraction = ""] = value.split(".");
  if (fraction.length > 2)
    throw new Error(`${value} carries more precision than the diagram shows`);
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0")}`;
};

interface Copy {
  readonly title: string;
  readonly description: (figures: WorkedCaseFigures) => string;
  readonly eyebrow: string;
  readonly headline: string;
  readonly lede: string;
  readonly publishedLabel: string;
  readonly rangeNote: string;
  readonly legNames: readonly [string, string];
  readonly open: string;
  readonly close: string;
  readonly low: string;
  readonly high: string;
  readonly scopeLabel: string;
  readonly scopeWho: string;
  readonly dayExamined: string;
  readonly comparedWith: string;
  readonly tradingDays: (population: string) => string;
  readonly scopeNote: readonly [string, string];
  readonly returnedLabel: string;
  readonly returnedWho: string;
  readonly figureReadings: readonly [string, string, string];
  readonly threshold: (value: string) => string;
  readonly rankThreshold: (value: string) => string;
  readonly standing: (rank: string, population: string) => string;
  readonly met: string;
  readonly agreeing: (observed: string, threshold: string) => string;
  readonly thresholdOrigin: string;
  readonly footer: readonly [string, string];
}

const copy: Readonly<Record<Language, Copy>> = {
  en: {
    title: "One day, re-derived from the published record",
    description: (figures) =>
      `Three panels. The published record for ${figures.analysedDate} shows the day's range for the KOSPI 200 and its front-month future, each closing below its own open while finishing above the previous day. Before anything runs, a person fixes the day examined, the period it is compared against, and the thresholds each check is measured against. The versioned rule then returns a reversal multiple of ${figures.legs[0]?.multiple} for the index against a threshold of ${figures.legs[0]?.multipleThreshold}, ${figures.legs[1]?.multiple} for the future against ${figures.legs[1]?.multipleThreshold}, and the day standing ${figures.rank} of ${figures.population} trading days in that period. A standing is a position inside the chosen period, not a probability. Each observed value opens onto the published row it was read from, the thresholds were chosen by a person who had already seen the day, and this figure is deterministic output rather than an approved case.`,
    eyebrow: "A WORKED CASE",
    headline: "One day, re-derived from the published record.",
    lede: "Both markets ended above the previous day, and both closed below where they opened.",
    publishedLabel: "THE DAY, AS PUBLISHED",
    rangeNote: "EACH BAR IS THE DAY'S RANGE, NOT A PATH THROUGH IT",
    legNames: ["KOSPI 200 index", "Front-month future on it"],
    open: "open",
    close: "close",
    low: "low",
    high: "high",
    scopeLabel: "FIXED BEFORE ANYTHING RUNS",
    scopeWho: "BY A PERSON",
    dayExamined: "The day examined",
    comparedWith: "Compared against",
    tradingDays: (population) => `${population} trading days`,
    scopeNote: [
      "The thresholds are fixed here too, and each",
      "is printed beside the figure it decided.",
    ],
    returnedLabel: "WHAT THE VERSIONED RULE RETURNED",
    returnedWho: "NOT A MODEL",
    figureReadings: [
      "the index gave back that much of its net move, inside the same day",
      "the front-month future on it did the same",
      "trading days in the period compared",
    ],
    threshold: (value) => `threshold ${value}×`,
    rankThreshold: (value) => `threshold: ${value}st or better`,
    standing: (rank, population) => `${rank} of ${population}`,
    met: "met",
    agreeing: (observed, threshold) =>
      `${observed} of ${threshold} markets had to agree, and did.`,
    thresholdOrigin:
      "Thresholds were chosen for this case by a person who had already seen the day.",
    footer: [
      "Published values: Financial Services Commission open data, committed as fsc-kospi-200-baseline-20260701-20260903 and fsc-kospi-200-futures-20260903.",
      "Generated from those artifacts by the versioned rule: deterministic output, not an approved case or evidence. On the site the same case runs only after a person approves the scope.",
    ],
  },
  ko: {
    title: "공개된 기록만으로 하루를 다시 계산한 사례",
    description: (figures) =>
      `세 부분으로 나뉜 그림입니다. 왼쪽은 ${figures.analysedDate} 코스피 200 지수와 그 최근월 선물의 발행된 하루 가격 범위로, 두 시장 모두 전일보다 높게 끝났지만 시가보다 낮게 마감했습니다. 가운데는 실행 전에 사람이 확정하는 것으로, 분석 대상일과 비교할 기준선 기간, 그리고 각 판단이 견주는 기준값입니다. 이어서 버전이 고정된 규칙이 지수의 되돌림 배수 ${figures.legs[0]?.multiple}을 기준값 ${figures.legs[0]?.multipleThreshold}에 대해, 선물의 ${figures.legs[1]?.multiple}을 기준값 ${figures.legs[1]?.multipleThreshold}에 대해 돌려주고, 그날은 그 기간 ${figures.population}거래일 가운데 ${figures.rank}번째였습니다. 순위는 선언된 기간 안에서의 위치일 뿐 확률이 아닙니다. 관측값은 그 값을 읽어 온 공개 원본 행까지 열어 볼 수 있고, 기준값은 이 날의 값을 이미 본 사람이 정했으며, 이 그림은 승인된 사례가 아니라 결정론적 출력입니다.`,
    eyebrow: "실제 사례",
    headline: "공개된 기록만으로 하루를 다시 계산합니다.",
    lede: "두 시장 모두 전일보다 높게 끝났고, 두 시장 모두 시가보다 낮게 마감했습니다.",
    publishedLabel: "발행처가 공개한 그날의 값",
    rangeNote: "막대는 그날의 가격 범위이며, 하루의 흐름이 아닙니다",
    legNames: ["코스피 200 지수", "코스피200 선물 · 최근월물"],
    open: "시가",
    close: "종가",
    low: "저가",
    high: "고가",
    scopeLabel: "실행 전에 확정하는 것",
    scopeWho: "사람이 정합니다",
    dayExamined: "분석 대상일",
    comparedWith: "비교할 기준선 기간",
    tradingDays: (population) => `${population}거래일`,
    scopeNote: [
      "기준값도 여기서 함께 정하고, 각 기준값은",
      "그것이 판단한 수치 옆에 적습니다.",
    ],
    returnedLabel: "버전이 고정된 규칙이 돌려준 값",
    returnedWho: "모델이 아닙니다",
    figureReadings: [
      "지수는 전일 대비 변화폭의 그만큼을 같은 날 안에서 되돌렸습니다",
      "그 지수의 최근월 선물도 같은 모양이었습니다",
      "비교한 기준선 기간 안에서의 순위",
    ],
    threshold: (value) => `기준값 ${value}배`,
    rankThreshold: (value) => `기준값: ${value}번째 이내`,
    standing: (rank, population) => `${population}거래일 중 ${rank}번째`,
    met: "충족",
    agreeing: (observed, threshold) =>
      `같은 모양이어야 하는 시장 ${threshold}개 가운데 ${observed}개가 그러했습니다.`,
    thresholdOrigin:
      "기준값은 이 날의 값을 이미 본 사람이 이 사례를 만들면서 정했습니다.",
    footer: [
      "발행처 값: 금융위원회 공개 데이터. 저장소에는 fsc-kospi-200-baseline-20260701-20260903, fsc-kospi-200-futures-20260903으로 커밋되어 있습니다.",
      "이 그림의 수치는 그 아티팩트에 버전이 고정된 규칙을 적용해 생성했습니다. 결정론적 출력이며 승인된 사례나 증거가 아닙니다. 사이트에서는 사람이 범위를 승인해야 같은 사례가 실행됩니다.",
    ],
  },
};

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function workedCaseSvg(
  language: Language,
  figures: WorkedCaseFigures = workedCaseFigures(),
  variant: "file" | "inline" = "file",
): string {
  const text = copy[language];
  const fonts = FONTS[variant];
  const out: string[] = [];
  const push = (line: string) => out.push(line);

  push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}" role="img" aria-labelledby="caseTitle caseDesc">`,
  );
  push(`  <title id="caseTitle">${escape(text.title)}</title>`);
  push(`  <desc id="caseDesc">${escape(text.description(figures))}</desc>`);
  push(`  <!--`);
  push(
    `    Generated from apps/web/src/app/case-2026-09-03/worked-case-diagram.ts by \`pnpm diagram:case\`. Do not hand-edit.`,
  );
  push(
    `    Every price is a committed published value; every multiple, threshold and standing is versioned rule output.`,
  );
  push(
    `    WeaveTrail design system, pinned at design-reference@3f078da1970e8accd83fbdde73308a2a24d0d1f8`,
  );
  push(
    `    Literal hex, because CSS custom properties do not resolve inside a standalone SVG.`,
  );
  push(`    #f7faf9 paper-1 | #ffffff paper-0 | #0c1513 ink-900`);
  push(`    #263230 ink-700 | #566461 ink-500 | #7d8b88 ink-400`);
  push(
    `    #0b6e6a teal-700 | #d0d7de ledger-rule | #a9bebc ledger-rule-strong`,
  );
  push(`  -->`);
  push(`  <defs>`);
  push(`    <style>`);
  push(`      .s{font-family:${fonts.sans}}`);
  push(`      .m{font-family:${fonts.mono}}`);
  push(
    `      .eyebrow{font-size:11px;font-weight:600;letter-spacing:.08em;fill:#0b6e6a}`,
  );
  push(
    `      .title{font-size:27px;font-weight:600;fill:#0c1513;letter-spacing:-.01em}`,
  );
  push(`      .sub{font-size:14px;fill:#566461}`);
  push(
    `      .panelLabel{font-size:11px;font-weight:600;letter-spacing:.06em;fill:#566461}`,
  );
  push(
    `      .who{font-size:11px;font-weight:600;letter-spacing:.06em;fill:#7d8b88}`,
  );
  push(`      .leg{font-size:13px;font-weight:600;fill:#263230}`);
  push(`      .key{font-size:12px;fill:#566461}`);
  push(`      .val{font-size:13px;fill:#263230}`);
  push(`      .big{font-size:20px;font-weight:600;fill:#0c1513}`);
  push(`      .gate{font-size:12px;font-weight:600;fill:#0b6e6a}`);
  push(`      .note{font-size:12px;fill:#566461}`);
  push(`      .foot{font-size:11px;fill:#7d8b88}`);
  push(`      .rule{stroke:#d0d7de;stroke-width:1}`);
  push(`    </style>`);
  push(`  </defs>`);
  push(``);
  push(
    `  <rect width="${DIAGRAM_WIDTH}" height="${DIAGRAM_HEIGHT}" fill="#f7faf9"/>`,
  );
  push(`  <rect width="${DIAGRAM_WIDTH}" height="4" fill="#0b6e6a"/>`);
  push(
    `  <rect x=".5" y=".5" width="${DIAGRAM_WIDTH - 1}" height="${DIAGRAM_HEIGHT - 1}" fill="none" stroke="#d0d7de"/>`,
  );
  push(``);
  push(`  <g class="s">`);
  push(
    `    <text class="eyebrow" x="40" y="48">${escape(text.eyebrow)}</text>`,
  );
  push(`    <text class="title" x="40" y="84">${escape(text.headline)}</text>`);
  push(
    `    <text class="sub" x="40" y="112">${escape(`${figures.analysedDate}. ${text.lede}`)}</text>`,
  );
  push(`  </g>`);
  push(`  <line class="rule" x1="40" y1="140" x2="1160" y2="140"/>`);
  push(``);

  // panel 1 : the day as published
  push(`  <g class="s">`);
  push(
    `    <text class="panelLabel" x="${PANEL_X.day}" y="174">${escape(text.publishedLabel)}</text>`,
  );
  push(
    `    <text class="who" x="${PANEL_X.day}" y="194">${escape(text.rangeNote)}</text>`,
  );
  figures.legs.forEach((leg, index) => {
    const row = LEG_ROWS[index];
    if (row === undefined) return;
    const closeX = alongBar(leg, leg.close);
    const openX = alongBar(leg, leg.open);
    push(``);
    push(
      `    <text class="leg" x="${PANEL_X.day}" y="${row.heading}">${escape(text.legNames[index] ?? "")}</text>`,
    );
    push(
      `    <text class="key" x="${closeX}" y="${row.keys}" text-anchor="middle">${escape(text.close)}</text>`,
    );
    push(
      `    <text class="key" x="${openX}" y="${row.keys}" text-anchor="middle">${escape(text.open)}</text>`,
    );
    push(
      `    <line x1="${BAR_X}" y1="${row.bar}" x2="${BAR_X + BAR_WIDTH}" y2="${row.bar}" stroke="#a9bebc" stroke-width="6" stroke-linecap="round"/>`,
    );
    push(
      `    <line x1="${BAR_X + 1}" y1="${row.bar - 10}" x2="${BAR_X + 1}" y2="${row.bar + 10}" stroke="#7d8b88" stroke-width="2"/>`,
    );
    push(
      `    <line x1="${BAR_X + BAR_WIDTH - 1}" y1="${row.bar - 10}" x2="${BAR_X + BAR_WIDTH - 1}" y2="${row.bar + 10}" stroke="#7d8b88" stroke-width="2"/>`,
    );
    push(`    <circle cx="${openX}" cy="${row.bar}" r="6" fill="#7d8b88"/>`);
    push(`    <circle cx="${closeX}" cy="${row.bar}" r="6" fill="#0b6e6a"/>`);
    push(
      `    <text class="key" x="${BAR_X}" y="${row.labels}">${escape(text.low)}</text>`,
    );
    push(
      `    <text class="val m" x="${BAR_X}" y="${row.values}">${escape(price(leg.low))}</text>`,
    );
    push(
      `    <text class="key" x="${BAR_X + BAR_WIDTH}" y="${row.labels}" text-anchor="end">${escape(text.high)}</text>`,
    );
    push(
      `    <text class="val m" x="${BAR_X + BAR_WIDTH}" y="${row.values}" text-anchor="end">${escape(price(leg.high))}</text>`,
    );
  });
  push(`  </g>`);
  push(``);
  push(`  <line class="rule" x1="430" y1="162" x2="430" y2="484"/>`);
  push(``);

  // panel 2 : what a person fixes first
  push(`  <g class="s">`);
  push(
    `    <text class="panelLabel" x="${PANEL_X.scope}" y="174">${escape(text.scopeLabel)}</text>`,
  );
  push(
    `    <text class="who" x="${PANEL_X.scope}" y="194">${escape(text.scopeWho)}</text>`,
  );
  push(
    `    <rect x="${PANEL_X.scope}" y="212" width="300" height="150" fill="#ffffff" stroke="#d0d7de"/>`,
  );
  push(
    `    <text class="key" x="${PANEL_X.scope + 20}" y="240">${escape(text.dayExamined)}</text>`,
  );
  push(
    `    <text class="val m" x="${PANEL_X.scope + 20}" y="262">${escape(figures.analysedDate)}</text>`,
  );
  push(
    `    <line class="rule" x1="${PANEL_X.scope + 20}" y1="284" x2="${PANEL_X.scope + 280}" y2="284"/>`,
  );
  push(
    `    <text class="key" x="${PANEL_X.scope + 20}" y="308">${escape(text.comparedWith)}</text>`,
  );
  push(
    `    <text class="val m" x="${PANEL_X.scope + 20}" y="330">${escape(`${figures.baselineStart} – ${figures.baselineEnd}`)}</text>`,
  );
  push(
    `    <text class="key" x="${PANEL_X.scope + 20}" y="350">${escape(text.tradingDays(figures.population))}</text>`,
  );
  push(
    `    <text class="note" x="${PANEL_X.scope}" y="392">${escape(text.scopeNote[0])}</text>`,
  );
  push(
    `    <text class="note" x="${PANEL_X.scope}" y="410">${escape(text.scopeNote[1])}</text>`,
  );
  push(`  </g>`);
  push(``);
  push(`  <line class="rule" x1="810" y1="162" x2="810" y2="484"/>`);
  push(``);

  // panel 3 : what the rule returned, each figure beside the threshold it met
  push(`  <g class="s">`);
  push(
    `    <text class="panelLabel" x="${PANEL_X.returned}" y="174">${escape(text.returnedLabel)}</text>`,
  );
  push(
    `    <text class="who" x="${PANEL_X.returned}" y="194">${escape(text.returnedWho)}</text>`,
  );
  const rows: readonly (readonly [string, string, string])[] = [
    ...figures.legs.map(
      (leg, index) =>
        [
          `${leg.multiple}×`,
          text.figureReadings[index] ?? "",
          text.threshold(leg.multipleThreshold),
        ] as const,
    ),
    [
      text.standing(figures.rank, figures.population),
      text.figureReadings[2] ?? "",
      text.rankThreshold(figures.rankThreshold),
    ] as const,
  ];
  rows.forEach((row, index) => {
    const y = FIGURE_ROWS[index];
    if (y === undefined) return;
    push(``);
    push(
      `    <text class="big" x="${PANEL_X.returned}" y="${y}">${escape(row[0])}</text>`,
    );
    push(
      `    <text class="key" x="${PANEL_X.returned}" y="${y + 20}">${escape(row[1])}</text>`,
    );
    push(
      `    <text class="gate" x="${PANEL_X.returned}" y="${y + 40}">${escape(`${row[2]} · ${text.met}`)}</text>`,
    );
  });
  push(``);
  push(
    `    <text class="note" x="${PANEL_X.returned}" y="446">${escape(text.agreeing(figures.agreeingLegs, figures.agreeingThreshold))}</text>`,
  );
  push(
    `    <text class="note" x="${PANEL_X.returned}" y="470">${escape(text.thresholdOrigin)}</text>`,
  );
  push(`  </g>`);
  push(``);
  push(`  <line class="rule" x1="40" y1="484" x2="1160" y2="484"/>`);
  push(
    `  <text class="foot s" x="40" y="504">${escape(text.footer[0])}</text>`,
  );
  push(
    `  <text class="foot s" x="40" y="522">${escape(text.footer[1])}</text>`,
  );
  push(`</svg>`);
  return `${out.join("\n")}\n`;
}
