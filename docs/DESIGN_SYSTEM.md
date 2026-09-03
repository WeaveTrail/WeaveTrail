# WeaveTrail design system

WeaveTrail uses a paper-first forensic workbench language. Presentation makes
the trust boundary visible but never changes replay authority: AI proposes,
people approve, and versioned code decides.

## Provenance

| Authorship             | Treatment                        |
| ---------------------- | -------------------------------- |
| Source data            | Neutral paper and slate hairline |
| Unapproved AI proposal | Dashed slate border              |
| Human approval         | Solid teal border                |
| Versioned-code output  | Solid ink border                 |

Teal denotes brand, links, selection, and an actual human approval. It is not a
result color. `SUPPORTED` is green, `NOT_SUPPORTED` is neutral slate,
`INCONCLUSIVE` is amber, and pre-replay `REVIEW_REQUIRED` is blue. Red is
reserved for fail-closed operational refusal and destructive actions.

## Evidence values

Machine values use JetBrains Mono with tabular figures. Decimal strings, hashes,
paths, versions, states, and event identifiers retain their original casing and
content. A shortened hash is display-only; its full selectable value and label
remain available. Canonical event order is never user-sortable.

Every replay result carries this interpretation boundary:

> Technical pattern support only — not a finding of guilt, a causal claim,
> investment advice, or an automated trading decision.

## Layout and interaction

The desktop shell uses a 56px app bar and 252px navigation rail. At constrained
widths the navigation becomes a labelled horizontal region and evidence panels
stack in workflow order. Tables and long values scroll or wrap rather than
being hidden.

Controls use visible labels, native semantics, keyboard focus rings, and
non-color cues. Motion is short and direct, with reduced-motion preferences
honored. Evidence panels are flat and hairline-led: no gradients, blur, glow,
scale animation, or shadows.

## Component contracts

The component vocabulary is fixed even when a contract is not yet activated by
runtime data.

| Group | Components | Contract |
| --- | --- | --- |
| Core | `Button`, `Badge`, `Tag`, `Card`, `Callout`, `Icon` | Text-first controls, literal states, canonical identifiers, flat panels, explicit boundaries, and labelled outline icons only |
| Evidence | `ProvenanceChip`, `ResultBanner`, `HashRef`, `MappingRow`, `ThresholdGate`, `StateTrail` | Authorship, closed state vocabulary, labelled hashes, mapping review, exact gates, and runtime-backed history |
| Data | `DataTable`, `MetricRow` | Supplied order is preserved; machine and financial strings pass through unchanged |
| Forms | `Input`, `Select` | Visible labels, native semantics, and downstream reset after scenario changes |
| Navigation | `SideNav`, `Breadcrumb`, `Tabs` | Route-complete navigation and artifact views; tabs never stand in for workflow states |
| Code | `CodeBlock`, `Diagnostic` | Exact source text and field-specific fail-closed explanations |

`StateTrail` remains inactive until workflow states come from the running replay
path. Artifact tabs and bundle views remain inactive until real multiple-view
data exists. Complete canonical-event inspection remains inactive until every
finding can resolve through `eventId` to `rawRowHash`. Deferred components must
not be populated with illustrative production data.

## Brand assets

The seven-cell WeaveTrail mark represents two discrete source trails converging
on one canonical result. Use the primary mark on light surfaces, the inverse
mark on ink, and monochrome marks on mid-tone surfaces. Preserve one cell of
clear space. Do not recolor, crop, rotate, outline, shadow, or use the mark as an
interface icon.

Evidence Bundle export, complete source-row drill-down, and executed workflow
history remain planned, not shipped. Their proposed screens are not part of the
production interface.
