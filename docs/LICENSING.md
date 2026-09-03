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

Dependencies are resolved by `pnpm-lock.yaml` and installed separately. Their
upstream license files remain authoritative.

The repository-authored WeaveTrail mark, lockups, and app icons are project
assets under Apache-2.0. Their embedded provenance metadata must be retained.
The web build self-hosts IBM Plex Sans and JetBrains Mono through `next/font`;
the fonts remain licensed under the SIL Open Font License 1.1.

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
