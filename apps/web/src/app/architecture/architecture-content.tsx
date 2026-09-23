"use client";

import React from "react";
import Link from "next/link";

import { useCopy, useLanguage, type Language } from "../i18n/language";
import { howItWorksSvg } from "./how-it-works-diagram";

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
    "매퍼는 필드와 변환, 근거를 제안합니다. 기본값은 결정론적 fixture입니다. 행과 결과는 고치지 못합니다.",
  ],
  [
    "L2 · 승인",
    "사람이 제안을 해시로 승인합니다. 표시된 필드는 사유가 필요합니다. 승인으로 결과를 고칠 수는 없습니다.",
  ],
  [
    "L3 · 판정",
    "정렬과 중복 제거, 계산, 평가, 해시는 전부 버전이 고정된 코드가 맡습니다.",
  ],
  [
    "L4 · 증거",
    "서버가 발견을 eventId, rawRowHash, 원본 값까지 연결합니다. 연결되지 않으면 거부합니다.",
  ],
];

interface ArchitectureCopy {
  readonly eyebrow: string;
  readonly heading: string;
  readonly lede: string;
  readonly diagramLabel: string;
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

export const architectureCopy: Readonly<Record<Language, ArchitectureCopy>> = {
  en: {
    eyebrow: "Architecture",
    heading: "One uncertain boundary. One deterministic core.",
    lede: "The model narrows semantic ambiguity; it never owns the replay result. Invalid or unapproved proposals stop before deterministic execution.",
    diagramLabel: "Layer separation diagram",
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
      ["Evidence Bundle", "Code · byte-backed verification", false],
    ],
    refusedNote: "A refused request carries a review state and no result hash.",
    layers: LAYERS_EN,
    canonicalHeading: "What the canonical hash covers",
    canonicalOne:
      " hashes the engine version, semantic event projection and evaluation when present. Volatile run metadata is excluded.",
    canonicalTwo:
      "Complete approval records and all mapping and manifest fields are protected by the separate bundle hash. The engine independently verifies that declaration from source bytes; browser export remains planned.",
    canonicalThree:
      "The browser's guide progress is presentation state. Each API replay creates a request-local workflow; durable audit history is not implemented.",
    walkThrough: "Walk through a case",
  },
  ko: {
    eyebrow: "아키텍처",
    heading: "모호함은 경계 앞에서 멈춥니다.",
    lede: "모델은 뜻이 모호한 자리를 좁혀줄 뿐, 리플레이 결과를 정하지는 못합니다. 유효하지 않거나 승인되지 않은 제안은 결정론적 실행 앞에서 멈춥니다.",
    diagramLabel: "계층 분리 다이어그램",
    readingLabel: "다이어그램 읽는 법",
    readingLede: "구현 상태는 아래 체인에 표시했습니다.",
    authorityTitle: "모델의 권한이 끝나는 지점.",
    authorityText:
      " L1은 필드 매핑만 제안합니다. 값, 행, 결과는 정하지 못합니다.",
    boundaryTitle: "신뢰 경계.",
    boundaryTextBefore:
      " 경계는 L2와 L3 사이입니다. 해시에 묶인 승인 없이는 실행하지 않습니다. 검증이나 승인이 막히면 검토 상태가 돌아옵니다. 규칙 gate가 통과하지 못하면 ",
    boundaryTextAfter: "가 나오고, 그것도 결과입니다.",
    hashTitle: "정본 해시가 덮는 범위.",
    hashTextBefore: " 결과에는 엔진 버전과 의미 이벤트 투영, 평가가 담깁니다. ",
    hashLinkText: "무엇이 보호되지 않는지",
    hashTextAfter: "는 아래에 적어두었습니다.",
    chainHeading: "소스 행에서 증거까지",
    chain: [
      ["커밋된 소스 행", "신뢰하지 않는 입력", false],
      ["스키마 매퍼", "fixture 제안", false],
      ["매핑 승인", "사람 · 제안 해시와 정확히 일치", false],
      ["정본 이벤트 집합", "코드 · 승인된 매핑에서 다시 도출", false],
      ["데이터셋 프로파일", "코드 · 한정된 사실", false],
      ["한정된 사례 제안기", "계획 · 지금은 직접 작성한 manifest", true],
      ["사례 승인", "사람 · 범위 해시와 정확히 일치", false],
      ["리플레이 엔진", "코드 · 다섯 규칙 gate", false],
      ["발견 소스 추적", "코드 · 원본 행", false],
      ["증거 번들", "코드 · 원본 바이트 기반 검증", false],
    ],
    refusedNote:
      "거부된 요청에는 검토 상태만 담기고, 결과 해시는 담기지 않습니다.",
    layers: LAYERS_KO,
    canonicalHeading: "정본 해시가 덮는 범위",
    canonicalOne:
      "는 엔진 버전, 의미 이벤트, 평가를 해시합니다. 실행 메타데이터는 제외합니다.",
    canonicalTwo:
      "승인 기록과 모든 매핑·manifest 항목은 별도 번들 해시로 보호합니다. 엔진은 원본 바이트에서 그 선언을 독립 검증하며, 브라우저 내보내기는 계획 단계입니다.",
    canonicalThree:
      "가이드 진행은 화면 상태입니다. 지속되는 감사 이력은 아직 없습니다.",
    walkThrough: "사례 따라가기",
  },
};

export function ArchitectureContent() {
  const { language } = useLanguage();
  const text = useCopy(architectureCopy);

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
          {/* The diagram is drawn from the copy table beside it, so its words
              follow the reader's language and are set in the committed faces.
              The markup is this module's own output over committed geometry —
              no request, no reader input, nothing to escape. */}
          <div
            className="inline-diagram"
            dangerouslySetInnerHTML={{
              __html: howItWorksSvg(language, "inline"),
            }}
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
