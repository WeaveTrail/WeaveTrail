# ADR 0026: Open guided steps with intent and allow read-ahead

## Status

Accepted

## Context

The guided Case Replay walkthrough in [ADR 0019](0019-share-guided-and-working-case-replay-state.md)
presents each step's artifacts without first stating what the step demonstrates
or what the visitor must do to advance it, and it names no authority for the
work shown. Its progress list is inert, so a visitor cannot read a later step
without performing the earlier ones, and the condition blocking advancement is
visible only beside the disabled control at the end of the step. The guide is
reachable only from the overview, so a visitor who opens Case Replay from the
navigation never meets it.

## Decision

Every guided step declares a purpose, the action the visitor must take to
advance it, and the authority that acted in it. The authority vocabulary is
closed: `Committed input`, `A model proposed it`, `A person approved it`, and
`Versioned code decided it`. That declaration renders above the step's content,
with the step controls repeated above and below it.

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

The navigation gains a `Guided case` entry to `/replay?mode=guided`, and working
mode offers the guided case above its working controls. This adds an entry
point; it does not reorder or regroup the navigation.

## Consequences

A visitor can read the whole journey before performing it and can still see what
they have actually done. Step copy is data rather than positional prose, so a
step's purpose, action and authority stay together. Guide progress remains
presentation state: it grants no approval, and the server continues to revalidate
every approval on each request. Marked completion depends on live state, so an
input change that invalidates an approval also visibly withdraws that step's
completion.
