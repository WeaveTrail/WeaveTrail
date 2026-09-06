"use client";

import React from "react";
import Link from "next/link";

import { useCopy, type Language } from "../i18n/language";

const LAYERS_EN: readonly (readonly [string, string])[] = [
  [
    "L1 · Interpret",
    "A constrained mapper proposes targets, transforms, confidence and evidence. A deterministic fixture is the default; explicitly configured mapping is available for two synthetic dialects, with mocked transport checks. It cannot edit rows or decide results.",
  ],
  [
    "L2 · Approve",
    "A person approves the exact mapping and authored case proposal by hash. Flagged fields require a justified override. Approval cannot edit a computed result.",
  ],
  [
    "L3 · Decide",
    "Versioned code owns ordering, deduplication, calculation, evaluation, and hashes.",
  ],
  [
    "L4 · Evidence",
    "The server resolves findings to canonical eventId, rawRowHash, artifact coordinates and unchanged raw values. Unresolvable lineage is refused. INCONCLUSIVE has no finding evidence.",
  ],
];

const LAYERS_KO: readonly (readonly [string, string])[] = [
  [
    "L1 · 해석",
    "제약된 매퍼가 대상 필드와 변환, 확신도, 근거를 제안합니다. 기본값은 결정론적 fixture이고, 명시적으로 설정된 매핑은 합성 방언 두 개에 대해 모킹된 전송 검사와 함께 쓸 수 있습니다. 행을 고치거나 결과를 정하지는 못합니다.",
  ],
  [
    "L2 · 승인",
    "사람이 매핑과 작성된 사례 제안을 해시로 정확히 승인합니다. 표시된 필드는 사유를 갖춘 override가 필요합니다. 승인이 계산된 결과를 고칠 수는 없습니다.",
  ],
  [
    "L3 · 판정",
    "버전이 찍힌 코드가 정렬, 중복 제거, 계산, 평가, 해시를 소유합니다.",
  ],
  [
    "L4 · 증거",
    "서버가 발견을 정본 eventId, rawRowHash, 아티팩트 좌표, 그리고 바뀌지 않은 원본 값까지 되짚습니다. 되짚을 수 없는 계보는 거부합니다. INCONCLUSIVE에는 발견 증거가 없습니다.",
  ],
];

interface ArchitectureCopy {
  readonly eyebrow: string;
  readonly heading: string;
  readonly lede: string;
  readonly diagramLabel: string;
  readonly diagramAlt: string;
  readonly readingLabel: string;
  readonly readingLede: string;
  readonly authorityTitle: string;
  readonly authorityText: string;
  readonly boundaryTitle: string;
  readonly boundaryTextBefore: string;
  readonly boundaryTextAfter: string;
  readonly hashTitle: string;
  readonly hashTextBefore: string;
  readonly hashLinkText: string;
  readonly hashTextAfter: string;
  readonly chainHeading: string;
  readonly chain: readonly (readonly [string, string, boolean])[];
  readonly refusedNote: string;
  readonly layers: readonly (readonly [string, string])[];
  readonly canonicalHeading: string;
  readonly canonicalOne: string;
  readonly canonicalTwo: string;
  readonly canonicalThree: string;
  readonly walkThrough: string;
}

const copy: Readonly<Record<Language, ArchitectureCopy>> = {
  en: {
    eyebrow: "Architecture",
    heading: "One uncertain boundary. One deterministic core.",
    lede: "The model narrows semantic ambiguity; it never owns the replay result. Invalid or unapproved proposals stop before deterministic execution.",
    diagramLabel: "Layer separation diagram",
    diagramAlt:
      "Four layers between a surveillance alert and a re-derivable result: a constrained mapper proposes a field mapping, a reviewer approves that exact proposal by hash, versioned code decides the outcome, and the evidence layer resolves every finding back to its source rows",
    readingLabel: "Reading the diagram",
    readingLede:
      "The diagram shows the layer model. The chain below marks which components are implemented and which are planned.",
    authorityTitle: "Where a model's authority ends.",
    authorityText:
      " L1 proposes. Today that is a field mapping; the bounded case proposer below is planned. It never computes a value, edits a row, or decides a result.",
    boundaryTitle: "The trust boundary.",
    boundaryTextBefore:
      " It runs between L2 and L3. Nothing reaches the deterministic core without an approval bound to the exact proposal hash, and a validation or approval gate that cannot be satisfied returns a review state instead of a result. The engine's five rule gates sit inside the boundary: a failed one produces ",
    boundaryTextAfter: ", which is a result.",
    hashTitle: "What the canonical hash covers.",
    hashTextBefore:
      " The result carries the engine version, the semantic event projection and the evaluation. ",
    hashLinkText: "What it leaves unprotected",
    hashTextAfter: " is stated below.",
    chainHeading: "From source rows to evidence",
    chain: [
      ["Committed source rows", "Untrusted input", false],
      ["Schema mapper", "Fixture proposal", false],
      ["Mapping approval", "Person · exact proposal hash", false],
      ["Canonical event set", "Code · re-derived from approved mapping", false],
      ["Dataset profile", "Code · bounded facts", false],
      ["Bounded case proposer", "Planned · authored manifests today", true],
      ["Case approval", "Person · exact scope hash", false],
      ["Replay engine", "Code · five rule gates", false],
      ["Finding source trace", "Code · original rows", false],
      ["Evidence Bundle assembly", "Planned", true],
    ],
    refusedNote: "A refused request carries a review state and no result hash.",
    layers: LAYERS_EN,
    canonicalHeading: "What the canonical hash covers",
    canonicalOne:
      " hashes the engine version, semantic event projection and evaluation when present. Volatile run metadata is excluded.",
    canonicalTwo:
      "Complete approval records, all mapping and manifest fields, and source trace are not protected by this result hash. A future bundle hash and independent bundle assembly and verification remain planned.",
    canonicalThree:
      "The browser's guide progress is presentation state. Each API replay creates a request-local workflow; durable audit history is not implemented.",
    walkThrough: "Walk through a case",
  },
  ko: {
    eyebrow: "아키텍처",
    heading: "불확실한 경계 하나, 결정론적인 core 하나.",
    lede: "모델은 의미의 모호함을 좁힐 뿐, 리플레이 결과를 소유하지 않습니다. 유효하지 않거나 승인되지 않은 제안은 결정론적 실행 앞에서 멈춥니다.",
    diagramLabel: "계층 분리 다이어그램",
    diagramAlt:
      "감시 알림과 다시 도출 가능한 결과 사이의 네 계층: 제약된 매퍼가 필드 매핑을 제안하고, 검토자가 그 제안을 해시로 정확히 승인하며, 버전이 찍힌 코드가 결과를 판정하고, 증거 계층이 모든 발견을 원본 행까지 되짚습니다",
    readingLabel: "다이어그램 읽는 법",
    readingLede:
      "다이어그램은 계층 모델을 보여줍니다. 아래 체인은 어떤 구성요소가 구현됐고 어떤 것이 계획인지 표시합니다.",
    authorityTitle: "모델의 권한이 끝나는 지점.",
    authorityText:
      " L1은 제안합니다. 지금은 필드 매핑이고, 아래의 한정된 사례 제안기는 계획 단계입니다. 값을 계산하거나 행을 고치거나 결과를 정하는 일은 하지 않습니다.",
    boundaryTitle: "신뢰 경계.",
    boundaryTextBefore:
      " 경계는 L2와 L3 사이에 있습니다. 제안 해시에 정확히 묶인 승인 없이는 아무것도 결정론적 core에 닿지 못하고, 충족될 수 없는 검증이나 승인 게이트는 결과 대신 검토 상태를 돌려줍니다. 엔진의 다섯 규칙 gate는 경계 안쪽에 있습니다. 그중 하나가 통과하지 못하면 ",
    boundaryTextAfter: "가 나오고, 그것도 결과입니다.",
    hashTitle: "정본 해시가 덮는 범위.",
    hashTextBefore: " 결과는 엔진 버전과 의미 이벤트 투영, 평가를 담습니다. ",
    hashLinkText: "무엇이 보호되지 않는지",
    hashTextAfter: "는 아래에 적어두었습니다.",
    chainHeading: "소스 행에서 증거까지",
    chain: [
      ["커밋된 소스 행", "신뢰하지 않는 입력", false],
      ["스키마 매퍼", "fixture 제안", false],
      ["매핑 승인", "사람 · 제안 해시와 정확히 일치", false],
      ["정본 이벤트 집합", "코드 · 승인된 매핑에서 다시 도출", false],
      ["데이터셋 프로파일", "코드 · 한정된 사실", false],
      ["한정된 사례 제안기", "계획 · 현재는 직접 작성한 manifest", true],
      ["사례 승인", "사람 · 범위 해시와 정확히 일치", false],
      ["리플레이 엔진", "코드 · 다섯 규칙 gate", false],
      ["발견 소스 추적", "코드 · 원본 행", false],
      ["증거 번들 조립", "계획", true],
    ],
    refusedNote: "거부된 요청은 검토 상태를 담고 결과 해시를 담지 않습니다.",
    layers: LAYERS_KO,
    canonicalHeading: "정본 해시가 덮는 범위",
    canonicalOne:
      "는 엔진 버전과 의미 이벤트 투영, 그리고 평가가 있을 때 그 평가를 해시합니다. 매번 달라지는 실행 메타데이터는 제외됩니다.",
    canonicalTwo:
      "완전한 승인 기록, 모든 매핑과 manifest 필드, 소스 추적은 이 결과 해시가 보호하지 않습니다. 번들 해시와 독립적인 번들 조립·검증은 아직 계획입니다.",
    canonicalThree:
      "브라우저의 가이드 진행 상태는 표시용입니다. API 리플레이는 요청마다 자기 워크플로를 만들고, 지속되는 감사 이력은 구현돼 있지 않습니다.",
    walkThrough: "사례 따라가기",
  },
};

export function ArchitectureContent() {
  const text = useCopy(copy);

  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">{text.eyebrow}</span>
        <h1>{text.heading}</h1>
        <p>{text.lede}</p>
      </div>
      <figure className="layer-diagram">
        <div
          aria-label={text.diagramLabel}
          className="diagram-frame"
          role="group"
          tabIndex={0}
        >
          {/* The SVG is served verbatim so the page and the repository documentation carry one committed diagram. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image would transform the committed diagram asset. */}
          <img
            alt={text.diagramAlt}
            height={520}
            src="/diagrams/how-it-works.svg"
            width={1200}
          />
        </div>
        <figcaption>
          <span className="panel-label">{text.readingLabel}</span>
          <p>{text.readingLede}</p>
          <ul>
            <li>
              <strong>{text.authorityTitle}</strong>
              {text.authorityText}
            </li>
            <li>
              <strong>{text.boundaryTitle}</strong>
              {text.boundaryTextBefore}
              <code>NOT_SUPPORTED</code>
              {text.boundaryTextAfter}
            </li>
            <li>
              <strong>{text.hashTitle}</strong>
              {text.hashTextBefore}
              <a href="#canonical-hash">{text.hashLinkText}</a>
              {text.hashTextAfter}
            </li>
          </ul>
        </figcaption>
      </figure>
      <section className="panel">
        <h2>{text.chainHeading}</h2>
        <ol className="component-chain">
          {text.chain.map(([name, note, planned]) => (
            <li key={name}>
              {name}{" "}
              <span className={planned ? "pill" : undefined}>{note}</span>
            </li>
          ))}
        </ol>
        <p>{text.refusedNote}</p>
      </section>
      <section className="eval-list">
        {text.layers.map(([name, detail], index) => (
          <article className="eval-row" key={name}>
            <span className="pill">0{index + 1}</span>
            <h2>{name}</h2>
            <p>{detail}</p>
          </article>
        ))}
      </section>
      <section className="panel architecture-hash" id="canonical-hash">
        <h2>{text.canonicalHeading}</h2>
        <p>
          <code>canonicalReplayResultHash</code>
          {text.canonicalOne}
        </p>
        <p>{text.canonicalTwo}</p>
        <p>{text.canonicalThree}</p>
        <Link className="button" href="/replay?mode=guided">
          {text.walkThrough}
        </Link>
      </section>
    </main>
  );
}
