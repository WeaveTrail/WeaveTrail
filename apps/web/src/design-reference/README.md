# Vendored design snapshot

This directory records the minimal product snapshot of
`WeaveTrail/design-reference@3f078da1970e8accd83fbdde73308a2a24d0d1f8`.
Included upstream paths are `styles.css` and `tokens/**`; the byte-identical
`assets/mark.svg` is served from `apps/web/public/brand/mark.svg`.

To verify the pin and the pinned revision's allowlist:

```bash
git clone https://github.com/WeaveTrail/design-reference.git /tmp/weavetrail-design-reference
git -C /tmp/weavetrail-design-reference checkout 3f078da1970e8accd83fbdde73308a2a24d0d1f8
DESIGN_REFERENCE_DIR=/tmp/weavetrail-design-reference pnpm design:snapshot:verify
```

The verifier confirms the checkout revision, hashes the allowlist, rejects
non-allowlisted snapshot paths, and compares recorded, upstream, and local
bytes. `tokens/fonts.css` is retained for snapshot verification but never
imported: the product replaces its external import with `next/font/local`.
Do not copy `ui_kits/**`, fixtures, prompts, guidelines, specimen cards, or
design-tool metadata into the product.
