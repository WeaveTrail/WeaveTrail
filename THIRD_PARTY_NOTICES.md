# Third-Party Notices

WeaveTrail's original source code and documentation are licensed under the
Apache License 2.0. The packages installed through `pnpm` are separate works and
retain their respective licenses; the project license does not relicense them.

## Direct runtime dependencies

The current `pnpm-lock.yaml` resolves the direct runtime dependencies below.

| Package   | Resolved version | Declared license |
| --------- | ---------------- | ---------------- |
| Next.js   | 16.3.3           | MIT              |
| React     | 19.2.8           | MIT              |
| React DOM | 19.2.8           | MIT              |
| Zod       | 4.5.4            | MIT              |

The workspace packages under `@weavetrail/*` are original project code covered
by the root Apache-2.0 license.

## Transitive dependency boundary

The production dependency graph currently contains packages declaring MIT,
Apache-2.0, ISC, BSD-3-Clause, 0BSD, CC-BY-4.0, and LGPL-3.0-or-later licenses.
The LGPL entry is the prebuilt libvips package installed transitively for
Sharp. It is not project-authored code and is not relicensed by WeaveTrail.

This source repository does not commit `node_modules` or a standalone server
bundle. Package managers install dependencies from their upstream packages.
Anyone distributing a container, standalone build, executable bundle, or other
artifact that embeds third-party software must include the applicable license
texts, attribution notices, and source or relinking information required by
those dependencies.

To inspect the exact dependency graph represented by the current lockfile, run:

```bash
pnpm licenses list --prod
```

This file is an inventory aid, not a substitute for the license files shipped
inside the dependency packages or for a distribution-specific compliance
review.

## Vendored design output

The product includes tokens and `assets/mark.svg` from
`WeaveTrail/design-reference` revision
`3f078da1970e8accd83fbdde73308a2a24d0d1f8`, licensed under Apache-2.0. The
upstream license is copied at `third_party/design-reference-LICENSE.txt`. The
WeaveTrail name and marks are not granted trademark rights by that license.
The SVG is preserved byte-for-byte, including its embedded C2PA provenance
metadata.

## Self-hosted fonts

| Family         | Included files                              | Upstream                                              | License     |
| -------------- | ------------------------------------------- | ----------------------------------------------------- | ----------- |
| IBM Plex Sans  | Regular 400, Medium 500, SemiBold 600 WOFF2 | `IBM/plex`, `packages/plex-sans/fonts/complete/woff2` | SIL OFL 1.1 |
| JetBrains Mono | Regular 400, Medium 500, Bold 700 WOFF2     | `JetBrains/JetBrainsMono`, `fonts/webfonts`           | SIL OFL 1.1 |

The license texts are copied to `third_party/fonts/ibm-plex-sans/OFL.txt` and
`third_party/fonts/jetbrains-mono/OFL.txt`. These files are served locally by
Next.js; page rendering does not request Google Fonts, gstatic, or another font
CDN.

## Published FSC stock quotations

Source: Financial Services Commission (금융위원회),
[금융위원회_주식시세정보](https://www.data.go.kr/data/15094808/openapi.do),
via data.go.kr. The committed window is 2026-09-03 KOSPI daily quotes, first
40 rows of 943, retrieved at 2026-09-05T19:31:27.527Z (2026-09-06 KST).

Recorded permission: **이용허락범위 제한 없음**, checked at
2026-09-05T19:31:14Z with the linked
[portal policy](https://www.data.go.kr/ugs/selectPortalPolicyView.do). Neither
the distribution label nor that policy states a specific attribution condition
for this unrestricted distribution. This provider credit is retained under
repository provenance rules; no CC0, Apache-2.0 or KOGL type is inferred.

The original response and deterministically derived JSONL retain every returned
item and column. These data bytes are not relicensed under the code licence.
See the [source README and adjacent provenance](packages/scenarios/src/sources/real/README.md)
for the request, checksums, derivation and interpretation. No participant, trade
side or pattern verdict is attached to a real instrument.
