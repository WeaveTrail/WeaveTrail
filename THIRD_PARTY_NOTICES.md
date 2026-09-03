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

The web build uses `next/font` to self-host IBM Plex Sans and JetBrains Mono.
Both font families are distributed under the SIL Open Font License 1.1. No
runtime font CDN is used.

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
