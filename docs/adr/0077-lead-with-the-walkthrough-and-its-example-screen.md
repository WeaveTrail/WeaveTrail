# ADR 0077: Lead with the walkthrough and its example screen

- Status: Accepted
- Date: 2026-10-11
- Supersedes: the first-screen answer card of
  [ADR 0073](0073-lead-the-home-page-with-the-control-line-and-build-status.md)
  and, for a committed run without a selection, the one-sentence answer and
  role rows of
  [ADR 0068](0068-show-the-model-comparison-only-from-the-committed-decision.md).

## Context

The home page's first screen answered "which AI model proposes the column
mappings here, and why that one?" from the committed selection record. Both
committed held-out sessions ended with `NO_MODEL`, and
[ADR 0075](0075-retry-mapping-selection-with-column-ids-and-a-fresh-corpus.md)
was withdrawn before a third run. The first thing a visitor read was therefore
that no model is chosen, and the evaluation page opened on the same sentence
with "No model selected" in both role rows. Neither told the visitor what the
site does; the walkthrough that shows it sat beside or below that answer, and
the navigation listed it last.

## Decision

- The home page's first screen shows an **example screen**: the end of the
  guided walkthrough's worked case, `published-execution-fix44.csv`. It shows
  four columns of the case's prepared mapping proposal, the result, the rule
  and version, every threshold beside its observed value, and the start of the
  canonical result hash. The page reads these on the server from committed data
  only: the scenario's mapping proposal and the captured
  `scenario-expectations.json`. It labels the screen as an example on synthetic
  data, and a test pins every shown value to those committed sources.
- The walkthrough is the first action, beside a link to every case's expected
  results. The control line moves under the introduction. The four stages stay
  below, inside the first viewport at 1280×720.
- The first navigation group reads `Walk through a case`, `Home`,
  `Model comparison`.
- The home page makes no model-selection claim.
- When the committed decision selects no model, `/evals` opens on what was
  measured: how many candidates ran on the sealed synthetic held-out set,
  beside the non-model baseline, under the rule declared before the run. It
  shows no role rows. A pending run and a selected model are shown as before.
  The eligibility table, failures, rule and limits are unchanged, so each
  candidate's ineligibility is still visible.

## Consequences

- The committed sessions, comparisons and `NO_MODEL` decisions stay committed,
  reproducible offline and documented in the
  [evaluation protocol](../EVALUATION.md). Only their headline on the site
  changes.
- The example screen changes only when the worked case's committed
  expectations or mapping proposal change, and the home test fails if they
  diverge from what it shows.
- A selected model, if a later decision records one, appears on `/evals` with
  its roles. A new decision is needed before the home page names a model again.
