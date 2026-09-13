# ADR 0047: Embed the site's faces in the Korean figures

- Status: Accepted
- Date: 2026-09-14

## Context

The Korean README embeds three figures: the worked case, the layer separation
and the design. A README shows a figure as an image, and an image cannot load
the faces the site serves, so every family the figure names falls through to
the reader's own system: Apple SD Gothic Neo on one machine, Malgun Gothic on
another, a missing-glyph box on a third. The Korean figures therefore did not
look like the Korean site, which [ADR 0042](0042-commit-a-korean-face-for-the-korean-surface.md)
sets in IBM Plex Sans KR. They had also been laid out on the English geometry,
with small labels tracked out the English way, which pulls Hangul apart into
single syllables.

ADR 0042 rejected a subset for the site: a derived face needs its derivation
recorded and reproduced, and breaks silently when a string changes. A figure
is the opposite case. Its strings are fixed and few, and embedding the three
complete Korean weights would put more than a megabyte into each image.

IBM Plex is licensed under the SIL OFL 1.1 with the reserved font name "Plex",
and a cut face is a modified version, which may not carry that name.

## Decision

Each Korean README figure embeds cuts of the committed faces, holding only the
characters it sets.

- `scripts/embed-figure-fonts.py` (`pnpm diagram:fonts`) resolves every text
  run to the face the site would use for it — IBM Plex Sans, or JetBrains Mono
  for machine values, with Hangul falling through to IBM Plex Sans KR, and
  weights matched the way CSS matches them — cuts that face with fontTools to
  the characters it draws, and writes it into the figure as WOFF2 data.
- The cut faces are renamed `WeaveTrail Figure Sans`,
  `WeaveTrail Figure Sans KR` and `WeaveTrail Figure Mono`. Their glyphs,
  metrics and hinting are the committed faces' own; their copyright and licence
  records are kept.
- Each block names its source files with their SHA-256 and the fontTools
  version, and lists the characters it covers. The output is byte-for-byte
  reproducible.
- The worked case stays generated: its generator inlines the block the script
  writes to `docs/assets/fonts/worked-case.ko.faces.svg`, so
  `pnpm diagram:case` still reproduces the committed figure.
- `entry-point-diagrams.test.ts` fails when a Korean README figure sets a
  character its embedded faces do not cover.
- The Korean figures are laid out for Korean: labels untracked and a size
  larger, lines broken at word boundaries, and contract identifiers kept in the
  mono face with the Korean words beside them in the sans.

## Consequences

- The Korean figures look like the Korean site on every platform, at 34–64 KB
  each.
- Changing the words of a Korean figure needs `pnpm diagram:fonts`, which needs
  Python with `fonttools` and `brotli`; the test names the command when it is
  due. Tests and builds need neither.
- The English figures are unchanged and still name the families without
  embedding them.
