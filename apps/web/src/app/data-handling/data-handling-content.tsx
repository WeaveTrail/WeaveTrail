"use client";

import React from "react";

import { ExplainerPage, ExplainerSection } from "../explainer/explainer";
import { useCopy } from "../i18n/language";
import { dataHandlingCopy, evidencePaths, type Evidence } from "./copy";

const REPOSITORY = "https://github.com/WeaveTrail/WeaveTrail";

export function evidenceUrl(evidence: Evidence, revision: string): string {
  return `${REPOSITORY}/blob/${revision}/${evidencePaths[evidence]}`;
}

/** `revision` is the commit the page was built from, or a branch locally. */
export function DataHandlingContent({ revision }: { revision: string }) {
  const text = useCopy(dataHandlingCopy);
  return (
    <ExplainerPage
      answer={<p>{text.answer}</p>}
      eyebrow={text.eyebrow}
      sections={[
        ["statements", text.sections.statements],
        ["outside", text.sections.outside],
      ]}
      title={text.title}
    >
      <ExplainerSection
        id="statements"
        items={text.statements.map((statement) => ({
          key: statement.question,
          title: statement.question,
          status: "implemented",
          line: (
            <>
              {statement.answer}{" "}
              {statement.links.map(([label, evidence], index) => (
                <React.Fragment key={evidence}>
                  {index > 0 ? " · " : null}
                  <a href={evidenceUrl(evidence, revision)}>{label}</a>
                </React.Fragment>
              ))}
            </>
          ),
        }))}
        line={text.statementsLine}
        title={text.sections.statements}
      />
      <ExplainerSection
        id="outside"
        line={text.outsideLine}
        link={[
          text.fullDocument[0],
          evidenceUrl(text.fullDocument[1], revision),
        ]}
        more={text.outsideMore.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        title={text.sections.outside}
      />
    </ExplainerPage>
  );
}
