# ADR 0030: Hold language selection outside React

- Status: Accepted
- Date: 2026-09-07

## Context

The public surface carries Korean and English. A reader's choice has to survive
navigation, and the server has to render something before any choice is known.

The behavioural suite is the constraint that shaped this. It asserts narration
and locates controls by English prose, and it calls page components as plain
functions outside a React render. A language mechanism that changed the
server-rendered strings, or that required a provider to be mounted before a
component could be called, would invalidate that suite rather than the behaviour
it covers.

Locale-segmented routes were the alternative. They would move the choice into
the URL, which is discoverable and shareable, but every route, canonical
metadata entry and sitemap entry changes with them, and a half-applied migration
leaves the surface inconsistent.

## Decision

Keep one set of routes. Hold the selection in a module-level store read through
`useSyncExternalStore`, with an English server snapshot.

- English is the server-rendered default, and every English string stays
  byte-identical to what the application rendered before the surface became
  bilingual.
- A stored preference is adopted when the store is first subscribed to, which
  happens after hydration, so the server output and the first hydrated render
  agree.
- `useLanguage` returns English outside a provider rather than throwing, so a
  component mounted on its own stays correct.
- Components that the suite calls directly take the language as a prop
  defaulting to English, rather than reading context themselves.
- Reading the stored preference sets no state inside an effect, so selection
  never triggers a cascading render.
- A `storage` listener adopts a change made in another tab, and a selection is
  persisted before the no-op check so that choosing the language already shown
  still records it.

Service and contract vocabulary is not translated. `SUPPORTED`,
`NOT_SUPPORTED`, `INCONCLUSIVE`, `REVIEW_REQUIRED`, hash and field names carry
one spelling in both languages, and only the text around them is translated.

## Consequences

- The bilingual surface degrades to the English one at any point: an unfinished
  translation shows English rather than a broken page.
- The existing behavioural suite keeps asserting English without a provider and
  without modification.
- The choice is not in the URL, so it cannot be linked or shared, and it is not
  visible to a crawler. Both follow from keeping one set of routes and are
  accepted.
- A reader who blocks site data keeps the language for the current page only.
- Committed assets whose text is baked in, such as the architecture diagram,
  are not covered by this mechanism and need their own localized artifact.
