"use client";

import React from "react";

import { ExplainerPage, ExplainerSection } from "../explainer/explainer";
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
  inputLines,
  layerAuthorities,
  layerLines,
  lede,
  notClaimed,
  sectionLines,
  sources,
  upstreamStatements,
  whyCopy,
  type SourceId,
  type Statement,
} from "./copy";

function sourceFor(id: SourceId) {
  const source = sources.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`Statement cites an unlisted source: ${id}`);
  return source;
}

/** A sentence with its citation, or with the mark that it is our reading. */
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

const SECTIONS = [
  "upstream",
  "handover",
  "addition",
  "inputs",
  "layers",
  "notClaimed",
  "sources",
] as const;

/**
 * Where the gate sits: what detection already does, what it leaves to a
 * person, what this project adds, and what it needs and refuses. Every
 * sentence about a system outside this repository carries a citation or the
 * own-reading mark.
 */
export function WhyView() {
  const { language } = useLanguage();
  const text = useCopy(whyCopy);
  const say = (statement: Statement) => (
    <Attributed
      key={statement.text.en}
      language={language}
      statement={statement}
    />
  );

  return (
    <ExplainerPage
      answer={<p>{POSITION[language]}</p>}
      eyebrow={text.eyebrow}
      sections={SECTIONS.map((id) => [id, text.sections[id]])}
      title={text.title}
    >
      <ExplainerSection
        id="upstream"
        line={say(sectionLines.upstream)}
        more={[lede, ...upstreamStatements].map(say)}
        title={text.sections.upstream}
      />
      <ExplainerSection
        id="handover"
        line={say(sectionLines.handover)}
        more={handoverStatements.map(say)}
        title={text.sections.handover}
      />
      <ExplainerSection
        id="addition"
        line={say(sectionLines.addition)}
        more={additionStatements.map(say)}
        title={text.sections.addition}
      />
      <figure className="explainer-figure">
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
          <p>{text.diagramCaption}</p>
          {say(diagramAttribution)}
        </figcaption>
      </figure>
      <ExplainerSection
        id="inputs"
        items={gateInputs.map(([name], index) => ({
          key: name.en,
          title: name[language],
          line: inputLines[index]![language],
        }))}
        line={text.inputsLine}
        more={
          <>
            <dl>
              {gateInputs.map(([name, detail]) => (
                <div key={name.en}>
                  <dt>{name[language]}</dt>
                  <dd>{detail[language]}</dd>
                </div>
              ))}
            </dl>
            <p>{CONCLUSION_NOT_METHOD[language]}</p>
            <p>{NO_UPSTREAM_INTEGRATION[language]}</p>
          </>
        }
        title={text.sections.inputs}
      />
      <ExplainerSection
        id="layers"
        items={layerAuthorities.map((layer, index) => ({
          key: layer.name.en,
          title: layer.name[language],
          line: layerLines[index]![language],
        }))}
        line={text.layersLine}
        more={layerAuthorities.map((layer) => (
          <div className="layer-authority" key={layer.name.en}>
            <h3>{layer.name[language]}</h3>
            <p>
              <strong>{text.may}</strong> {layer.may[language]}
            </p>
            <p>
              <strong>{text.mayNot}</strong> {layer.mayNot[language]}
            </p>
            <p>{layer.status ? layer.status[language] : text.enforced}</p>
          </div>
        ))}
        title={text.sections.layers}
      />
      <ExplainerSection
        id="notClaimed"
        line={text.notClaimedLine}
        more={
          <ul>
            {notClaimed.map((claim) => (
              <li key={claim.en}>{claim[language]}</li>
            ))}
          </ul>
        }
        title={text.sections.notClaimed}
      />
      <ExplainerSection
        id="sources"
        line={text.sourcesLine(OWN_REASONING_MARK[language])}
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
