# ADR 0045: Parse ADR references as documentation

- Status: Accepted
- Date: 2026-09-13

## Context

The ADR index check must reject duplicate numbers and missing local decision
records without treating documentation examples as live links. Regular
expressions for links and indentation cannot distinguish nested lists from
indented code, or balance delimiters and resolve reference-style links. Treating
every source file as Markdown also mistakes test specimen strings for actual
documentation references.

## Decision

Use the CommonMark JavaScript reference parser (`commonmark`) as a development
dependency. Walk its link and image nodes, whose destinations already reflect
Markdown escapes and reference definitions. Code blocks, code spans and unused
definitions do not produce live link nodes. Markdown files resolve local links
relative to their own directory, including links spelled `docs/adr/...`.

For JavaScript and TypeScript files (including JSX, TSX, MJS, CJS, MTS and CTS),
use the existing TypeScript parser to collect documentation comments. Parse
their prose as CommonMark; string, template and regex literals are not
documentation. These comments may use repository-root `docs/adr/...` targets,
as the repository's existing source references do. Other relative targets are
relative to the source file.

Strip query and fragment components and decode percent escapes before local
filesystem lookup. External URI schemes are outside this check. Check both
paths inside `docs/adr` and paths containing an `adr/` segment, so a mistakenly
duplicated `docs/docs/adr/...` path fails at its actual rendered destination.
Links to the ADR directory itself are navigation, not record references.

Every Markdown record directly in `docs/adr` must use a four-digit filename and
begin on its first line with the matching ADR heading. Duplicate headings and
malformed filenames fail validation. The CLI is also importable from Node eval
without a script argument.

## Consequences

- One parser owns Markdown syntax instead of a growing set of special cases.
  The new dependency runs only in development and CI, not the product runtime.
- Regression fixtures cover rendered links and non-link examples together,
  including nested containers, balanced parentheses, encoded destinations,
  document-relative paths, source comments, and malformed records.
- The validator does not fetch external URLs or validate fragment anchors. It
  is not a general website link checker: raw HTML links, other source languages,
  and plain prose mentions of ADR numbers are outside its link-parsing scope.
- `pnpm adr:check` and `pnpm adr:test` run in `pnpm check` and the CI workflow.
  The tests create synthetic temporary directories and remove them afterward.
