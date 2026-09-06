# ADR 0033: Lead each guided step with the action, and carry that action in the rail

## Status

Accepted

## Context

[ADR 0026](0026-open-guided-steps-with-intent-and-read-ahead.md) gave guided
Case Replay a step rail beside the case content, declared each step's purpose,
action and authority, and pinned the unmet condition and the step controls at
the rail's bottom edge so advancing would not depend on a scroll. Two things it
decided do not hold in use.

The rail states the action but does not carry it. The control that advances a
step lives in the case column — approve the mapping, approve the case manifest,
run the replay, open a finding's source evidence, repeat the case, take the
controls — and the only thread between the sentence and the control is a
hairline outline on a control the visitor has to scroll to find. The rail can
say "approve this exact case manifest" while the button that does it is a
screen away.

Pinning to the rail's bottom edge only helps a visitor who has already
scrolled. The rail is sticky under the app bar and as tall as the viewport
allows, but it begins below the page heading — the h1, the lede and two mode
cards — so on arrival its bottom edge, and therefore the condition and the
controls, sit below the fold. Below the rail breakpoint nothing sticks at all:
seven step buttons, three blocks of narration, the refusal note, the condition
and the controls all stack above the case content, so a visitor on a phone
scrolls the whole narration to reach the artifacts and scrolls back up to
advance.

The narration itself is ordered against the visitor. The step opens with its
purpose, and the one sentence the visitor acts on is the second entry in a
three-entry list, under a heading that competes with two paragraphs of
exposition.

## Decision

Each step leads with what to do. The rail's first screenful is the step
position, the step title, the imperative instruction, the condition, and the
control that advances the step. Everything that supports the step — why it
exists, which authority acted, the refusal note, and the whole step list —
follows in a region that scrolls on its own below that block. This replaces
ADR 0026's decision to pin the condition and the controls to the rail's bottom
edge: they are pinned to its top instead, because the top is what is on screen
when the rail is.

Every step carries exactly one control that advances it. Where the step commits
something the rail renders that control itself, sharing one handler and one
disabled state with the control in the case column, and both are marked. Where
the step's work happens inside the case content — writing a reviewer reason on
the review example, opening a finding's source evidence — the rail renders a
control that scrolls to the target and moves focus to it, and never performs
the work on the visitor's behalf. A step that only has to be read is advanced
by `Continue`, which is already in the rail.

Below the rail breakpoint the rail's action block becomes a bar fixed to the
bottom of the viewport, carrying the condition and the controls, with its space
reserved beneath the surface so it covers nothing. The supporting region is
bounded there rather than pushing the case content down a full screen.

Guided mode states what the walkthrough is before it starts: what the visitor
will have done by the end, roughly how long it takes, that no sign-in is
needed, and that a refresh starts over. Its page heading is compact, because
whatever stands above the rail is what pushes the current step off the screen.

The Korean surface names each thing the way the product's own screens name it —
원본 거래자료, 데이터 항목 연결, 조사 범위, 분석 실행, 판단 항목, 판단 근거,
직접 조작 — and that vocabulary is the same in the step, in the control that
performs it, and on the pages that tell a reader to go there. The machine
readings that say what a displayed value means — each hash's scope, what each
of the five checks measures, what each canonical event field is — carry the
same statements in both languages, with the same scope and the same hedging.
Text that belongs to a committed artifact is not translated: a proposal's own
evidence sentence and a source's attribution are shown verbatim and labelled as
the artifact's own words.

## Consequences

Reading a step and acting on it happen in the same place, so the walkthrough no
longer asks a visitor to hold an instruction in mind while hunting for its
control. Marking the same logical action in two places means the marked-control
count per step is two, not one; the labels are identical, and either control
performs the same thing.

A rail control that commits something makes it possible to approve without
scrolling the panel it belongs to. Guided mode shows only the current step's
panel, so nothing the visitor could not already see is skipped, but the case
column remains where the artifact is read.

ADR 0026's read-ahead stands. Selecting a step still opens it for reading
without performing it, completion still depends on live state, and the guide
still grants no approval. This is a deliberate departure from the sequential
order usually recommended for wizards: a visitor may read the whole journey
before performing it, and the rail names the earliest step they have not
completed.

The published surface now carries one vocabulary per language. A future change
to a step's name is a change to the control that performs it and to the pages
that reference it, in both languages, or the surfaces stop lining up.
