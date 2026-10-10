"use client";

import React from "react";

import { ExplainerPage, ExplainerSection } from "../explainer/explainer";
import { useCopy, useLanguage } from "../i18n/language";
import { architectureCopy } from "./copy";
import { howItWorksSvg } from "./how-it-works-diagram";

const SECTIONS = [
  ["layers", "layers"],
  ["authority", "authority"],
  ["boundary", "boundary"],
  ["chain", "chain"],
  ["canonical-hash", "hash"],
  ["packages", "packages"],
] as const;

export function ArchitectureContent() {
  const { language } = useLanguage();
  const text = useCopy(architectureCopy);
  const repository = "https://github.com/WeaveTrail/WeaveTrail/blob/develop";

  return (
    <ExplainerPage
      answer={<p>{text.answer}</p>}
      eyebrow={text.eyebrow}
      sections={SECTIONS.map(([id, key]) => [id, text.sections[key]])}
      title={text.title}
    >
      <ExplainerSection
        id="layers"
        items={text.layers.map(([title, line]) => ({
          key: title,
          title,
          line,
        }))}
        line={text.layersLine}
        title={text.sections.layers}
      >
        <figure className="explainer-figure">
          <div
            aria-label={text.diagramLabel}
            className="diagram-frame"
            role="group"
            tabIndex={0}
          >
            {/* The diagram is drawn from its copy table, so its words follow
                the reader's language and are set in the committed faces. The
                markup is this module's own output over committed geometry —
                no request, no reader input, nothing to escape. */}
            <div
              className="inline-diagram"
              dangerouslySetInnerHTML={{
                __html: howItWorksSvg(language, "inline"),
              }}
            />
          </div>
        </figure>
      </ExplainerSection>
      <ExplainerSection
        id="authority"
        line={text.authorityLine}
        link={[text.authorityLink, "/evals"]}
        more={<p>{text.authorityMore}</p>}
        title={text.sections.authority}
      />
      <ExplainerSection
        id="boundary"
        line={text.boundaryLine}
        more={text.boundaryMore.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        title={text.sections.boundary}
      />
      <ExplainerSection
        id="chain"
        items={text.chain.map(([title, line, planned]) => ({
          key: title,
          title,
          line,
          ...(planned ? { status: "planned" as const } : {}),
        }))}
        line={text.chainLine}
        title={text.sections.chain}
      />
      <ExplainerSection
        id="canonical-hash"
        line={text.hashLine}
        more={text.hashMore.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        title={text.sections.hash}
      />
      <ExplainerSection
        id="packages"
        items={text.packages.map(([title, line]) => ({
          key: title,
          title: <code>{title}</code>,
          line,
        }))}
        line={text.packagesLine}
        link={[
          text.document,
          `${repository}/docs/ARCHITECTURE${language === "ko" ? ".ko" : ""}.md`,
        ]}
        title={text.sections.packages}
      />
    </ExplainerPage>
  );
}
