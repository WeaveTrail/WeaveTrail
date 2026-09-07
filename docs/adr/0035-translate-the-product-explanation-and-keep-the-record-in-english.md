# ADR 0035: Translate the product explanation and keep the working record in English

- Status: Accepted
- Date: 2026-09-07

## Context

The deployed surface has carried Korean and English since
[ADR 0030](0030-hold-language-selection-outside-react.md), and a visitor who
arrives in Korean can complete the whole journey in Korean. The repository
entry point could not: `README.md` and every document it links were English
only. A reader who reached the repository from the deployed site — the path a
Korean reviewer actually takes — lost the language at the door.

The obvious response, translating everything, is the wrong size. The repository
holds three kinds of document and they do not have the same audience.

- What the product is, what a result means, and what it refuses to claim. A
  reader decides whether to trust the thing from these.
- How to work on the repository: contribution process, conventions, deployment
  operations, decision records. Their audience is whoever changes the code, and
  that audience already works in English — issues, commits and pull requests are
  English by an existing convention.
- Licence and legal text, where the English is the instrument itself.

Translating the second kind doubles the maintenance of documents that change
with almost every pull request, for readers who are not asking for it.
Translating the third would produce a text that looks like a licence and is not
one.

## Decision

Publish Korean beside English for the documents that explain the product, and
keep the rest in English.

- `README.ko.md` beside `README.md`, linked from each other's first screenful.
- Korean versions of the documents the README links for understanding the
  product: architecture, methodology, evaluation protocol, limitations, and
  daily quote normalization. Each pair links to the other under its heading.
- `CONTRIBUTING.md`, `AGENTS.md`, `docs/DEPLOYMENT.md`, the ADRs, the licence
  files and the third-party notices stay English. A Korean document that links
  to one of them marks it `(영문)` at the link, so a reader knows before
  clicking.
- **English is the source of record.** Where the two disagree, the English text
  governs; each Korean document says so under its heading. This keeps a
  translation from quietly becoming a second specification.
- Contract identifiers, hashes, versions, thresholds, result values, field
  names and commands are not translated. Both languages name the same
  artifacts, and a command copied from either document is the same command.
- The Korean product vocabulary follows the deployed surface rather than being
  chosen per document, so a reader moving between the site and the repository
  meets one set of words.

The README itself was rewritten in the same change. It now explains the product
in plain language and carries one worked case — a real published day, its
figure, and what the result does and does not say — while the contract
vocabulary it used to carry moved into the linked documents. Its diagram exists
in both languages (`docs/assets/worked-case.svg` and `worked-case.ko.svg`);
the four older diagrams remain English in both READMEs, with their content
carried by Korean alt text until they are redrawn in
[#126](https://github.com/WeaveTrail/WeaveTrail/issues/126).

That worked-case figure is generated rather than drawn, following
[ADR 0032](0032-draw-the-layer-diagram-from-localized-copy.md). It shows real
published prices and real rule output, and a drawing cannot be reproduced from
the artifacts it claims to show: its bar positions were computed by hand
against prices that can change, and only the values someone thought to check
were pinned. `apps/web/src/app/case-2026-09-03/worked-case-diagram.ts` reads
the prices from the committed rows and the multiples, thresholds and standing
from the engine, derives the bar geometry from the prices, and renders both
languages. `pnpm diagram:case` writes the two committed files; the test beside
it fails when they differ, so the committed bytes are reproducible from the
committed artifacts by one command.

Because the figure reports a rule result over a real instrument, it carries the
disclosures that go with one: each observation prints beside the threshold it
was compared with, the thresholds say they were chosen by a person who had
already seen the day, and the figure states that it is deterministic output
rather than an approved case or evidence — the approval that matters happens on
the site, before the case runs.

`apps/web/src/app/i18n/entry-point-parity.test.ts` enforces the structural part
of this: that each pair exists, that their headings correspond, that the
commands and the deployed URL match, that every relative link resolves, and
that a Korean document does not link to an English-only destination without
marking it — whatever that destination's extension, since `LICENSE` and the
`docs/adr` directory surprise a reader exactly as much as a `.md` file would.
A link to a source file is not marked: code is English by nature.

The worked-case diagrams are held to the same standard by
`worked-case-diagram.test.ts`, which writes them and fails when the committed
files no longer match what the module renders.

## Consequences

- A Korean reader gets the same scope, the same result semantics and the same
  stated limits as an English one, from the entry point onward.
- A change to what the product claims is now a change in two files. The parity
  test catches a missing section or a broken link; it cannot catch a claim that
  drifts in one language only, so a change to any translated document updates
  both halves in the same pull request.
- Work on the repository stays single-language, so the documents that change
  most often do not double in cost.
- A document that later becomes product explanation rather than working record —
  the evaluation results, once they exist — joins the translated set rather
  than creating a third category.
