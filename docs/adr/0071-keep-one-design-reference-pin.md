# ADR 0071: Keep one design-reference pin

- Status: Accepted
- Date: 2026-10-09

## Context

[ADR 0015](0015-apply-the-canonical-design-reference.md) vendored the design
tokens and the brand mark from `WeaveTrail/design-reference` at
`3f078da1970e8accd83fbdde73308a2a24d0d1f8`, and `snapshot.json` with
`pnpm design:snapshot:verify` enforces that pin. The brand readme, the
how-it-works generator and ten hand-authored figures instead cited
`d780236766c1e0fddcc1976c252aba35b3898fe4`, so `mark.svg` had two recorded
origins and the figures mapped their literal hex values to tokens from a
revision the repository neither vendors nor verifies.

`d780236` is upstream's pre-rewrite commit for the same design bundle. Upstream
`CONSUMING.md` forbids pinning or fetching pre-rewrite history and names
`3f078da` as the consumable status commit. At both commits `tokens/`,
`styles.css` and `assets/mark.svg` have the same git object IDs, so no shipped
byte differs; only the records disagreed.

## Decision

`apps/web/src/design-reference/snapshot.json` is the one authoritative pin for
every artifact taken from `design-reference`: the vendored tokens, both copies
of `mark.svg`, and the token values drawn into figures.

- The brand readme reads the revision from `snapshot.json` instead of repeating
  it.
- Records that must state a revision on their own keep it: the third-party
  notices for Apache-2.0 attribution, both architecture documents, the snapshot
  readme, and the comment of each hand-authored and how-it-works figure, since
  a standalone SVG is read without its repository. All now cite `3f078da`.
  The generated boundary figures cite no revision.
- A test in `pnpm test` fails when any tracked text file outside `docs/adr`
  cites `design-reference@<revision>` other than the pin, when a figure that
  must cite the pin drops it or cites anything else, when the notices,
  architecture documents or snapshot readme omit the pin or name any other
  full commit ID outside the readme's section on earlier citations, when either
  `mark.svg` copy differs from the hash `snapshot.json` records, or when a
  figure's hex value differs from the token it names in the vendored
  `tokens/colors.css`. Every tracked SVG whose leading comment maps hex values
  to tokens is checked, the generated boundary figures included.
- ADRs keep the revision current when they were accepted.

The snapshot readme records the re-pin procedure: pin the follow-up status
commit upstream names after a rewrite, re-verify, and let the test list every
stale citation and changed figure color.

## Consequences

A re-pin changes `snapshot.json` first and then fails `pnpm test` until every
citing record and figure has been reviewed against the new tokens. The figure
check reads only the hex-to-token comment; it does not prove that each drawn
shape uses the color its comment lists. `design:snapshot:verify` still needs a
checkout of the private upstream repository, so offline checks hold the
repository's records consistent with each other and with the recorded hashes,
not with upstream itself.
