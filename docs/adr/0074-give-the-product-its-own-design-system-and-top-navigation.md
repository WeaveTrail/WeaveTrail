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
- The site follows one path for a first-time visitor: what this is, then try
  it, then which AI and why, then how it works.
  - **Home** opens with what the site is in one heading and one line, and
    offers `Walk through a case` as its first action, with its length.
    Beside it, a card asks which AI model proposes the column mappings and
    answers in one sentence with the control line. The four stages run in one
    row below, so all three sit in the first 1280x720 screen.
  - **The walkthrough** heading is one line: what the case is and how long it
    takes, with the two modes as a segmented control. The step rail shows the
    step, its one instruction, its control and who acted; why the step exists
    and the full step list each wait in one disclosure. A proposed field reads
    as one line on a wide screen. The result leads with the verdict and how
    many checks pass; each check says how many canonical events it counted,
    and its evidence disclosure lists them with their source rows. The engine
    version, canonical order and result hash sit in one disclosure below the
    checks. The last step links to the model comparison.
  - Each block on an entry screen is a title and at most one short line, and
    every detail is one link or disclosure away.
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
cover the menu by keyboard at 390x844, the menu closing when the width crosses
the tablet breakpoint, the header within 320px and 375px screens in tab order,
the `How it works` menu at 1280x720, the step-1 table in the first viewport,
the home heading and its walkthrough action in the first viewport, the result's
check tally with its technical details closed, and every closed disclosure
opening for print. The fixed mobile action bar, the sticky
step rail and the evidence-badge rules carry over unchanged in behaviour.
