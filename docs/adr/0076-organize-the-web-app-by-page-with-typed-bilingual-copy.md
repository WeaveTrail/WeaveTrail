# ADR 0076: Organize the web app by page with typed bilingual copy

- Status: Accepted
- Date: 2026-10-10

## Context

[ADR 0074](0074-give-the-product-its-own-design-system-and-top-navigation.md)
gave the site its own design system, top navigation and first-visit path. The
code underneath still carried the surfaces it grew through:

- an evidence-grade module for pasted text and daily-quote panels that no
  route reached;
- an empty check-route directory and guards for withdrawn pages;
- one 2,900-line walkthrough component that held every step's state, markup
  and much of its copy inline as English–Korean pairs;
- one 2,600-line stylesheet for every page.

The explanatory pages (`Where it fits`, `Architecture`, `Methodology`,
`Expected results`, `Data handling`) were written for an earlier reader and
framing. Some sentences described the mapping provider as it stood before the
configurable adapter, and some Korean copy used `리플레이`, which the product
vocabulary replaces with `분석 실행`.

A contributor could not find a page's copy, behaviour or style in one place,
and a string written inline in one language could not be checked against the
other.

## Decision

- **Copy.** Each page's copy lives in its own `copy.ts` as a typed
  `Bilingual<T>` table (`Record<"en" | "ko", T>`). Components only read it.
  The site shell (skip link, navigation, language switch, footer) has
  `shell/copy.ts`, and each guided step carries its own narration and panel
  copy.
  - Contract identifiers, field names and the contents of `<code>` keep one
    spelling and may sit in markup.
  - `copy-placement.test.ts` parses every component and refuses visible text,
    visible attributes or a bilingual table written outside a copy module.
  - `bilingual-parity.test.ts` finds every exported bilingual table on its own
    and checks equal shape, matching blanks, written-not-copied Korean, one
    spelling for contract vocabulary, and that the retired Korean words
    (`리플레이`, `워킹 모드`) appear nowhere.
- **Structure.** Each route keeps its page, copy, view and stylesheet in its
  own folder; the home page's modules sit in `home/`. Shared layouts have
  folders of their own: `shell/` for the site frame and `explainer/` for the
  explanatory pages.
- **Walkthrough.** Guided Case Replay is split as follows:
  - `use-case-replay.ts` owns all state and handlers.
  - `steps/` holds one definition per step: its stage, actor, narration,
    gate, rail control and panel copy, each beside its panel's render
    function.
  - `guide-rail.tsx` draws the rail; `case-replay.tsx` composes the panels.

  Panels are render functions rather than nested components, so the
  component-state tests still observe one element tree. Class names, element
  order, stages, gating and every test-held guarantee are unchanged. Errors
  are stored as kinds and worded when shown, so a refusal already on screen
  follows a language switch.

- **Styles.** Styles are organized by the design system (`design/tokens.css`,
  `base.css`, `components.css`), the shell (`shell/shell.css`) and each page
  or shared layout, imported by the components they style.
  `styles.test.ts` refuses a rule for a class no component names, and a
  stylesheet nothing imports.
- **Explanatory pages.** Each one opens with one answer, then sections a
  reader can scan. A section is a title and one short line; anything longer
  waits in one disclosure or behind one link to the repository documents.
  Expected results shows one table row per committed case, with each record's
  hashes and gate readings one disclosure away. Its reproduction steps quote
  the walkthrough's own control labels.
- **Removed.** The unreachable surfaces, their styles and the tests pinned to
  them are removed. Each guarantee they held now sits on the current
  structure:
  - `routes.test.ts` holds the exact page and API route inventory, keeps that
    inventory in the navigation, and keeps the offered sources synthetic.
  - `api/reviewer-text-retention.test.ts` covers every API route, either with
    canary requests or as taking no typed text.
  - The pins on captures with withdrawn sources move to
    `packages/evals/src/withdrawn-captures.test.ts`.

This refines ADR 0074's presentation decisions. It changes no contract,
engine, evaluation output, model selection, brand mark, design-reference pin
or figure.

## Consequences

Renaming a control means editing its step's copy, and every page that quotes
it reads the new label. A new page has a fixed place for its copy, view and
style, and the copy and style tests cover it without being listed.

Browser tests open every route at 1280×720 and 390×844 in both languages and
assert three things: the heading and the block that carries the answer sit in
the first screen, and nothing scrolls sideways. They also reach every route
from the header by keyboard alone, and walk the guided case end to end.
