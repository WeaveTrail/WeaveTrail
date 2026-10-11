# ADR 0073: Lead the home page with the control line and build status

- Status: Accepted
- Date: 2026-10-09

## Context

The home page answered the model-selection question in its first screen
([ADR 0068](0068-show-the-model-comparison-only-from-the-committed-decision.md)),
but everything below that answer still described an earlier framing: a
surveillance-alert position chain, an `Interpret / Approve / Replay / Trace`
role grid whose Korean copy used `리플레이`, and a price-lift question with the
result vocabulary. None of it named the stages that Guided Case Replay now uses
([ADR 0070](0070-group-guided-steps-under-the-control-line-stages.md)), and
none of it showed which capabilities exist and which are planned. A first-time
visitor had to open the evaluation page, the failure log and the walkthrough to
assemble that picture.

The navigation listed the evaluation page last, under `About this project`, as
`Evals`, although it holds the comparison the home page's primary action opens.
On a narrow screen the navigation's group names were cut off at the edge, and
the header wrapped onto two rows.

## Decision

- Below the answer block, which is unchanged, the home page shows three parts:
  the four control-line stages, a short statement of why the mapping task needs
  this control, and a board that separates `Runs today` from `Planned`. On a
  wide screen the stages sit beside the answer in the first viewport.
- The stage names come from one module shared with Guided Case Replay, so the
  two surfaces cannot name a stage differently. Each stage writes out who acts
  in it (model, person, versioned code, source rows); the colour follows the
  design reference's authorship tokens and is never the only signal.
- `REVIEW_REQUIRED · pre-replay` appears as a stop before anything runs, stated
  as a review need and never as a result.
- The board's counts are read from committed data: the declared candidate
  models, the held-out run date and the failure-log entries. It shows no
  accuracy figures. Planned items are written as planned.
- The evaluation page is listed second under `Start here`, as
  `Model comparison` / `모델 비교`, the term the vocabulary fixes. The group
  names from [ADR 0026](0026-open-guided-steps-with-intent-and-read-ahead.md)
  stay.
- On `/evals` the engine-check ledger folds under one summary line with its
  implemented and planned counts, so the comparison stays the page's answer.
- On a narrow screen the header keeps one row, and the navigation becomes one
  scrollable row of links without group names.

## Consequences

A visitor sees the question, the answer, the control line and the build state
without leaving the home page, and every term on that page matches the
walkthrough. The surveillance-position argument stays on `Where it fits`, which
the home page links to from its boundary note. When a planned capability ships,
its board item moves to `Runs today` in both languages in the same change.
