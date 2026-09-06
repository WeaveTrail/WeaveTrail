# ADR 0026: Open guided steps with intent and allow read-ahead

## Status

Accepted

## Context

The guided Case Replay walkthrough in [ADR 0019](0019-share-guided-and-working-case-replay-state.md)
presents each step's artifacts without first stating what the step demonstrates
or what the visitor must do to advance it, and it names no authority for the
work shown. Its progress list is inert, so a visitor cannot read a later step
without performing the earlier ones, and the condition blocking advancement is
visible only beside the disabled control at the end of the step. Its steps
stack above the case they drive, so reading one means scrolling past the
artifacts of the last. The guide is reachable only from the overview, so a
visitor who opens Case Replay from the navigation never meets it, and listing
the guide and the surface as two navigation entries would state no difference
between them.

## Decision

Every guided step declares a purpose, the action the visitor must take to
advance it, and the authority that acted in it. The authority vocabulary is
closed: `Committed input`, `A model proposed it`, `A person approved it`, and
`Versioned code decided it`.

Guided mode is a two-column surface: a step rail beside the case content, in
place of steps stacked above it. The rail holds the step list, the current
step's declaration and its controls; it sticks below the header, scrolls on its
own when a step says a lot, and keeps the unmet condition and the controls
pinned at its bottom edge, so advancing never depends on either scroll. The end
of the step content repeats the controls. Below the rail breakpoint the two
columns stack and nothing sticks.

The progress list is navigable. Selecting a step opens it for reading without
performing it. A step counts as completed only when the visitor advanced past
it themselves and its condition still holds, so a revoked approval withdraws the
completion it granted. Read-ahead never marks completion and never approves.

The unmet condition of the current step is displayed whenever it is unsatisfied,
before any attempt, and read-ahead additionally names the earliest step the
visitor has not completed. The mapping review example remains a refusal on the
path and states the reviewer reason that clears it. The single control that
advances the current step is marked, distinguishing it from the surrounding
controls.

Case Replay keeps one navigation entry. The two ways to use it are named and
chosen inside the surface, above it, as `Guided walkthrough` and `Working mode`,
each stating what it does and marking which one is running. `/replay` opens the
guided walkthrough, `mode=working` selects working mode, and `mode=guided`
remains explicit. The query stays the only presentation-mode source of truth,
and the guide's completion hands off to `mode=working` rather than restarting
itself.

## Consequences

A visitor can read the whole journey before performing it and can still see what
they have actually done. Step copy is data rather than positional prose, so a
step's purpose, action and authority stay together. Guide progress remains
presentation state: it grants no approval, and the server continues to revalidate
every approval on each request. Marked completion depends on live state, so an
input change that invalidates an approval also visibly withdraws that step's
completion. One entry means the navigation no longer distinguishes the two
modes; the surface does, and a visitor who wants the plain controls reaches
them in one click from the same page.
