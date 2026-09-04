# Brand assets

`mark.svg` is copied verbatim from the canonical WeaveTrail design system at
`WeaveTrail/design-reference@d780236766c1e0fddcc1976c252aba35b3898fe4`.

Verify the copy still matches that revision:

```bash
gh api repos/WeaveTrail/design-reference/contents/assets/mark.svg \
  --jq '.content' | base64 -d | git hash-object --stdin
git hash-object docs/assets/brand/mark.svg
```

Do not optimise, minify or reformat the file. It carries an embedded C2PA
content credential that an SVG optimiser strips silently.

The pinned revision above will change: `design-reference` is scheduled for a
history rewrite, which replaces every commit hash. Re-record the pin here when
the design system is vendored into `apps/web`.

The three README diagrams in the parent directory are hand-authored from the
same revision's token files. Each carries a comment mapping its literal hex
values back to their token names.
