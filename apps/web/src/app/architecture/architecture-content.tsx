"use client";

import React from "react";

import { ExplainerPage, ExplainerSection } from "../explainer/explainer";
import { useCopy, useLanguage } from "../i18n/language";
import { SentenceLines } from "../shell/sentence-lines";
import { architectureCopy } from "./copy";

const SECTIONS = [
  "roles",
  "results",
  "mistakes",
  "repeat",
  "data",
  "docs",
] as const;

const REPOSITORY = "https://github.com/WeaveTrail/WeaveTrail/blob/develop";

/** A short list of one-sentence points. */
function Points({ points }: { points: readonly string[] }) {
  return (
    <ul className="explainer-list">
      {points.map((point) => (
        <li key={point}>{point}</li>
      ))}
    </ul>
  );
}

/**
 * How the service runs: who does what, the three results, what happens when
 * the AI is wrong, why a rerun repeats, and how data is handled. The
 * repository documents hold the detail.
 */
export function ArchitectureContent() {
  const { language } = useLanguage();
  const text = useCopy(architectureCopy);
  const document = (file: string) =>
    `${REPOSITORY}/docs/${file}${language === "ko" ? ".ko" : ""}.md`;

  return (
    <ExplainerPage
      answer={<SentenceLines lines={text.answer} />}
      eyebrow={text.eyebrow}
      sections={SECTIONS.map((id) => [id, text.sections[id]])}
      title={text.title}
    >
      <ExplainerSection
        id="roles"
        items={text.roles.map(([title, body]) => ({
          key: title,
          title,
          line: <SentenceLines lines={body} />,
        }))}
        line={text.rolesLine}
        title={text.sections.roles}
        wide
      />
      <ExplainerSection
        id="results"
        items={text.results.map(([result, name, body]) => ({
          key: result,
          title: (
            <>
              {name} <code data-result={result}>{result}</code>
            </>
          ),
          line: body,
        }))}
        line={text.resultsLine}
        title={text.sections.results}
        wide
      >
        <p className="explainer-note">{text.reviewRequired}</p>
      </ExplainerSection>
      <ExplainerSection
        id="mistakes"
        line={text.mistakesLine}
        link={[text.comparisonLink, "/evals"]}
        title={text.sections.mistakes}
      >
        <Points points={text.mistakes} />
      </ExplainerSection>
      <ExplainerSection
        id="repeat"
        line={text.repeatLine}
        title={text.sections.repeat}
      >
        <Points points={text.repeat} />
      </ExplainerSection>
      <ExplainerSection
        id="data"
        line={text.dataLine}
        title={text.sections.data}
      >
        <Points points={text.data} />
      </ExplainerSection>
      <ExplainerSection
        id="docs"
        line={text.docsLine}
        title={text.sections.docs}
      >
        <ul className="explainer-list">
          {text.docs.map(([title, file]) => (
            <li key={file}>
              <a href={document(file)}>{title}</a>
            </li>
          ))}
        </ul>
      </ExplainerSection>
    </ExplainerPage>
  );
}
