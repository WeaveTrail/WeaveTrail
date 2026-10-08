"use client";

import { PROMPT_VERSIONS } from "@weavetrail/contracts";
import React, { useRef, useSyncExternalStore } from "react";

import { useLanguage } from "../i18n/language";
import {
  PANEL_KEYS,
  TERM_KEYS,
  modelComparisonCopy,
  type PanelKey,
  type TermKey,
} from "./model-comparison-copy";
import {
  CHART,
  DECLARED_MODELS,
  FAILURE_LOG_ENTRIES,
  PROMPT_HISTORY,
  REFERENCE_NAME,
  RULE,
  TAGS,
  chartPoints,
  definitionLinks,
  dollars,
  failureLogAnchor,
  failureModes,
  fraction,
  knownCost,
  percent,
  type ComparisonGroup,
  type Count,
  type HeldOutResult,
} from "./model-comparison-data";

/**
 * The open panel lives in `?view=` and changes through the History API, so
 * switching panels never reloads the page and a copied URL restores the view.
 * The server snapshot is the first panel, so hydration always agrees.
 */
const panelListeners = new Set<() => void>();
function subscribePanel(listener: () => void) {
  if (panelListeners.size === 0) window.addEventListener("popstate", emitPanel);
  panelListeners.add(listener);
  return () => {
    panelListeners.delete(listener);
    if (panelListeners.size === 0)
      window.removeEventListener("popstate", emitPanel);
  };
}
function emitPanel() {
  for (const listener of panelListeners) listener();
}
function readPanel(): PanelKey {
  const view = new URLSearchParams(window.location.search).get("view");
  return (PANEL_KEYS as readonly string[]).includes(view ?? "")
    ? (view as PanelKey)
    : "chart";
}
function choosePanel(panel: PanelKey, hash = "") {
  const url = new URL(window.location.href);
  url.searchParams.set("view", panel);
  url.hash = hash;
  window.history.replaceState(window.history.state, "", url);
  emitPanel();
}

const termId = (key: TermKey) => `term-${key}`;

export function ModelComparison({
  result,
}: {
  readonly result: HeldOutResult | null;
}) {
  const { language } = useLanguage();
  const t = modelComparisonCopy[language];
  const links = definitionLinks(language);
  const panel = useSyncExternalStore(subscribePanel, readPanel, () => "chart");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const decision = result?.decision;
  const answer = !decision
    ? t.answer.pending
    : decision.outcome === "NO_MODEL" || !decision.primary
      ? t.answer.noModel
      : decision.escalation
        ? t.answer.selected(decision.primary, decision.escalation)
        : t.answer.primaryOnly(decision.primary);
  const primaryValue = !decision
    ? t.roleValue.pending
    : (decision.primary ?? t.roleValue.noModel);
  const escalationValue = !decision
    ? t.roleValue.pending
    : decision.primary
      ? (decision.escalation ?? t.roleValue.noEscalation)
      : t.roleValue.noModel;

  const models = result
    ? result.comparison.groups.filter((g) => g.role === "MODEL")
    : [];
  const reference = result?.comparison.groups.find(
    (g) => g.role === "REFERENCE",
  );
  const groupName = (group: ComparisonGroup) =>
    group.role === "REFERENCE"
      ? t.referenceName
      : group.identity.requestedModel;

  /** A rate that links to its definition; a zero denominator is unavailable. */
  const rate = (count: Count) => {
    const share = percent(count);
    return (
      <a className="mc-number" href={links.metrics}>
        {share === null ? t.unavailable : `${fraction(count)} · ${share}`}
      </a>
    );
  };
  const cost = (group: ComparisonGroup) => {
    const all = group.byTag.ALL!;
    const sum = group.role === "REFERENCE" ? null : knownCost(all);
    return (
      <a className="mc-number" href={links.metrics}>
        {sum === null ? t.unavailable : dollars(sum)}
        <small>
          {t.coverage(all.costMicroUsd.coveredRuns, all.costMicroUsd.totalRuns)}
        </small>
      </a>
    );
  };
  const term = (key: TermKey, label: string) => (
    <a
      className="mc-term"
      href={`#${termId(key)}`}
      onClick={(event) => {
        event.preventDefault();
        choosePanel("terms", termId(key));
        requestAnimationFrame(() =>
          document.getElementById(termId(key))?.focus(),
        );
      }}
    >
      {label}
    </a>
  );

  const metricColumns = [
    ["strictAccuracy", (m) => m.strictAccuracy],
    ["validOutput", (m) => m.validOutput],
    ["overAbstention", (m) => m.abstention.over],
    ["misassignment", (m) => m.misassignment],
    ["inventedField", (m) => m.inventedField],
    ["injectionFollowed", (m) => m.injectionFollowed],
  ] as const satisfies readonly (readonly [
    TermKey & keyof typeof t.columns,
    (m: ComparisonGroup["byTag"][string]) => Count,
  ])[];

  const eligibilityRow = (group: ComparisonGroup) => {
    const all = group.byTag.ALL!;
    const isReference = group.role === "REFERENCE";
    const eligible = decision?.eligible.includes(group.identity.requestedModel);
    return (
      <tr
        className={isReference ? "mc-reference" : undefined}
        data-eligible={isReference ? undefined : String(Boolean(eligible))}
        key={groupName(group)}
      >
        <th scope="row">
          {groupName(group)}
          {isReference ? <small>{REFERENCE_NAME}</small> : null}
        </th>
        <td>
          {isReference
            ? t.eligibility.reference
            : eligible
              ? t.eligibility.eligible
              : t.eligibility.ineligible}
        </td>
        {metricColumns.map(([key, pick]) => (
          <td key={key}>{rate(pick(all))}</td>
        ))}
        <td>{cost(group)}</td>
      </tr>
    );
  };

  const pendingRow = (name: string, isReference: boolean) => (
    <tr className={isReference ? "mc-reference" : undefined} key={name}>
      <th scope="row">
        {isReference ? t.referenceName : name}
        {isReference ? <small>{REFERENCE_NAME}</small> : null}
      </th>
      <td>{isReference ? t.eligibility.reference : t.eligibility.pending}</td>
      {metricColumns.map(([key]) => (
        <td key={key}>{t.notRun}</td>
      ))}
      <td>{t.notRun}</td>
    </tr>
  );

  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    const last = PANEL_KEYS.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    choosePanel(PANEL_KEYS[next]!);
    tabs.current[next]?.focus();
  };

  return (
    <section
      aria-labelledby="model-comparison-answer"
      className="model-comparison"
    >
      <div className="mc-answer">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1 id="model-comparison-answer">{answer}</h1>
        <dl className="mc-roles">
          <div>
            <dt>{term("primary", t.roles.primary)}</dt>
            <dd
              className={decision?.primary ? "mc-model" : undefined}
              data-role="primary"
            >
              {primaryValue}
            </dd>
          </div>
          <div>
            <dt>{term("escalation", t.roles.escalation)}</dt>
            <dd
              className={decision?.escalation ? "mc-model" : undefined}
              data-role="escalation"
            >
              {escalationValue}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mc-caption" id="mc-eligibility-caption">
        {result ? t.caption.run(result.runDate) : t.caption.pending}
      </p>
      <div
        aria-label={t.tableScroll}
        className="mc-table-wrap"
        role="region"
        tabIndex={0}
      >
        <table
          aria-labelledby="mc-eligibility-caption"
          className="mc-table mc-eligibility"
        >
          <thead>
            <tr>
              <th scope="col">{t.columns.model}</th>
              <th scope="col">{term("eligible", t.columns.eligible)}</th>
              {metricColumns.map(([key]) => (
                <th key={key} scope="col">
                  {term(key, t.columns[key])}
                </th>
              ))}
              <th scope="col">{term("cost", t.columns.cost)}</th>
            </tr>
          </thead>
          <tbody>
            {result
              ? [...models, ...(reference ? [reference] : [])].map(
                  eligibilityRow,
                )
              : [
                  ...DECLARED_MODELS.map((m) => pendingRow(m, false)),
                  pendingRow(REFERENCE_NAME, true),
                ]}
          </tbody>
        </table>
      </div>

      <div aria-label={t.panelLabel} className="mc-tabs" role="tablist">
        {PANEL_KEYS.map((key, index) => (
          <button
            aria-controls={`mc-panel-${key}`}
            aria-selected={panel === key}
            id={`mc-tab-${key}`}
            key={key}
            onClick={() => choosePanel(key)}
            onKeyDown={(event) => onTabKey(event, index)}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            role="tab"
            tabIndex={panel === key ? 0 : -1}
            type="button"
          >
            {t.panels[key]}
          </button>
        ))}
      </div>

      {PANEL_KEYS.map((key) => (
        <div
          aria-labelledby={`mc-tab-${key}`}
          className="mc-panel"
          hidden={panel !== key}
          id={`mc-panel-${key}`}
          key={key}
          role="tabpanel"
          tabIndex={0}
        >
          {key === "chart"
            ? chartPanel()
            : key === "tags"
              ? tagsPanel()
              : key === "failures"
                ? failuresPanel()
                : key === "rule"
                  ? rulePanel()
                  : key === "prompts"
                    ? promptsPanel()
                    : key === "terms"
                      ? termsPanel()
                      : limitsPanel()}
        </div>
      ))}
    </section>
  );

  function chartPanel() {
    if (!result) return <p className="mc-empty">{t.chart.pending}</p>;
    const points = chartPoints(result);
    return (
      <>
        <svg
          aria-describedby="mc-chart-desc"
          aria-labelledby="mc-chart-title"
          className="mc-chart"
          role="img"
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        >
          <title id="mc-chart-title">{t.chart.title}</title>
          <desc id="mc-chart-desc">{t.chart.description}</desc>
          <line
            className="mc-axis"
            x1={CHART.plotLeft}
            x2={CHART.plotRight}
            y1={CHART.plotBottom}
            y2={CHART.plotBottom}
          />
          <line
            className="mc-axis"
            x1={CHART.plotLeft}
            x2={CHART.plotLeft}
            y1={CHART.plotTop}
            y2={CHART.plotBottom}
          />
          <text className="mc-axis-label" x={CHART.plotLeft} y={CHART.height}>
            {t.chart.xAxis} →
          </text>
          <text className="mc-axis-label" x={4} y={CHART.plotTop - 6}>
            ↑ {t.chart.yAxis}
          </text>
          <text
            className="mc-axis-label"
            textAnchor="middle"
            x={CHART.unknownLane}
            y={CHART.plotBottom + 16}
          >
            {t.chart.unknownLane}
          </text>
          {points.map((point, index) => (
            <g data-kind={point.kind} key={point.name}>
              {point.kind === "reference" ? (
                <rect
                  className="mc-mark mc-mark-reference"
                  height={10}
                  transform={`rotate(45 ${point.x} ${point.y})`}
                  width={10}
                  x={point.x - 5}
                  y={point.y - 5}
                />
              ) : (
                <circle
                  className={`mc-mark mc-mark-${point.kind}`}
                  cx={point.x}
                  cy={point.y}
                  r={6}
                />
              )}
              {/* Clustered marks carry a number; the table below names it. */}
              <text className="mc-mark-label" x={point.x + 8} y={point.y - 7}>
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
        <p className="mc-legend">
          <span>{t.chart.legend.eligible}</span>
          <span>{t.chart.legend.ineligible}</span>
          <span>{t.chart.legend.reference}</span>
        </p>
        <div
          aria-label={t.tableScroll}
          className="mc-table-wrap"
          role="region"
          tabIndex={0}
        >
          <table className="mc-table">
            <caption>{t.chart.tableCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{t.columns.model}</th>
                <th scope="col">{t.columns.eligible}</th>
                <th scope="col">{t.columns.strictAccuracy}</th>
                <th scope="col">{t.columns.cost}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr data-kind={point.kind} key={point.name}>
                  <th scope="row">
                    {index + 1}.{" "}
                    {point.kind === "reference" ? t.referenceName : point.name}
                  </th>
                  <td>
                    {point.kind === "reference"
                      ? t.eligibility.reference
                      : point.kind === "eligible"
                        ? t.eligibility.eligible
                        : t.eligibility.ineligible}
                  </td>
                  <td>{rate(point.accuracy)}</td>
                  <td>
                    <a className="mc-number" href={links.metrics}>
                      {point.cost === null
                        ? t.unavailable
                        : dollars(point.cost)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  function tagsPanel() {
    if (!result) return <p className="mc-empty">{t.tags.pending}</p>;
    const groups = [...models, ...(reference ? [reference] : [])];
    return (
      <div className="mc-table-wrap">
        <table className="mc-table">
          <caption>{t.tags.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{t.tags.tag}</th>
              {groups.map((group) => (
                <th key={groupName(group)} scope="col">
                  {groupName(group)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TAGS.map((tag) => (
              <tr key={tag}>
                <th scope="row">
                  {t.tags.names[tag]}
                  <small>{tag}</small>
                </th>
                {groups.map((group) => (
                  <td key={groupName(group)}>
                    {rate(group.byTag[tag]!.strictAccuracy)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function failureLog() {
    return (
      <>
        <h2>{t.failures.logTitle}</h2>
        <p>{t.failures.logIntro}</p>
        <ul className="mc-list">
          {FAILURE_LOG_ENTRIES.map((entry) => (
            <li key={entry.id}>
              <a
                href={
                  links.failureLog + failureLogAnchor(entry[language], entry.id)
                }
              >
                {entry.id}: {entry[language]}
              </a>{" "}
              <code>{entry.status}</code>
            </li>
          ))}
        </ul>
      </>
    );
  }

  function failuresPanel() {
    if (!result)
      return (
        <>
          <p className="mc-empty">{t.failures.pending}</p>
          {failureLog()}
        </>
      );
    const failed = result.decision.primaryFailedDialects;
    return (
      <>
        <p>{t.failures.intro}</p>
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead>
              <tr>
                <th scope="col">{t.failures.model}</th>
                <th scope="col">{t.failures.modes}</th>
              </tr>
            </thead>
            <tbody>
              {models.map((group) => {
                const modes = failureModes(group);
                return (
                  <tr key={groupName(group)}>
                    <th scope="row">{groupName(group)}</th>
                    <td>
                      {modes.length === 0 ? (
                        t.failures.none
                      ) : (
                        <ul className="mc-list">
                          {modes.map((mode) => (
                            <li key={mode.key}>
                              {t.failures.modeNames[mode.key]}{" "}
                              {rate(mode.count)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {result.decision.primary ? (
          <p>
            {t.failures.primaryFailed(failed.length)}
            {failed.length ? `: ${failed.join(", ")}` : ""}
          </p>
        ) : null}
        <p className="mc-links">
          <a href={result.links.records}>{t.failures.records}</a>
          <a href={result.links.sessionReceipt}>{t.failures.receipt}</a>
        </p>
        {failureLog()}
      </>
    );
  }

  function rulePanel() {
    const threshold = (count: Count) => (
      <a className="mc-number" href={links.rule}>
        {fraction(count)}
      </a>
    );
    return (
      <>
        <p>{t.rule.intro}</p>
        <p>{t.rule.eligibility}</p>
        <ul className="mc-list">
          {t.rule.eligibilityItems.map(([before, key, after]) => (
            <li key={before}>
              {before}
              {key ? threshold(RULE[key]) : null}
              {after}
            </li>
          ))}
        </ul>
        <p>
          {t.rule.primary[0]}
          {threshold(RULE.primaryAccuracy)}
          {t.rule.primary[1]}
        </p>
        <p>{t.rule.escalation}</p>
        <p>{t.rule.noModel}</p>
        <p className="mc-links">
          <a href={links.rule}>{t.rule.definition}</a>
          <a href={links.adr}>{t.rule.adr}</a>
        </p>
      </>
    );
  }

  function promptsPanel() {
    return (
      <>
        <p>{t.prompts.intro}</p>
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead>
              <tr>
                <th scope="col">{t.prompts.version}</th>
                <th scope="col">{t.prompts.introduced}</th>
                <th scope="col">{t.prompts.sent}</th>
                <th scope="col">{t.prompts.note}</th>
              </tr>
            </thead>
            <tbody>
              {PROMPT_VERSIONS.map((version) => {
                const row = PROMPT_HISTORY[version];
                return (
                  <tr key={version}>
                    <th scope="row">
                      <code>{version}</code>
                    </th>
                    <td>{row.introduced}</td>
                    <td>{row.model ? t.prompts.yes : t.prompts.no}</td>
                    <td>{row[language]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mc-links">
          <a
            href={`${links.failureLog}#${language === "ko" ? "프롬프트-버전" : "prompt-versions"}`}
          >
            {t.prompts.log}
          </a>
        </p>
      </>
    );
  }

  function termsPanel() {
    return (
      <dl className="mc-terms">
        {TERM_KEYS.map((key) => (
          <div id={termId(key)} key={key} tabIndex={-1}>
            <dt>{t.terms[key][0]}</dt>
            <dd>{t.terms[key][1]}</dd>
          </div>
        ))}
      </dl>
    );
  }

  function limitsPanel() {
    return (
      <>
        <p>
          {result ? t.limits.runDate(result.runDate) : t.limits.pendingRunDate}{" "}
          {t.limits.ruleAccepted}{" "}
          {t.limits.prices(result?.comparison.priceTable.dated ?? "2026-10-08")}
        </p>
        <ul className="mc-list">
          {t.limits.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mc-links">
          <a href={links.protocol}>{t.limits.protocol}</a>
          <a href={links.prices}>{t.columns.cost}</a>
        </p>
      </>
    );
  }
}
