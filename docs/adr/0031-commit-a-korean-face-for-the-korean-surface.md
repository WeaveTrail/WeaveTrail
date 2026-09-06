# ADR 0031: Commit a Korean face for the Korean surface

- Status: Accepted
- Date: 2026-09-07

## Context

The public surface carries Korean and English. The committed Latin family is
IBM Plex Sans, self-hosted through `next/font/local`, and it holds no Hangul.
Korean therefore fell to whatever face the reader's system supplied — a
different one on Windows, macOS, Android and most Linux desktops. The surface
was not one design in two languages; it was one design in English and an
uncontrolled one in Korean, with the wrong weights, the wrong metrics and, most
visibly, the wrong line breaking in the home headline.

When the surface became bilingual it was decided not to add a webfont. That
constraint was set while the rendered surface was English-only, where a system
Hangul fallback appeared in almost nothing. It does not survive a surface whose
Korean copy is a deliverable rather than a translation.

Two alternatives were weighed. A subset built from the strings the surface
renders would be smaller, but it is a derived artifact: it would need its
derivation recorded and reproduced, and it silently breaks the moment a string
changes. Keeping the system fallback and tuning the stack per platform trades
one uncontrolled face for several.

## Decision

Commit IBM Plex Sans KR — the Latin family's official Korean sibling, from the
same design system — the way the Latin faces are committed.

- The upstream hinted WOFF2 files for weights 400, 500 and 600, unchanged, in
  `apps/web/public/fonts/ibm-plex-sans-kr/`.
- Its SIL OFL 1.1 text at `third_party/fonts/ibm-plex-sans-kr/OFL.txt`, and its
  upstream, weights and file digests in `THIRD_PARTY_NOTICES.md`, the way every
  committed font records them.
- The Korean face follows the Latin one in `--font-sans` rather than preceding
  it. Latin text resolves in the Latin face and Hangul falls through to the
  Korean one.
- `word-break: keep-all` on the document. Korean breaks between syllables by
  default, which splits a word across lines; both languages read better broken
  at word boundaries.

The Korean faces are declared with `@font-face` in the application stylesheet
rather than through `next/font/local`, which is how the Latin faces load.
`next/font/local` emits a preload link for every face it declares, and this
build honours neither `preload: false` nor an unused variable: all three
Korean weights were fetched eagerly on the English pages, 1.3 MB that nothing
on those pages draws with. A `unicode-range` covering Hangul holds the fetch
until the browser has Hangul to set, and that descriptor is only reachable
from a hand-written face. The properties that matter are unchanged — the bytes
are committed, self-hosted, unmodified and licence-recorded, and no font CDN is
contacted — so the divergence is the loader and nothing else. Served from
`public/`, the files carry no build hash, so `next.config.ts` names their
caching explicitly.

## Consequences

- Korean is set in the design system's own face, at the weights the design
  uses, on every platform.
- The Korean files are roughly 430 KB each against 65 KB for a Latin weight.
  `unicode-range` keeps them off the wire for a reader who renders no Hangul,
  and `font-display: swap` keeps first paint unblocked for one who does.
- A committed complete face means a copy change never invalidates the font, and
  no derivation has to be recorded or reproduced.
- The design reference's `tokens/fonts.css` is vendored and hash-verified, so
  the stack is composed in the application's own stylesheet, as it already was.
