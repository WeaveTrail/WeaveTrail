"use client";

import Link from "next/link";
import React from "react";

import { useCopy, useLanguage, type Language } from "../i18n/language";
import {
  CONCLUSION_NOT_METHOD,
  NO_UPSTREAM_INTEGRATION,
  OWN_REASONING_MARK,
  POSITION,
  additionStatements,
  diagramAttribution,
  gateInputs,
  handoverStatements,
  layerAuthorities,
  lede,
  notClaimed,
  sources,
  upstreamStatements,
  type Localized,
  type SourceId,
  type Statement,
} from "./why-content";

interface WhyCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly intro: string;
  readonly sectionUpstream: string;
  readonly sectionHandover: string;
  readonly sectionAddition: string;
  readonly sectionPosition: string;
  readonly sectionAuthority: string;
  readonly sectionNotClaimed: string;
  readonly diagramLabel: string;
  readonly diagramAlt: string;
  readonly readingLabel: string;
  readonly readingText: string;
  readonly positionLede: string;
  readonly may: string;
  readonly mayNot: string;
  readonly statusLabel: string;
  readonly implementedLabel: string;
  readonly implementedText: string;
  readonly sourcesLabel: string;
  readonly sourcesLede: (mark: string) => string;
  readonly seeTheChain: string;
}

/**
 * Voice copy — the headline and the section headings — is written in each
 * language. Everything the page argues lives in `why-content`, where the two
 * languages carry the same claims.
 */
export const whyCopy: Readonly<Record<Language, WhyCopy>> = {
  en: {
    eyebrow: "Where it fits",
    headline: "AI already finds it. Someone still has to answer for it.",
    intro:
      "This page states what that layer already does, what it still hands to a person, what this project adds to it, and what it refuses to do on its behalf.",
    sectionUpstream: "01 · What upstream surveillance already does",
    sectionHandover: "02 · What it still hands to a person",
    sectionAddition: "03 · What this adds to it",
    sectionPosition: "04 · Where the gate sits",
    sectionAuthority: "05 · What each of the four layers may and may not do",
    sectionNotClaimed: "06 · What this page does not claim",
    diagramLabel: "Diagram: where the gate sits",
    diagramAlt:
      "Three bands top to bottom: an existing upstream pipeline carries order and trade data into an AI market surveillance process that detects, narrows and drafts, and emits an alert; beneath that output sits the gate, which asks for source executions, an approved review scope and a versioned hypothesis, runs four single-authority layers, and returns one of three results or a review state; beneath the gate an investigator reads the result and the rows behind it and decides what the case is",
    readingLabel: "Reading the diagram",
    readingText:
      "The upper band is not part of WeaveTrail. The gate reads what that band concluded, never how it concluded it, and the decision stays in the lower band.",
    positionLede:
      "The gate sits after an alert or a referral and before an investigation concludes. Evaluating a pattern hypothesis needs all three declared inputs below, and a request missing one is refused. Normalization is the narrower path: with an approved mapping and no case manifest, a foundation replay returns ordering, deduplication and a canonical result hash, and no pattern verdict.",
    may: "May.",
    mayNot: "May not.",
    statusLabel: "Status",
    implementedLabel: "Implemented",
    implementedText: "Enforced by contract on every replay request.",
    sourcesLabel: "Sources",
    sourcesLede: (mark) =>
      `Every statement on this page about anything outside this repository carries one of these sources or the mark beside it, the lede and the diagram caption included. Anything marked “${mark}” is a premise this project works from, not a published finding.`,
    seeTheChain: "See the implemented chain",
  },
  ko: {
    eyebrow: "어디에 쓰이나",
    headline: "찾아내는 것은 AI가 합니다. 답은 사람이 해야 합니다.",
    intro:
      "이 페이지는 네 가지를 적어둡니다. 그 층이 이미 하는 일, 그래도 사람에게 넘기는 일, 이 프로젝트가 거기에 더하는 일, 그리고 대신 해주지는 않는 일입니다.",
    sectionUpstream: "01 · 상류 감시가 이미 하는 일",
    sectionHandover: "02 · 그래도 사람에게 넘기는 일",
    sectionAddition: "03 · 여기에 더하는 것",
    sectionPosition: "04 · 이 단계가 놓이는 자리",
    sectionAuthority: "05 · 네 계층이 할 수 있는 일과 할 수 없는 일",
    sectionNotClaimed: "06 · 이 페이지가 주장하지 않는 것",
    diagramLabel: "다이어그램: 이 단계가 놓이는 자리",
    diagramAlt:
      "위에서 아래로 띠 세 개. 맨 위는 이미 돌아가는 상류 파이프라인입니다. 주문과 체결 데이터가 AI 시장감시 프로세스로 들어가 탐지, 구간 좁히기, 보고서 초안 작성을 거쳐 알림으로 나옵니다. 그 아래에 게이트가 놓입니다. 게이트가 요구하는 것은 셋입니다. 원본 체결 내역, 승인된 검토 범위, 그리고 버전이 붙은 가설입니다. 게이트는 네 계층을 차례로 돌립니다. 계층마다 권한은 하나씩입니다. 그런 다음 세 결과 가운데 하나, 또는 검토 상태를 돌려줍니다. 맨 아래에서 조사자가 결과와 그 뒤의 행을 읽고 사건을 판단합니다",
    readingLabel: "다이어그램 읽는 법",
    readingText:
      "맨 위 띠는 WeaveTrail이 아닙니다. 이 단계는 그 띠가 내린 결론을 읽을 뿐, 어떻게 결론에 이르렀는지는 읽지 않습니다. 판단은 아래 띠에 그대로 남습니다.",
    positionLede:
      "이 단계는 알림이나 통보가 나온 뒤, 조사가 결론에 이르기 전에 놓입니다. 패턴 가설을 평가하려면 아래 세 가지 선언된 입력이 모두 있어야 하고, 하나라도 빠진 요청은 거부합니다. 정규화는 그보다 좁은 경로입니다. 승인된 매핑만 있고 사례 manifest가 없으면, 기반 리플레이는 정렬과 중복 제거, 정본 결과 해시를 돌려주고 패턴 판정은 내지 않습니다.",
    may: "할 수 있는 일.",
    mayNot: "할 수 없는 일.",
    statusLabel: "상태",
    implementedLabel: "구현됨",
    implementedText: "모든 리플레이 요청에서 계약으로 강제합니다.",
    sourcesLabel: "출처",
    sourcesLede: (mark) =>
      `이 페이지에서 저장소 밖의 무엇인가를 말하는 문장에는 아래 출처 가운데 하나가 붙거나 옆에 표시가 붙습니다. 첫 문단과 다이어그램 설명도 마찬가지입니다. “${mark}” 표시가 붙은 문장은 이 프로젝트가 전제로 삼는 것이지, 공표된 사실이 아닙니다.`,
    seeTheChain: "구현된 체인 보기",
  },
};

function sourceFor(id: SourceId) {
  const source = sources.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`Statement cites an unlisted source: ${id}`);
  return source;
}

function Attributed({
  language,
  statement,
}: {
  readonly language: Language;
  readonly statement: Statement;
}) {
  if ("source" in statement) {
    const source = sourceFor(statement.source);
    return (
      <p className="attributed">
        {statement.text[language]}{" "}
        <a
          aria-label={`${source.marker}: ${source.publisher[language]}, ${source.title[language]}`}
          className="cite"
          href={`#source-${source.id}`}
        >
          [{source.marker}]
        </a>
      </p>
    );
  }
  return (
    <p className="attributed">
      <span className="reasoning-mark">{OWN_REASONING_MARK[language]}</span>{" "}
      {statement.text[language]}
    </p>
  );
}

export function WhyView() {
  const { language } = useLanguage();
  const text = useCopy(whyCopy);
  const say = (value: Localized) => value[language];

  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">{text.eyebrow}</span>
        <h1>{text.headline}</h1>
        <Attributed language={language} statement={lede} />
        <p className="lede-position">{say(POSITION)}</p>
        <p>{text.intro}</p>
      </div>

      <section className="panel" id="upstream">
        <span className="panel-label">{text.sectionUpstream}</span>
        {upstreamStatements.map((statement) => (
          <Attributed
            key={statement.text.en}
            language={language}
            statement={statement}
          />
        ))}
      </section>

      <section className="panel" id="handover">
        <span className="panel-label">{text.sectionHandover}</span>
        {handoverStatements.map((statement) => (
          <Attributed
            key={statement.text.en}
            language={language}
            statement={statement}
          />
        ))}
      </section>

      <section className="panel" id="what-this-adds">
        <span className="panel-label">{text.sectionAddition}</span>
        {additionStatements.map((statement) => (
          <Attributed
            key={statement.text.en}
            language={language}
            statement={statement}
          />
        ))}
      </section>

      <figure className="layer-diagram gate-diagram">
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
            height={800}
            src="/diagrams/where-the-gate-sits.svg"
            width={960}
          />
        </div>
        <figcaption>
          <span className="panel-label">{text.readingLabel}</span>
          <p>{text.readingText}</p>
          <Attributed language={language} statement={diagramAttribution} />
        </figcaption>
      </figure>

      <section className="panel" id="gate-position">
        <span className="panel-label">{text.sectionPosition}</span>
        <p>{text.positionLede}</p>
        {gateInputs.map(([name, detail]) => (
          <div className="responsibility" key={name.en}>
            <strong>{say(name)}</strong>
            <p>{say(detail)}</p>
          </div>
        ))}
        <p>{say(CONCLUSION_NOT_METHOD)}</p>
        <p>{say(NO_UPSTREAM_INTEGRATION)}</p>
      </section>

      <section className="layer-authorities" id="layer-authority">
        <span className="panel-label">{text.sectionAuthority}</span>
        <div className="eval-list">
          {layerAuthorities.map((layer) => (
            <article className="eval-row layer-authority" key={layer.name.en}>
              <h2>{say(layer.name)}</h2>
              <div>
                <p>
                  <strong>{text.may}</strong> {say(layer.may)}
                </p>
                <p>
                  <strong>{text.mayNot}</strong> {say(layer.mayNot)}
                </p>
              </div>
              <div>
                {layer.status ? (
                  <p>
                    <span className="pill">{text.statusLabel}</span>{" "}
                    {say(layer.status)}
                  </p>
                ) : (
                  <p>
                    <span className="pill implemented">
                      {text.implementedLabel}
                    </span>{" "}
                    {text.implementedText}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel" id="not-claimed">
        <span className="panel-label">{text.sectionNotClaimed}</span>
        <ul className="claim-boundary">
          {notClaimed.map((claim) => (
            <li key={claim.en}>{say(claim)}</li>
          ))}
        </ul>
      </section>

      <section className="panel" id="sources">
        <span className="panel-label">{text.sourcesLabel}</span>
        <p>{text.sourcesLede(OWN_REASONING_MARK[language])}</p>
        <ol className="source-list">
          {sources.map((source) => (
            <li id={`source-${source.id}`} key={source.id}>
              <span className="source-marker">[{source.marker}]</span>{" "}
              {say(source.publisher)},{" "}
              <a href={source.href} rel="noreferrer" target="_blank">
                {say(source.title)}
              </a>{" "}
              ({say(source.published)}).
            </li>
          ))}
        </ol>
        <Link className="button" href="/architecture">
          {text.seeTheChain}
        </Link>
      </section>
    </main>
  );
}
