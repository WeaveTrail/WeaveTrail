# ADR 0078: Lead with the reviewer's gain and keep two explanation pages

- Status: Accepted
- Date: 2026-10-11
- Supersedes: the first-screen example screen and control line of
  [ADR 0077](0077-lead-with-the-walkthrough-and-its-example-screen.md), the
  explanation-page set of
  [ADR 0076](0076-organize-the-web-app-by-page-with-typed-bilingual-copy.md),
  the guided step rail of
  [ADR 0026](0026-open-guided-steps-with-intent-and-read-ahead.md),
  [ADR 0033](0033-lead-each-guided-step-with-its-action.md) and
  [ADR 0070](0070-group-guided-steps-under-the-control-line-stages.md), and the
  four stage names fixed for the guided walkthrough.

## Context

The site described its own internals rather than what a visitor gains. The
home page opened on "AI reads the data. Code decides the result.", followed by
the stages "AI proposes · A person approves · Code verifies · Evidence traces
back", an example result table a first-time visitor had no way to read yet, and
a "What is built" board. The Korean surface carried the same structure as
literal English: stage names such as `AI가 제안` and `코드가 검증`, and headings
that read as translation rather than Korean writing. "How it works" held five
pages (`/why`, `/architecture`, `/methodology`, `/expectations`,
`/data-handling`) that overlapped and were written for a reviewer of the
repository rather than a user of the service. `/evals` opened on a table of
"not eligible" rows before saying why models are compared at all. The guided
walkthrough (`사례 따라가기`, a literal "walkthrough") ran eight steps beside a
step rail; its case column showed the machine values each step touched, so a
visitor knew which button to press next but not what they were looking at or
why.

## Decision

- **Home.** The first screen states the gain ("Review an unfamiliar trading
  file right away" · "처음 보는 거래 자료도 바로 검토할 수 있습니다"), backs it
  with two sentences on what the reviewer gets, and offers the walkthrough as
  the only action, with
  the four stages beside it. Below it: what changes for the reviewer, and that
  the column-matching AI is chosen by a test set in advance, with links to the
  comparison and the failure log. The example screen and the build board are
  removed.
- **Stage names** on the home page describe what the visitor does:
  `Match the columns`, `Approve the scope`, `Get the result`, `Check the evidence`
  (`항목 맞추기`, `조사 범위 승인하기`, `결과 받기`, `근거 확인하기`). Internal
  words (`fixture`, `커밋된`, `아티팩트`) leave the screen.
- **The guided walkthrough is rebuilt** as `Try it` (`체험하기`), with the modes
  `Step by step` (`단계별 체험`) and `Hands-on` (`직접 조작`). It follows the
  worked case in five scenes — the data as received and what is checked; the
  AI's column matches with a sample value each; the scope in one sentence and
  its five criteria; the result with each criterion against the data and an
  optional second run; the source rows each criterion used. Each scene says
  what and why before it asks for one action, the action does the work (an
  approval moves on once it is recorded), and machine values stay out of the
  scene. One client surface owns the replay state for both modes, so the
  walkthrough makes the same approvals and the same replay request, and the
  hand-off to working mode keeps the approved case and its result as
  [ADR 0019](0019-share-guided-and-working-case-replay-state.md) requires;
  re-entering the walkthrough restores the worked case unapproved. The step rail, the step
  narration and the separate review-example step are removed; the H0STCNT0
  review stop stays reachable in working mode.
- **Two explanation pages**, in the order a reader asks: `/why` says what a
  reviewer gains, opening from two cited published facts; `/architecture`
  ("How it runs") says who does what, the three results, what happens when the
  AI is wrong, why a rerun repeats and how data is handled, and links the
  repository documents for the rest. `/methodology`, `/expectations` and
  `/data-handling` are removed and permanently redirect to `/architecture`.
  The committed scenario expectations and the documents they summarized stay.
- **`/evals`** opens on why models are compared and what the latest test means
  for the service ("no model has cleared the bar yet, so live AI suggestions
  stay off"); the measured summary and the table follow.
- **Korean is written, not translated.** A multi-sentence lede is set one
  sentence per line, and a heading marks the phrases it may break between, so
  at desktop width no line ends inside a sentence or a heading phrase. A
  browser test checks this on `/`, `/why`, `/architecture` and `/evals` in
  both languages at 1280×720.

## Consequences

- Contract identifiers (`SUPPORTED`, `REVIEW_REQUIRED`, …), approvals, the
  replay request and hashes are unchanged. Percentages on screen move the
  decimal point of the returned basis-point strings and are truncated to two
  places; no floating-point arithmetic touches them.
- At 390 px a sentence longer than the screen still wraps; headings wrap only
  between their marked phrases.
- The footer says the site runs on synthetic demo data instead of naming
  fixture mode.
