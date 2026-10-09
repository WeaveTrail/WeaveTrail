# ADR 0074: Give the product its own design system and top navigation

- Status: Accepted
- Date: 2026-10-09

## Context

[ADR 0015](0015-apply-the-canonical-design-reference.md) applied the vendored
`design-reference` tokens to every page. That system was drawn for a dense
evidence ledger: 14px body text, radii of at most 4px, no elevation, and a
240px side rail on every route. The product's reader has since changed. The
home page answers a question for a first-time visitor
([ADR 0073](0073-lead-the-home-page-with-the-control-line-and-build-status.md)),
and the guided walkthrough asks that visitor to read a source table and act on
it. On those screens the side rail took width from the answer, the narrow
layout cut its group names off at the edge, and the first walkthrough step
listed each source row as a separate disclosure, so the rows could not be read
together.

The navigation groups from
[ADR 0026](0026-open-guided-steps-with-intent-and-read-ahead.md) (`Start here`,
`About this project`) named the rail's sections. They did not separate what a
visitor comes to do from how the system works.

## Decision

- The product carries its own design tokens in `apps/web/src/app/design/`:
  palette, type scale, spacing, radii, elevation, motion and layout. The site
  no longer imports the vendored token files.
- The brand mark stays as the pinned design reference delivers it, byte for
  byte, and its teal anchors the new palette. The vendored snapshot, its pin and
  the figures' token mapping
  ([ADR 0071](0071-keep-one-design-reference-pin.md)) are unchanged, so the
  existing figures keep their verified colours.
- Semantic names that carry product meaning keep their meaning: the three
  results, review and refusal states, planned capability, and authorship (the
  AI's proposal dashed slate, a person's approval teal, versioned code ink). A
  role is never shown by colour alone.
- Body text is 16px. Controls are at least 40px high. Cards have 12px radii
  and a quiet shadow, and overlays lift further off the page.
- One bar across the top replaces the side rail. It holds the mark, the
  `Explore` group (`Home`, `Model comparison`, `Walk through a case`), one
  `How it works` menu (`Where it fits`, `Architecture`, `Methodology`,
  `Expected results`, `Data handling`, each with a one-line description) and the
  language switch. Below the tablet width, one `Menu` button opens every
  destination. Escape closes the menu and returns focus to the button.
- Each block on an entry screen is a title and at most one short line, and
  every detail is one link or disclosure away. On the home page the four stages
  carry one line each, the reasons one sentence each, and the build board one
  linked row per capability with its single fact (count, date or duration).
  Planned capabilities are titles only. The walkthrough heading is one sentence
  with two facts, and the mode switch gives each mode one line.
- The first walkthrough step shows the committed source as one table: a summary
  line (artifact, rows, columns, kind), then every row with its original
  strings. Provenance and the artifact hash sit in one disclosure below the
  table.

This supersedes ADR 0015's application of the vendored tokens to product
presentation, and ADR 0026's navigation group names. ADR 0026's single
`Walk through a case` entry, with modes chosen inside the surface, stays.

## Consequences

The design reference remains the source of the mark and of the figures'
colours. A change to the interface's look no longer needs a re-pin, and a
re-pin no longer changes the interface. The figures and the interface can now
drift apart in neutral tones; the brand teal is shared.

Tests that held the old navigation names now hold the new ones. Browser tests
cover the menu by keyboard at 390x844, the `How it works` menu at 1280x720, and
the step-1 table in the first viewport. The fixed mobile action bar, the sticky
step rail and the evidence-badge rules carry over unchanged in behaviour.
