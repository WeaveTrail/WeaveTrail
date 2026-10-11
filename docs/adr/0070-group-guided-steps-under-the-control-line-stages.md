# ADR 0070: Group guided steps under the control-line stages

- Status: Accepted
- Date: 2026-10-09

## Context

Guided Case Replay labelled each of its seven steps with the authority that
acted in it ([ADR 0026](0026-open-guided-steps-with-intent-and-read-ahead.md),
[ADR 0033](0033-lead-each-guided-step-with-its-action.md)), but the steps formed
one flat list. A first-time visitor could not see the shape the control line
gives the walkthrough: AI proposes, a person approves, code verifies, evidence
traces back. Two things blurred it further.

The mapping step asked for two approvals. The visitor had to give the separate
H0STCNT0 review example a reviewer reason and approve it before the worked
case's own mapping step could be completed. The example has no rule manifest,
and its approval never reaches the case request
([ADR 0019](0019-share-guided-and-working-case-replay-state.md)), yet the guide
made it a condition of the worked case's progress. A visitor reasonably read it
as part of the case they were approving.

The step order also crossed the stages: the finding was inspected before the
same-input repeat, so the walkthrough went from code verifying to evidence and
back to code verifying.

## Decision

The walkthrough has four top-level stages with fixed names in both languages:

| Stage | English              | Korean               |
| ----- | -------------------- | -------------------- |
| 1     | AI proposes          | AI가 제안            |
| 2     | A person approves    | 사람이 승인          |
| 3     | Code verifies        | 코드가 검증          |
| 4     | Evidence traces back | 근거를 원본까지 추적 |

Each step declares its stage. The worked case reads the source and reviews the
mapping (AI proposes), approves the case (a person approves), runs and repeats
(code verifies), then inspects the finding (evidence traces back). The repeat
moves ahead of the inspection so the stages never revisit an earlier one. Each
step keeps its title and actor label.

The mapping step requires only the worked case's own mapping approval. The
separate review example becomes its own step after the main flow, followed by
the hand-off to working mode; the two form an "after the worked case" group.
The example step opens by saying its approval does not authorize the worked
case, still holds at `REVIEW_REQUIRED` until each flagged field has a nonblank
reviewer reason, and blocks its own `Continue` until the example is approved.
The hand-off requires every step to be satisfied, the example included.

The rail names the current step's stage inside its action block, which is what
stays on screen: at the top of the sticky rail on a wide screen, and in the bar
fixed to the bottom of a narrow one. The step list is grouped under the four
stage headings and the closing group.

## Consequences

A visitor reaches the run with the worked case's two approvals alone, and the
example's refusal is still on the guided path rather than skippable. No step
starts approved and no control approves on the visitor's behalf; the rail's
example control still only moves focus to the field waiting for a reason.

The walkthrough has eight steps instead of seven. A future step belongs to one
stage; a step that does not drive the worked case belongs in the closing group.
Renaming a stage is a change to both languages, to the rail and to every page
that quotes it.

Playwright tests at 1280×720 and 390×844 in both languages assert that the
current step's stage is in the viewport at every step, that the worked case
runs without the example's approval, that the example blocks until every reason
is given, and that the guide completes by keyboard alone.
