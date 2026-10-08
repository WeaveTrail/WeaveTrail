# ADR 0068: Show the model comparison only from the committed decision

- Status: Accepted
- Date: 2026-10-08

## Context

The evaluation page must answer which mapping models were compared and chosen,
what the choice costs and how each one fails, before a reader opens the method.
At acceptance, ADR 0067 fixed the selection rule and its offline outputs, but
no HELD_OUT model run was committed. The first session is now committed with
a `NO_MODEL` decision: all 180 requests failed with `HTTP_ERROR`. The page
reports that decision and its captured observations. A page that computed its
own ranking, fetched live results or filled the gap with fixture numbers would
present something the rule never produced.

## Decision

`/evals` renders the comparison from one committed binding,
`apps/web/src/app/evals/held-out-result.ts`. It holds the
`eval:mappings:select` comparison and `mapping-selection-decision/1` record of
the single counted session, its run date and links to the committed run records
and session receipt, or `null` while no session is committed. The page never
re-ranks candidates or applies thresholds: eligibility, primary and escalation
come from the decision record. It only formats integer counts and places chart
marks with BigInt arithmetic. It makes no network request.

With `null`, the page says that no model is selected because the declared
candidates have not run, lists them beside the non-model baseline and shows no
measured value. "No eligible model" is reserved for a committed `NO_MODEL`
decision, so an absent run is never reported as a result.

The answer, both roles and the eligibility table sit in the first viewport at
1280×720 and 390×844 in both languages. Cost and accuracy, per-tag accuracy,
failures, the rule, prompt versions, terms and limits are tabs whose state
lives in `?view=` and changes through the History API, never a reload. Playwright
browser tests against the production build assert these properties; they are the
repository's first browser suite and run in CI after the build.

## Consequences

Publishing the held-out result is a data change to one file plus the committed
outputs it imports; the page needs no code change for `SELECTED` or `NO_MODEL`.
Unit tests render both outcomes from authored gold records through the real
selection code. The page cannot display a session that is not committed, and it
reports the reference row and costs with the scorer's coverage rules unchanged.

The binding now imports the first committed comparison and decision, takes its
run date from the session receipt and links to the immutable capture commit.
Browser tests assert the actual `NO_MODEL` answer, both empty roles, five
ineligible model rows and the receipt's run date. The absent-session rendering
remains covered separately by unit tests. See the
[ADR 0067 result amendment](0067-separate-mapping-validity-from-approval-before-selection.md#result-amendment-2026-10-08).

The production-import boundary permits only the three published JSON artifacts
through this binding, with their exact byte hashes checked. Corpus inputs,
gold, vocabulary, attempt records and evaluation implementation imports remain
offline; negative regressions reject these imports and publication imports from
any other production file.

The first filled-state browser run exposed horizontal page overflow at 390px
in English: the cost-accuracy panel's equivalent table had no scroll container.
It now uses the same labeled, keyboard-focusable scroll region as the
eligibility table. Selection and rendering logic are unchanged.
