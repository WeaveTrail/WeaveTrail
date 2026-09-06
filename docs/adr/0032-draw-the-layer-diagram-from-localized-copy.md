# ADR 0032: Draw the layer diagram from localized copy

- Status: Accepted
- Date: 2026-09-07

## Context

The layer-separation diagram was a committed SVG with forty-two hand-positioned
`<text>` elements, served to the architecture page as an image and embedded in
the readme. Its words were English, and the language mechanism in
[ADR 0030](0030-hold-language-selection-outside-react.md) does not reach text
baked into a committed asset.

Localizing it as a second committed file would mean hand-positioning a second
set of forty-two elements, and Korean does not wrap where English wraps, so the
line breaks could not be copied across. Worse, every later copy change would
have to be made twice, by hand, in two binaries-in-name-only, with nothing to
catch a change applied to one and not the other.

## Decision

Write the geometry once, in code, and take the words from a copy table of the
kind the pages already use.

- `apps/web/src/app/architecture/how-it-works-diagram.ts` holds the box
  positions, the palette and one copy entry per language. Each language brings
  its own body lines — its own wrapping — and its own chip widths, because a
  Korean label does not measure like an English one.
- The architecture page renders that module inline, in the reader's language,
  so the figure is set in the committed faces and reads in the language the
  rest of the page reads in.
- `pnpm diagram:build` writes the module's English output to
  `docs/assets/how-it-works.svg` and `apps/web/public/diagrams/how-it-works.svg`.
  The documentation has one language and still needs a self-contained figure.
- A test fails when either committed file stops matching what the module
  renders, so the figure and the page cannot drift apart.

## Consequences

- A copy change is one edit in one table, and the check that used to be a human
  reading two SVGs is now a test.
- The page no longer requests `/diagrams/how-it-works.svg`. That file remains
  committed for the readme and for anyone linking the figure directly.
- The inline markup is written by this module from committed literals, with no
  request or reader input in it, which is what makes setting it as HTML safe.
- Standalone files name font families literally, because a committed SVG cannot
  read the application's custom properties; the inlined copy goes through
  `--font-sans` so it resolves the committed Korean face from
  [ADR 0031](0031-commit-a-korean-face-for-the-korean-surface.md).
- The same treatment would suit `where-the-gate-sits.svg`, which is still a
  hand-positioned English asset. It is not converted here.
