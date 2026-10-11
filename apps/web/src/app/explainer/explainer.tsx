"use client";

import Link from "next/link";
import React from "react";

import { useCopy } from "../i18n/language";
import { Phrased } from "../shell/sentence-lines";
import { explainerCopy } from "./copy";

import "./explainer.css";

/**
 * The shape every explanatory page shares (ADR 0076): one opening answer,
 * then sections a reader can scan. Each section is a title and one short
 * line; anything longer waits in one disclosure or behind one link.
 */
export function ExplainerPage({
  eyebrow,
  title,
  answer,
  sections,
  children,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly answer: React.ReactNode;
  /** Section ids and titles, for the contents line under the answer. */
  readonly sections: readonly (readonly [id: string, title: string])[];
  readonly children: React.ReactNode;
}) {
  const text = useCopy(explainerCopy);
  return (
    <main className="shell page-shell explainer">
      <header className="explainer-head">
        <span className="eyebrow">{eyebrow}</span>
        <h1>
          <Phrased text={title} />
        </h1>
        <div className="explainer-answer">{answer}</div>
        <nav aria-label={text.onThisPage} className="explainer-contents">
          <ol>
            {sections.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ol>
        </nav>
      </header>
      {children}
    </main>
  );
}

export interface ExplainerItem {
  readonly title: React.ReactNode;
  readonly line: React.ReactNode;
  /** Shown as a status word beside the title; never colour alone. */
  readonly status?: "implemented" | "planned";
  readonly key: string;
}

export function ExplainerSection({
  id,
  title,
  line,
  items,
  wide,
  more,
  link,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly line: React.ReactNode;
  readonly items?: readonly ExplainerItem[];
  /** One item per row, for items whose lines are whole sentences. */
  readonly wide?: boolean;
  readonly more?: React.ReactNode;
  readonly link?: readonly [label: string, href: string];
  /** Content that has to stay in view, such as a list citations jump to. */
  readonly children?: React.ReactNode;
}) {
  const text = useCopy(explainerCopy);
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="explainer-section"
      id={id}
    >
      <h2 id={`${id}-title`}>{title}</h2>
      <div className="explainer-line">{line}</div>
      {items ? (
        <ul className="explainer-items" data-layout={wide ? "wide" : undefined}>
          {items.map((item) => (
            <li data-status={item.status} key={item.key}>
              <strong>
                {item.title}
                {item.status ? (
                  <span
                    className={
                      item.status === "implemented"
                        ? "pill implemented"
                        : "pill"
                    }
                  >
                    {item.status === "implemented"
                      ? text.implemented
                      : text.planned}
                  </span>
                ) : null}
              </strong>
              <div className="explainer-item-line">{item.line}</div>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
      {more ? (
        <details className="explainer-more">
          <summary>{text.more}</summary>
          <div>{more}</div>
        </details>
      ) : null}
      {link ? (
        <p className="explainer-link">
          {link[1].startsWith("/") ? (
            <Link href={link[1]}>{link[0]}</Link>
          ) : (
            <a href={link[1]}>{link[0]}</a>
          )}
        </p>
      ) : null}
    </section>
  );
}
