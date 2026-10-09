"use client";

import React from "react";

import { ExplainerPage, ExplainerSection } from "../explainer/explainer";
import { useCopy, useLanguage } from "../i18n/language";
import { methodologyCopy } from "./copy";

const SECTIONS = ["results", "review", "roles", "computed", "limits"] as const;

export function MethodologyContent() {
  const { language } = useLanguage();
  const text = useCopy(methodologyCopy);
  const paragraphs = (lines: readonly string[]) =>
    lines.map((line) => <p key={line}>{line}</p>);
  return (
    <ExplainerPage
      answer={<p>{text.answer}</p>}
      eyebrow={text.eyebrow}
      sections={SECTIONS.map((id) => [id, text.sections[id]])}
      title={text.title}
    >
      <ExplainerSection
        id="results"
        items={text.results.map(([title, line]) => ({
          key: title,
          title: <span data-result={title}>{title}</span>,
          line,
        }))}
        line={text.resultsLine}
        title={text.sections.results}
      />
      <ExplainerSection
        id="review"
        line={text.reviewLine}
        more={<p>{text.reviewMore}</p>}
        title={text.sections.review}
      />
      <ExplainerSection
        id="roles"
        items={text.roles.map(([title, line]) => ({ key: title, title, line }))}
        line={text.rolesLine}
        title={text.sections.roles}
      />
      <ExplainerSection
        id="computed"
        line={text.computedLine}
        more={paragraphs(text.computedMore)}
        title={text.sections.computed}
      />
      <ExplainerSection
        id="limits"
        line={text.limitsLine}
        link={[
          text.document,
          `https://github.com/WeaveTrail/WeaveTrail/blob/develop/docs/METHODOLOGY${language === "ko" ? ".ko" : ""}.md`,
        ]}
        more={paragraphs(text.limitsMore)}
        title={text.sections.limits}
      />
    </ExplainerPage>
  );
}
