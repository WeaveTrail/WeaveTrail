"use client";

import Link from "next/link";
import React from "react";
import { useLanguage } from "../i18n/language";

type Scenario = {
  scenario: string;
  label: string;
  workflowState: string;
  result: string | null;
  canonicalDatasetHash: string;
  canonicalResultHash: string;
  gates: readonly {
    gate: string;
    observedValue: string | null;
    threshold: string;
    passed: boolean | null;
  }[];
  hypothesis: null | {
    pattern: string;
    rules: readonly { ruleId: string; ruleVersion: string }[];
    manifestVersion: string;
    instrumentIds: readonly string[];
    actorIds: readonly string[];
    startTime: string;
    endTime: string;
  };
};
function Hash({ label, value }: { label: string; value: string }) {
  return (
    <div className="machine-hash">
      <span className="machine-label">{label}</span>
      <code className="machine-full">{value}</code>
    </div>
  );
}
const ko = {
  eyebrow: "커밋된 검증 기준",
  heading: "사례별 기대 결과",
  intro:
    "기준 실행의 워크플로 상태, 결과, gate 관측값, 정본 해시를 비교합니다. 법적·인과적·투자 결론은 아닙니다.",
  guide: "새 세션에서 기준 실행 재현하기",
  output: "기대 출력",
  final: "최종 워크플로 상태",
  result: "패턴 결과",
  noManifest:
    "이 소스에는 사례 manifest가 없습니다. 정규화만 하고 패턴은 평가하지 않습니다.",
  hypothesis: "버전이 붙은 가설",
  manifest: "Manifest 버전",
  instrument: "종목",
  actors: "승인된 행위자 그룹",
  window: "구간",
  dataset: "정본 데이터셋 해시",
  hash: "정본 결과 해시",
  gates: "Gate 관측값",
  observed: "관측값",
  threshold: "임계값",
  noGates: "이 소스에는 규칙 gate나 임계값이 선언되지 않았습니다.",
};

const koreanScenarioLabels: Readonly<Record<string, string>> = {
  "rapid-price-lift-supported.csv": "가격 급등 패턴 · 지지됨",
  "rapid-price-lift-broad-participation.csv": "가격 급등 패턴 · 지지되지 않음",
  "rapid-price-lift-insufficient-evidence.csv": "가격 급등 패턴 · 증거 부족",
  "concentrated-buy-dialect-a.csv": "집중 매수 · 방언 A 정규화",
  "concentrated-buy-dialect-b.jsonl": "집중 매수 · 방언 B 정규화",
  "published-daily-quotes.csv": "공개 일별 시세 · 정규화",
  "real/fsc-kospi-index-family-20260903/source.jsonl":
    "FSC · 코스피 지수군 · 정규화",
  "real/fsc-kospi-200-baseline-20260701-20260903/source.jsonl":
    "FSC · 코스피 200 기준선 · 정규화",
  "real/fsc-kospi-200-futures-20260903/source.jsonl":
    "FSC · 코스피 200 선물 · 정규화",
  "real/fsc-weekly-options-20260903/source.jsonl": "FSC · 위클리 옵션 · 정규화",
};

export function ExpectationsContent({
  scenarios,
}: {
  scenarios: readonly Scenario[];
}) {
  const korean = useLanguage().language === "ko";
  const t = korean ? ko : null;
  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">
          {t?.eyebrow ?? "Committed verification oracle"}
        </span>
        <h1>{t?.heading ?? "Expected scenario results"}</h1>
        <p>
          {t?.intro ??
            "Use these engine-derived values to check a baseline run in Case Replay. They describe one fixed source, approved mapping, approved case where present, and the versioned rule. They do not establish the truth of the source or a legal, causal, or investment conclusion."}
        </p>
      </div>
      <section className="panel expectations-guide">
        <h2>{t?.guide ?? "Reproduce a baseline from a clean session"}</h2>
        <ol>
          {korean ? (
            <>
              <li>
                기본 fixture provider로{" "}
                <Link href="/replay?mode=working">사례 리플레이 워킹 모드</Link>
                를 새 브라우저 세션에서 열고, 고급 변형은{" "}
                <strong>기준값</strong>으로 둡니다.
              </li>
              <li>아래 레코드에 적힌 커밋된 소스 아티팩트를 고릅니다.</li>
              <li>
                매핑 필드가 <code>REVIEW_REQUIRED</code>이면 표시된 해석을
                받아들이는 사유를 적고 <strong>실행된 매핑 승인</strong>을
                누릅니다.
              </li>
              <li>
                사례 manifest가 보이면 범위와 임계값을 검토하고{" "}
                <strong>사례 manifest 승인</strong>을 누릅니다.
              </li>
              <li>
                mapping 1.4 소스는 <strong>결정론적 리플레이 실행</strong>을,
                mapping 1.5와 1.6 일별 시세 소스는 <strong>소스 정규화</strong>
                를 누릅니다. 아래의 워크플로 상태, 결과, gate 관측값, 정본 결과
                해시와 비교합니다.
              </li>
            </>
          ) : (
            <>
              <li>
                With the default fixture provider, open{" "}
                <Link href="/replay?mode=working">
                  Case Replay working mode
                </Link>{" "}
                in a fresh browser session and leave the advanced variation on{" "}
                <strong>Baseline</strong>.
              </li>
              <li>Select the committed source artifact named below.</li>
              <li>
                For every mapping field marked <code>REVIEW_REQUIRED</code>,
                enter a nonblank reason, then select{" "}
                <strong>Approve executed mapping</strong>.
              </li>
              <li>
                If a case manifest is shown, review its scope and thresholds and
                select <strong>Approve case manifest</strong>.
              </li>
              <li>
                Run mapping 1.4 sources deterministically, including Dialect A
                and Dialect B, or normalize mapping 1.5 and 1.6 daily-quote
                sources. Compare the final workflow state, result, gate
                readings, and canonical result hash below.
              </li>
            </>
          )}
        </ol>
        <p>
          {korean ? (
            <>
              승인 해시는 보안 브라우저 환경의 Web Crypto가 필요합니다. HTTPS와{" "}
              <code>http://localhost</code>에서는 쓸 수 있습니다. 그 밖의
              환경에서는 승인과 리플레이가 막히고 결과도 나오지 않습니다. 반복
              실행은 같은 입력의 반복 가능성만 확인합니다. 해석 범위는{" "}
              <Link href="/methodology">방법론</Link>과{" "}
              <a href="https://github.com/WeaveTrail/WeaveTrail/blob/main/docs/LIMITATIONS.md">
                저장소 한계
              </a>
              를 참고하세요.
            </>
          ) : (
            <>
              Approval hashing requires Web Crypto in a secure browser context.
              HTTPS deployments and <code>http://localhost</code> meet that
              requirement; elsewhere approvals remain unset, replay stays
              blocked, and no result is produced. A repeated baseline checks
              same-input repeatability only. See{" "}
              <Link href="/methodology">Methodology</Link> and the{" "}
              <a href="https://github.com/WeaveTrail/WeaveTrail/blob/main/docs/LIMITATIONS.md">
                repository limitations
              </a>{" "}
              for interpretation boundaries.
            </>
          )}
        </p>
        {!korean && (
          <p>
            This publication was captured at Git revision{" "}
            <code>2a438d04b3f5f04ad847d3207b72a70eb0a76b39</code> with Node{" "}
            <code>22.18.0</code>, pnpm <code>10.33.2</code>, Vitest{" "}
            <code>4.1.11</code>, and Linux WSL2 x86_64.
          </p>
        )}
      </section>
      <section
        className="expectations-list"
        aria-label={t?.output ?? "Expected outputs"}
      >
        {scenarios.map((s) => (
          <article className="panel expectation-card" key={s.scenario}>
            <span className="panel-label">
              {korean ? (koreanScenarioLabels[s.scenario] ?? s.label) : s.label}
            </span>
            <h2>
              <code>{s.scenario}</code>
            </h2>
            <dl className="expectation-facts">
              <div>
                <dt>{t?.final ?? "Final workflow state"}</dt>
                <dd>
                  <code>{s.workflowState}</code>
                </dd>
              </div>
              <div>
                <dt>{t?.result ?? "Pattern result"}</dt>
                <dd>
                  {s.result === null ? (
                    korean ? (
                      "평가하지 않음"
                    ) : (
                      "Not evaluated"
                    )
                  ) : (
                    <strong data-result={s.result}>{s.result}</strong>
                  )}
                </dd>
              </div>
            </dl>
            {s.result === null && (
              <p>
                {t?.noManifest ??
                  "This source has no committed case manifest. The workflow ends after approved mapping and deterministic normalization, before any pattern gate or verdict is evaluated."}
              </p>
            )}
            {s.hypothesis && (
              <section className="expectation-hypothesis">
                <h3>{t?.hypothesis ?? "Versioned hypothesis"}</h3>
                <p>
                  <code>{s.hypothesis.pattern}</code>{" "}
                  {korean ? "— 적용 규칙: " : "evaluated by "}
                  {s.hypothesis.rules.map((r, i) => (
                    <React.Fragment key={r.ruleId}>
                      {i ? ", " : ""}
                      <code>
                        {r.ruleId}@{r.ruleVersion}
                      </code>
                    </React.Fragment>
                  ))}
                </p>
                <dl className="expectation-facts">
                  <div>
                    <dt>{t?.manifest ?? "Manifest version"}</dt>
                    <dd>
                      <code>{s.hypothesis.manifestVersion}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{t?.instrument ?? "Instrument"}</dt>
                    <dd>{s.hypothesis.instrumentIds.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>{t?.actors ?? "Approved actor group"}</dt>
                    <dd>{s.hypothesis.actorIds.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>{t?.window ?? "Window"}</dt>
                    <dd>
                      <code>{s.hypothesis.startTime}</code> —{" "}
                      <code>{s.hypothesis.endTime}</code>
                    </dd>
                  </div>
                </dl>
              </section>
            )}
            <Hash
              label={t?.dataset ?? "Canonical dataset hash"}
              value={s.canonicalDatasetHash}
            />
            <Hash
              label={t?.hash ?? "Canonical result hash"}
              value={s.canonicalResultHash}
            />
            {s.gates.length ? (
              <div
                className="gate-list"
                aria-label={t?.gates ?? "Expected gate readings"}
              >
                <h3>{t?.gates ?? "Gate readings"}</h3>
                {s.gates.map((g) => (
                  <div className="gate-row" key={g.gate}>
                    <strong>{g.gate}</strong>
                    <span>
                      {t?.observed ?? "Observed"}{" "}
                      <code>
                        {g.observedValue ??
                          (korean ? "생성되지 않음" : "not produced")}
                      </code>{" "}
                      · {t?.threshold ?? "threshold"} <code>{g.threshold}</code>
                    </span>
                    <b data-passed={g.passed ?? undefined}>
                      {g.passed === null
                        ? korean
                          ? "평가하지 않음"
                          : "NOT EVALUATED"
                        : g.passed
                          ? korean
                            ? "통과"
                            : "PASS"
                          : korean
                            ? "실패"
                            : "FAIL"}
                    </b>
                  </div>
                ))}
              </div>
            ) : (
              <p>
                {t?.noGates ??
                  "No rule gates or thresholds are declared for this source."}
              </p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
