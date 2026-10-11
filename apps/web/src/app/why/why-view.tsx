"use client";

import Link from "next/link";
import React from "react";

import { ExplainerPage, ExplainerSection } from "../explainer/explainer";
import { useCopy, useLanguage } from "../i18n/language";
import { SentenceLines } from "../shell/sentence-lines";
import { situation, sources, whyCopy, type Statement } from "./copy";

const SECTIONS = ["benefits", "limits", "sources"] as const;

/**
 * Why a reviewer would use WeaveTrail: the situation they are in, from two
 * published facts, then what they gain and what the service does not do.
 */
export function WhyView() {
  const { language } = useLanguage();
  const text = useCopy(whyCopy);

  /** A published fact, one line, with its citation. */
  const cited = ({ text: sentence, source: id }: Statement) => {
    const source = sources.find((candidate) => candidate.id === id);
    if (!source) throw new Error(`Statement cites an unlisted source: ${id}`);
    return (
      <span key={id}>
        {sentence[language]}{" "}
        <a
          aria-label={`${source.marker}: ${source.publisher[language]}, ${source.title[language]}`}
          className="cite"
          href={`#source-${source.id}`}
        >
          [{source.marker}]
        </a>
      </span>
    );
  };

  return (
    <ExplainerPage
      answer={
        <>
          <p className="attributed sentence-lines">{situation.map(cited)}</p>
          <SentenceLines className="why-answer" lines={text.answer} />
          <p className="hero-actions">
            <Link className="button primary" href="/replay?mode=guided">
              {text.walkThrough}
            </Link>
          </p>
        </>
      }
      eyebrow={text.eyebrow}
      sections={SECTIONS.map((id) => [id, text.sections[id]])}
      title={text.title}
    >
      <ExplainerSection
        id="benefits"
        items={text.benefits.map(([title, body]) => ({
          key: title,
          title,
          line: <SentenceLines lines={body} />,
        }))}
        line={text.benefitsLine}
        title={text.sections.benefits}
        wide
      />
      <ExplainerSection
        id="limits"
        line={text.limitsLine}
        title={text.sections.limits}
      >
        <ul className="explainer-list">
          {text.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </ExplainerSection>
      <ExplainerSection
        id="sources"
        line={text.sourcesLine}
        link={[text.next, "/architecture"]}
        title={text.sections.sources}
      >
        <ol className="source-list">
          {sources.map((source) => (
            <li id={`source-${source.id}`} key={source.id}>
              <span className="source-marker">[{source.marker}]</span>{" "}
              {source.publisher[language]},{" "}
              <a href={source.href} rel="noreferrer" target="_blank">
                {source.title[language]}
              </a>{" "}
              ({source.published[language]}).
            </li>
          ))}
        </ol>
      </ExplainerSection>
    </ExplainerPage>
  );
}
