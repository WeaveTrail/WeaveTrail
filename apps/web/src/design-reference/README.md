# Vendored design snapshot

This directory records the minimal product snapshot of
`WeaveTrail/design-reference@3f078da1970e8accd83fbdde73308a2a24d0d1f8`.
`snapshot.json` is the one authoritative pin for every artifact taken from
`design-reference`: these tokens, both copies of the mark, and the literal token
values in the figures under `docs/assets` and `apps/web/public/diagrams`
([ADR 0071](../../../../docs/adr/0071-keep-one-design-reference-pin.md)).
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

## Earlier revision citations

Before upstream rewrote its history, the mark and the figures cited
`d780236766c1e0fddcc1976c252aba35b3898fe4`. That commit is pre-rewrite history,
which upstream `CONSUMING.md` forbids consumers to pin or fetch. Its
`tokens/`, `styles.css` and `assets/mark.svg` have the same git object IDs as
at the pinned revision, so every shipped byte is the pinned revision's byte.

## Re-pinning

After a later upstream re-export or history rewrite, pin the follow-up status
commit that upstream `CONSUMING.md` names as consumable, never a rewrite's
intermediate head or a pre-rewrite ref:

1. Update `revision`, `allowlistSha256` and the file hashes in `snapshot.json`
   and the revision in this README, copy the changed allowlisted bytes, and run
   the verifier above against a checkout of the new revision.
2. Copy `assets/mark.svg` to both `apps/web/public/brand/` and
   `docs/assets/brand/`.
3. Run `pnpm test`. It lists every record that still cites the old revision and
   every figure hex value that no longer matches `tokens/colors.css`. Update
   the revision in `THIRD_PARTY_NOTICES.md` and both architecture documents,
   correct any changed figure colors, rebuild generated figures with
   `pnpm diagram:build` and `pnpm figures:build`, then change each figure's
   citation. ADRs keep the revision current when they were accepted.
