/**
 * The layer-separation diagram, held as geometry plus one copy table per
 * language.
 *
 * The diagram used to be a committed SVG with its text hand-positioned inside
 * it, which meant a second language needed a second hand-positioned file, and
 * every later copy change needed both. Here the geometry is written once and
 * the words come from the same kind of copy table the pages use, so a language
 * supplies its own lines and its own line breaks — Korean sets shorter than
 * English, and needs neither the same wrapping nor the same chip widths.
 *
 * `howItWorksSvg` is the single renderer. The page inlines it in the reader's
 * language; `pnpm diagram:build` writes its English output to the two
 * committed files, and a test fails if those files and this module disagree.
 */

import type { Language } from "../i18n/language";

export const DIAGRAM_WIDTH = 1200;
export const DIAGRAM_HEIGHT = 520;

/**
 * Standalone files name the families literally, because a committed SVG has no
 * access to the application's custom properties. Inlined in the page, the same
 * markup goes through the variables so it is set in the committed faces —
 * including the Korean one, which is the reason the diagram is localized at
 * all.
 */
const FONTS = {
  file: {
    sans: '"IBM Plex Sans","IBM Plex Sans KR","Segoe UI",Helvetica,Arial,sans-serif',
    mono: '"JetBrains Mono","IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,monospace',
  },
  inline: { sans: "var(--font-sans)", mono: "var(--font-mono)" },
} as const;

/** One stage box: its frame, its chip, and where its text sits. */
interface StageGeometry {
  readonly x: number;
  readonly fill: string;
  readonly stroke: string;
  readonly dashed: boolean;
  readonly chipFill: string;
  readonly textX: number;
  readonly chipX: number;
}

const STAGES: readonly StageGeometry[] = [
  {
    x: 40,
    fill: "#eef1f2",
    stroke: "#4f6270",
    dashed: true,
    chipFill: "#ffffff",
    textX: 56,
    chipX: 56,
  },
  {
    x: 326,
    fill: "#e6f2f1",
    stroke: "#0b6e6a",
    dashed: false,
    chipFill: "#ffffff",
    textX: 342,
    chipX: 342,
  },
  {
    x: 612,
    fill: "#ffffff",
    stroke: "#14211f",
    dashed: false,
    chipFill: "#f0f5f4",
    textX: 628,
    chipX: 628,
  },
  {
    x: 898,
    fill: "#ffffff",
    stroke: "#14211f",
    dashed: false,
    chipFill: "#f0f5f4",
    textX: 914,
    chipX: 914,
  },
];

/** The result and review-state chips. Contract vocabulary, so never translated. */
const REVIEW_STATES: readonly (readonly [string, number, number])[] = [
  ["INPUT_REVIEW_REQUIRED", 40, 160],
  ["MAPPING_REVIEW_REQUIRED", 208, 174],
  ["CASE_REVIEW_REQUIRED", 390, 154],
];

const RESULTS: readonly (readonly [string, number, number, string, string])[] =
  [
    ["SUPPORTED", 854, 82, "#e6f2f1", "#0b6e6a"],
    ["NOT_SUPPORTED", 944, 108, "#f0f5f4", "#263230"],
    ["INCONCLUSIVE", 1060, 100, "#fbf4e4", "#8a6a12"],
  ];

interface Stage {
  /** Chip label, and the width its box needs in this language. */
  readonly chip: string;
  readonly chipWidth: number;
  readonly title: string;
  /** Body lines, already broken for this language. */
  readonly lines: readonly string[];
  /** Machine value under the box. An identifier, so it is not translated. */
  readonly foot: string;
}

interface DiagramCopy {
  readonly title: string;
  readonly description: string;
  readonly eyebrow: string;
  readonly headline: string;
  readonly legend: string;
  /** The bound on what a verdict means, stated on the figure, not only in its description. */
  readonly verdictBound: string;
  readonly from: string;
  readonly to: string;
  readonly stages: readonly [Stage, Stage, Stage, Stage];
  readonly failsClosed: string;
  readonly threeResults: string;
}

const copy: Readonly<Record<Language, DiagramCopy>> = {
  en: {
    title:
      "Layer separation: a model proposes, a person approves, versioned code decides, and evidence carries the result back",
    description:
      "Four layers run left to right, between an alert that names an instrument, an actor group and a time window, and a result the next reviewer can re-derive. Layer one, interpret: a constrained mapper proposes a field mapping and never computes. Layer two, approve: a reviewer approves that exact proposal by hash and never edits a computed result. Layer three, decide: versioned code replays the approved manifest and reads nothing outside the approved scope. Layer four, evidence: the result carries a canonical hash and event identifiers that resolve back to source rows. No layer holds two authorities, and a verdict is true only for the engine version, rule version and thresholds it carries. Any gate that cannot be satisfied returns a review state instead of a result, and only three results exist.",
    eyebrow: "LAYER SEPARATION",
    headline: "AI proposes. A person approves. Code decides.",
    legend:
      "Dashed slate is model output and is never trusted. Teal is a human decision. Ink is versioned code.",
    verdictBound:
      "No layer holds two authorities, and a verdict carries the engine version, rule version and thresholds it is true under.",
    from: "FROM · an alert naming an instrument, an actor group and a time window",
    to: "TO · a result the next reviewer can re-derive",
    stages: [
      {
        chip: "AI PROPOSES",
        chipWidth: 94,
        title: "L1 · Interpret",
        lines: [
          "A constrained mapper proposes one",
          "target field and one allowlisted",
          "transform per source column, with",
          "a confidence and its evidence.",
        ],
        foot: "mappingVersion 1.4",
      },
      {
        chip: "HUMAN APPROVES",
        chipWidth: 114,
        title: "L2 · Approve",
        lines: [
          "A reviewer approves that exact",
          "proposal, bound to its hash. A",
          "flagged field needs a justified",
          "override before it can pass.",
        ],
        foot: "approvedArtifactHash",
      },
      {
        chip: "CODE DECIDES",
        chipWidth: 100,
        title: "L3 · Decide",
        lines: [
          "Versioned code orders, collapses",
          "duplicates, computes exact",
          "decimals, and evaluates",
          "RAPID_PRICE_LIFT 1.1.",
        ],
        foot: "engine 0.7.0-canonical-decimal",
      },
      {
        chip: "CODE RECORDS",
        chipWidth: 102,
        title: "L4 · Evidence",
        lines: [
          "The result carries a canonical",
          "hash, five gate findings, and",
          "event identifiers that resolve",
          "back to their source rows.",
        ],
        foot: "eventId → rawRowHash",
      },
    ],
    failsClosed: "FAILS CLOSED, NEVER AS A RESULT",
    threeResults: "THREE RESULTS, AND ONLY THREE",
  },
  ko: {
    title:
      "계층 분리: 모델이 제안하고, 사람이 승인하고, 버전이 고정된 코드가 판정하고, 증거가 그 결과를 원본까지 되짚는다",
    description:
      "네 계층이 왼쪽에서 오른쪽으로 이어집니다. 시작은 종목과 행위자 그룹, 시간 구간을 지목한 알림이고, 끝은 다음 검토자가 다시 도출할 수 있는 결과입니다. 1계층 해석: 제약된 매퍼가 필드 매핑을 제안할 뿐 계산은 하지 않습니다. 2계층 승인: 검토자가 그 제안을 해시로 정확히 승인하고, 계산된 결과는 고치지 못합니다. 3계층 판정: 버전이 고정된 코드가 승인된 manifest를 리플레이하고, 승인된 범위 밖은 읽지 않습니다. 4계층 증거: 결과에 정본 해시와 원본 행까지 되짚는 이벤트 식별자가 담깁니다. 한 계층이 권한을 둘 갖는 일은 없고, 판정은 그 판정이 달고 있는 엔진 버전과 규칙 버전, 임계값에 한해서만 참입니다. 충족되지 못한 gate는 결과 대신 검토 상태를 돌려주고, 결과는 셋뿐입니다.",
    eyebrow: "계층 분리",
    headline: "AI가 제안하고, 사람이 승인하고, 코드가 판정합니다.",
    legend:
      "점선 회색은 모델 출력이고, 신뢰하지 않습니다. 청록은 사람의 결정, 먹색은 버전이 고정된 코드입니다.",
    verdictBound:
      "한 계층이 권한을 둘 갖지 않습니다. 판정은 그것이 달고 있는 엔진 버전과 규칙 버전, 임계값 아래에서만 참입니다.",
    from: "들어오는 것 · 종목과 행위자 그룹, 시간 구간을 지목한 알림",
    to: "나가는 것 · 다음 검토자가 다시 도출할 수 있는 결과",
    stages: [
      {
        chip: "AI가 제안",
        chipWidth: 64,
        title: "L1 · 해석",
        lines: [
          "제약된 매퍼가 소스 열마다 대상",
          "필드 하나와 허용된 변환 하나를",
          "확신도, 근거와 함께 제안합니다.",
        ],
        foot: "mappingVersion 1.4",
      },
      {
        chip: "사람이 승인",
        chipWidth: 72,
        title: "L2 · 승인",
        lines: [
          "검토자가 그 제안을 해시에 묶어",
          "그대로 승인합니다. 표시된 필드는",
          "사유를 적어야 넘어갑니다.",
        ],
        foot: "approvedArtifactHash",
      },
      {
        chip: "코드가 판정",
        chipWidth: 72,
        title: "L3 · 판정",
        lines: [
          "버전이 고정된 코드가 정렬하고,",
          "중복을 거르고, 소수를 정확히",
          "계산해 RAPID_PRICE_LIFT 1.1을",
          "평가합니다.",
        ],
        foot: "engine 0.7.0-canonical-decimal",
      },
      {
        chip: "코드가 기록",
        chipWidth: 72,
        title: "L4 · 증거",
        lines: [
          "결과에는 정본 해시와 다섯 gate의",
          "발견, 그리고 원본 행까지 되짚는",
          "이벤트 식별자가 담깁니다.",
        ],
        foot: "eventId → rawRowHash",
      },
    ],
    failsClosed: "막힐 때는 닫히고, 결과로 나오지 않습니다",
    threeResults: "결과는 이 셋뿐입니다",
  },
};

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * The complete diagram for one language.
 *
 * `variant` picks the font stack: `file` for the two committed artifacts,
 * `inline` for the copy the page renders, which resolves the application's
 * own committed faces.
 */
export function howItWorksSvg(
  language: Language,
  variant: "file" | "inline" = "file",
): string {
  const text = copy[language];
  const fonts = FONTS[variant];
  const out: string[] = [];
  const push = (line: string) => out.push(line);

  push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}" role="img" aria-labelledby="flowTitle flowDesc">`,
  );
  push(`  <title id="flowTitle">${escape(text.title)}</title>`);
  push(`  <desc id="flowDesc">${escape(text.description)}</desc>`);
  push(`  <!--`);
  push(
    `    Generated from apps/web/src/app/architecture/how-it-works-diagram.ts by \`pnpm diagram:build\`. Do not hand-edit.`,
  );
  push(
    `    WeaveTrail design system, pinned at design-reference@d780236766c1e0fddcc1976c252aba35b3898fe4`,
  );
  push(
    `    Literal hex, because CSS custom properties do not resolve inside a standalone SVG.`,
  );
  push(`    #f7faf9 paper-1 | #ffffff paper-0 | #f0f5f4 surface-sunken`);
  push(
    `    #0c1513 ink-900 | #14211f ink-800 authorship-code | #263230 ink-700 | #566461 ink-500`,
  );
  push(
    `    #0b6e6a teal-700 authorship-human | #e6f2f1 teal-tint | #085652 teal-800`,
  );
  push(`    #4f6270 authorship-ai state-review | #eef1f2 slate-tint`);
  push(`    #8a6a12 result-inconclusive | #fbf4e4 amber-tint`);
  push(`    #d0d7de ledger-rule`);
  push(`  -->`);
  push(`  <defs>`);
  push(`    <style>`);
  push(`      .s{font-family:${fonts.sans}}`);
  push(`      .m{font-family:${fonts.mono}}`);
  push(
    `      .eyebrow{font-size:11px;font-weight:600;letter-spacing:.08em;fill:#0b6e6a}`,
  );
  push(
    `      .title{font-size:28px;font-weight:600;fill:#0c1513;letter-spacing:-.01em}`,
  );
  push(`      .sub{font-size:14px;fill:#566461}`);
  push(`      .stage{font-size:18px;font-weight:600;fill:#0c1513}`);
  push(`      .body{font-size:13px;fill:#263230}`);
  push(`      .foot{font-size:11px;fill:#566461}`);
  push(`      .chip{font-size:10px;font-weight:600;letter-spacing:.06em}`);
  push(
    `      .band{font-size:11px;font-weight:600;letter-spacing:.08em;fill:#566461}`,
  );
  push(`      .ctx{font-size:11px;fill:#7d8b88}`);
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
  push(`    <text class="sub" x="40" y="112">${escape(text.legend)}</text>`);
  push(
    `    <text class="sub" x="40" y="132">${escape(text.verdictBound)}</text>`,
  );
  push(`  </g>`);
  push(`  <line class="rule" x1="40" y1="150" x2="1160" y2="150"/>`);
  push(``);
  push(`  <g class="s">`);
  push(`    <text class="ctx" x="40" y="176">${escape(text.from)}</text>`);
  push(
    `    <text class="ctx" x="1160" y="176" text-anchor="end">${escape(text.to)}</text>`,
  );
  push(`  </g>`);

  text.stages.forEach((stage, index) => {
    const box = STAGES[index]!;
    const dash = box.dashed ? ` stroke-dasharray="4 3"` : "";
    push(``);
    push(`  <!-- stage ${index + 1} -->`);
    push(
      `  <rect x="${box.x}" y="192" width="262" height="200" fill="${box.fill}" stroke="${box.stroke}"${dash}/>`,
    );
    push(
      `  <rect x="${box.chipX}" y="208" width="${stage.chipWidth}" height="18" fill="${box.chipFill}" stroke="${box.stroke}"${dash}/>`,
    );
    push(
      `  <text class="s chip" x="${box.chipX + 8}" y="221" fill="${box.stroke}">${escape(stage.chip)}</text>`,
    );
    push(`  <g class="s">`);
    push(
      `    <text class="stage" x="${box.textX}" y="256">${escape(stage.title)}</text>`,
    );
    stage.lines.forEach((line, row) => {
      push(
        `    <text class="body" x="${box.textX}" y="${284 + row * 20}">${escape(line)}</text>`,
      );
    });
    push(`  </g>`);
    push(
      `  <text class="m foot" x="${box.textX}" y="374">${escape(stage.foot)}</text>`,
    );
  });

  push(``);
  push(`  <g fill="#0b6e6a">`);
  push(`    <path d="M306 286l10 6-10 6z"/>`);
  push(`    <path d="M592 286l10 6-10 6z"/>`);
  push(`    <path d="M878 286l10 6-10 6z"/>`);
  push(`  </g>`);
  push(``);
  push(`  <line class="rule" x1="40" y1="422" x2="1160" y2="422"/>`);
  push(``);
  push(`  <g class="s">`);
  push(
    `    <text class="band" x="40" y="452">${escape(text.failsClosed)}</text>`,
  );
  push(
    `    <text class="band" x="1160" y="452" text-anchor="end">${escape(text.threeResults)}</text>`,
  );
  push(`  </g>`);
  push(`  <g>`);
  for (const [label, x, width] of REVIEW_STATES) {
    push(
      `    <rect x="${x}" y="464" width="${width}" height="20" fill="#eef1f2" stroke="#4f6270" stroke-dasharray="4 3"/>`,
    );
    push(
      `    <text class="m chip" x="${x + 10}" y="478" fill="#4f6270">${label}</text>`,
    );
  }
  push(`  </g>`);
  push(`  <g>`);
  for (const [label, x, width, fill, stroke] of RESULTS) {
    push(
      `    <rect x="${x}" y="464" width="${width}" height="20" fill="${fill}" stroke="${stroke}"/>`,
    );
    push(
      `    <text class="m chip" x="${x + 10}" y="478" fill="${stroke}">${label}</text>`,
    );
  }
  push(`  </g>`);
  push(`</svg>`);

  return `${out.join("\n")}\n`;
}
