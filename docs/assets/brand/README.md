# Brand assets

`mark.svg` is copied verbatim from the canonical WeaveTrail design system at
the `WeaveTrail/design-reference` revision recorded in
[`apps/web/src/design-reference/snapshot.json`](../../../apps/web/src/design-reference/snapshot.json),
the one authoritative pin for every vendored design artifact. It is the same
file the product serves from `apps/web/public/brand/mark.svg`.

Verify the copy against that revision:

```bash
rev=$(jq -r .revision apps/web/src/design-reference/snapshot.json)
gh api -H 'Accept: application/vnd.github.raw+json' \
  "repos/WeaveTrail/design-reference/contents/assets/mark.svg?ref=$rev" |
  git hash-object --stdin
git hash-object docs/assets/brand/mark.svg
```

`pnpm test` also holds both copies to the SHA-256 the snapshot records.

Do not optimise, minify or reformat the file. It carries an embedded C2PA
content credential that an SVG optimiser strips silently.

The boundary figures under `boundary/` are generated from
`scripts/boundary-figures.mjs` and carry the same literal token values, which
`pnpm test` holds to the vendored `tokens/colors.css`; rebuild them with
`pnpm figures:build` rather than editing an SVG.

The three README diagrams in the parent directory are hand-authored from the pinned
revision's token files. Each carries a comment citing that revision and mapping
its literal hex values back to their token names; `pnpm test` fails when a
figure drops that citation, cites another revision, draws a hex value the
comment does not map, or a mapped value no longer matches the vendored
`tokens/colors.css`. Each also has a hand-authored `.ko.svg`
counterpart drawn from the same tokens and the same geometry, with its own
Korean line breaks and chip widths; `entry-point-diagrams.test.ts` holds the
two halves of a pair to the same components and marks.
