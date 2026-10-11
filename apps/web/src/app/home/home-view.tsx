"use client";

import Link from "next/link";
import React from "react";

import { FAILURE_LOG_ENTRIES } from "../evals/model-comparison-data";
import { GUIDE_STAGES, guideStageNames } from "../guide-stages";
import { useCopy, useLanguage } from "../i18n/language";
import { SentenceLines as Lines, Phrased } from "../shell/sentence-lines";
import { homeCopy } from "./copy";

import "./home.css";

export function HomeContent() {
  const text = useCopy(homeCopy);
  const stageNames = useCopy(guideStageNames);
  const { language } = useLanguage();
  const failureLog = `https://github.com/WeaveTrail/WeaveTrail/blob/develop/docs/AI_FAILURE_LOG${language === "ko" ? ".ko" : ""}.md`;

  return (
    <main className="home">
      <section className="home-hero shell" aria-labelledby="home-title">
        <div className="home-intro">
          <span className="eyebrow">{text.intro.eyebrow}</span>
          <h1 id="home-title">
            <Phrased text={text.intro.title} />
          </h1>
          <Lines className="home-lede" lines={text.intro.lede} />
          <div className="hero-actions">
            <Link className="button primary" href="/replay?mode=guided">
              {text.intro.walkThrough}
            </Link>
          </div>
          <p className="home-walk-meta">
            <span>{text.intro.walkMeta}</span>
            <span>{text.intro.demoNote}</span>
          </p>
        </div>

        <figure className="home-flow" aria-labelledby="home-flow-title">
          <figcaption>
            <h2 className="eyebrow" id="home-flow-title">
              {text.flowLabel}
            </h2>
          </figcaption>
          <ol>
            {GUIDE_STAGES.map((stage, index) => (
              <li data-stage={stage} key={stage}>
                <span className="home-flow-index" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3>{stageNames[stage]}</h3>
                  <p>{text.stages[stage]}</p>
                </div>
              </li>
            ))}
          </ol>
        </figure>
      </section>

      <section className="home-band" aria-labelledby="home-benefits">
        <div className="shell">
          <div className="section-heading">
            <span>{text.benefitsKicker}</span>
            <h2 id="home-benefits">
              <Phrased text={text.benefitsHeading} />
            </h2>
          </div>
          <ul className="home-benefits">
            {text.benefits.map(([title, body]) => (
              <li key={title}>
                <h3>{title}</h3>
                <Lines className="home-benefit-text" lines={body} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="shell home-model" aria-labelledby="home-model">
        <div className="section-heading">
          <span>{text.modelKicker}</span>
          <h2 id="home-model">
            <Phrased text={text.modelHeading} />
          </h2>
        </div>
        <Lines className="home-model-text" lines={text.modelLines} />
        <p className="home-model-links">
          <Link className="button secondary" href="/evals">
            {text.comparisonLink}
          </Link>
          <a href={failureLog}>
            {text.failureLogLink(FAILURE_LOG_ENTRIES.length)}
          </a>
        </p>
        <div className="home-boundary">
          <Lines className="home-boundary-text" lines={text.boundary} />
          <Link href="/why">{text.whyLink}</Link>
        </div>
      </section>
    </main>
  );
}
