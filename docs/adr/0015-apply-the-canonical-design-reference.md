# ADR 0015: Apply the canonical design reference to product presentation

## Status

Accepted

## Context

ADR 0012 moved design authorship to `WeaveTrail/design-reference` and left the
product with neutral presentation. The public product now needs to present the
canonical paper-first, provenance-aware workbench without allowing a remote
design repository or illustrative design fixtures to become application data.

## Decision

Apply the presentation from `WeaveTrail/design-reference` revision
`3f078da1970e8accd83fbdde73308a2a24d0d1f8`. This supersedes ADR 0012's neutral
presentation decision. Its separation decision remains: the design repository
is neither a build nor runtime dependency.

Vendor only the token files, aggregate stylesheet, and original `mark.svg`.
Record their upstream SHA-256 digests in
`apps/web/src/design-reference/snapshot.json`. The verification command reads
the pinned revision and its `export-allowlist.txt`, rejects a payload path not
authorized by that allowlist, and compares both upstream and vendored bytes.

The upstream `tokens/fonts.css` remains unmodified snapshot evidence but is not
loaded by the product because it imports Google Fonts. The product intentionally
uses `next/font/local` with separately sourced IBM Plex Sans and JetBrains Mono
WOFF2 files. This is the only presentation-token integration difference.

Serve `mark.svg` verbatim from the public directory. Do not pass it through an
SVG optimizer or image transformation: its embedded C2PA manifest records its
delivery provenance and must remain byte-identical to the pinned asset.

## Consequences

The five public routes share the canonical shell and tokens while existing
runtime contracts, scenarios, replay states, results, and hashes remain the
only authority for displayed evidence. Updating the design requires an explicit
new pin, snapshot update, license review, and verification. The remote design
repository is needed only when a maintainer runs the snapshot verification.
