# Licensing and Distribution

## Project license

WeaveTrail's original source code, interface, documentation, synthetic scenario
definitions, and repository-authored visual assets are available under the
[Apache License 2.0](../LICENSE), unless a file states otherwise. The root
[`NOTICE`](../NOTICE) accompanies that license.

Apache-2.0 was selected over MIT because both permit broad use and modification,
while Apache-2.0 additionally states an explicit contributor patent grant and
defines how attribution notices travel with derivative distributions. That
tradeoff fits a reference harness intended to accept new replay rules,
contracts, and evidence formats from multiple contributors.

The license does not grant rights to third-party trademarks, datasets, or
dependencies. It also does not change the limitations described in
[`LIMITATIONS.md`](LIMITATIONS.md).

## Source repository

The source distribution includes:

- `LICENSE` — the complete Apache License 2.0 text;
- `NOTICE` — project attribution information;
- `THIRD_PARTY_NOTICES.md` — the current dependency and distribution boundary;
  and
- SPDX `Apache-2.0` metadata in each workspace `package.json`.

It also includes a minimal snapshot from `WeaveTrail/design-reference` under
Apache-2.0, with its license copied to `third_party/design-reference-LICENSE.txt`,
and self-hosted IBM Plex Sans and JetBrains Mono font files under the SIL Open
Font License 1.1. Exact sources and included weights are recorded in
`THIRD_PARTY_NOTICES.md`; the corresponding license texts are under
`third_party/fonts/`.

Dependencies are resolved by `pnpm-lock.yaml` and installed separately. Their
upstream license files remain authoritative.

## Binary, container, and standalone distributions

Before publishing an artifact that embeds dependencies:

1. Generate the production license inventory with
   `pnpm licenses list --prod`.
2. Inspect the actual artifact rather than assuming it contains every installed
   package or only direct dependencies.
3. Include the root `LICENSE` and `NOTICE` for WeaveTrail.
4. Preserve all license texts and attributions required by bundled third-party
   works.
5. Review LGPL obligations if the artifact includes the prebuilt libvips
   package used by Sharp.
6. Record the command, lockfile, target platform, and artifact contents used for
   the review.

This repository does not yet publish a release artifact, so this checklist is a
release gate rather than a claim that a binary distribution has been audited.

## Published market-data artifact

The FSC KOSPI daily quotes for 2026-09-03 are distributed separately from the
project's Apache-2.0 code licence. The official data.go.kr distribution
「금융위원회_주식시세정보」 displayed **이용허락범위 제한 없음** when checked at
2026-09-05T19:31:14Z (2026-09-06 KST), before acquisition. The linked portal policy
and distribution label state no specific attribution condition for this
unrestricted distribution; provider/title/origin credit is retained under the
repository's provenance rules. No CC0, Apache-2.0 or KOGL type is inferred.

The [adjacent source record](../packages/scenarios/src/sources/real/README.md)
links the official distribution, terms, recorded attribution and immutable bytes.
[Third-party notices](../THIRD_PARTY_NOTICES.md) preserves that credit for source
distribution. Future acquisitions must recheck permission on their own date.
