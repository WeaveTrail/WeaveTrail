<!-- markdownlint-disable-file MD033 MD041 -->

<p align="center">
  <img src="docs/assets/brand/mark.svg" width="72" height="72" alt="">
</p>

<h1 align="center">WeaveTrail</h1>

<p align="center">
  Evidence-graded market event analysis from official releases and public data.
</p>

<p align="center">
  <a href="https://github.com/WeaveTrail/WeaveTrail/actions/workflows/ci.yml?query=branch%3Amain"><img alt="CI" src="https://github.com/WeaveTrail/WeaveTrail/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-blue">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A5%2022-informational">
</p>

<p align="center">
  <a href="https://weave-trail-web-flax.vercel.app"><b>Open WeaveTrail</b></a>
  &middot;
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="#a-summary-is-not-yet-evidence">Problem</a> &middot;
  <a href="#a-worked-case">A worked case</a> &middot;
  <a href="#layer-separation">Layers</a> &middot;
  <a href="#the-boundary-is-a-contract-not-a-convention">Design</a> &middot;
  <a href="#how-it-fits-together">How it fits together</a>
</p>

When something happens in the market, two kinds of text follow. Regulators
publish official releases: exact, but scattered and hard to read. Analysts and
AI tools publish summaries: easy to read, but nothing in them shows which
sentence was checked and which is the writer's own inference.

WeaveTrail is being built to join the two: collect official releases and the
published market data behind them, turn each release into an event, and lead
with the conclusions that data supports on one screen.

**Current status:** Evidence Grade `1.0`, its deterministic verification
boundaries, and bilingual badge and tally components are implemented. No public
route renders those badges or tallies yet; connecting validated declarations to
each displayed sentence remains planned. Existing pages must not be read as
sentence-graded output.

- **What it reads ·** releases from the Financial Services Commission, the
  Financial Supervisory Service and the SEC, and published market data. Primary
  sources only, and no affiliation with any of them.
- **Who it is for ·** anyone who has to explain a market event to someone else:
  research, risk, compliance and planning staff at financial firms, and
  individual analysts who read and write in depth.
- **What it is planned to return ·** conclusions first, every sentence graded
  by its evidence, and a one-page brief whose link reopens the same numbers.
- **What it never does ·** state a cause, intent or legality, single out an
  account, forecast a price, or recommend a trade.

## A summary is not yet evidence

Whoever has to explain an event goes between the two by hand: find the release,
look up the prices somewhere else, match the numbers, and still end up without
one page of evidence to pass on.

- **Releases are scattered ·** each institution publishes on its own site, in
  HTML, PDF or HWP, and the first sentence is already statute and acronyms.
- **The numbers live elsewhere ·** checking one figure in a release means
  opening the market data on another site.
- **Every sentence weighs the same ·** in a fluent summary a quotation, a
  calculation and a guess look alike, and the reader cannot tell which is which.

See [Limitations](docs/LIMITATIONS.md) for what a result is allowed to mean.

## A worked case

On 3 September 2026 the KOSPI 200 finished a hair above the previous day. Inside
that day it had given back roughly fourteen times that gain from its own high,
and the futures contract on it gave back roughly twenty-five times. Nothing in a
closing price says so. Suppose someone hands you the date and asks whether it is
worth a second look.

![One day re-derived from published records: the index drawn as the session minute by minute — the same line the site shows, illustrative and taking no part in the checks — marked at its high and its low with the published open and close beneath it, its futures contract as the day's published range, the day and period a person fixes before anything runs, and what the versioned rule returned — each observed value beside the threshold it was compared with, and a note that the thresholds were chosen by someone who had already seen the day](docs/assets/worked-case.svg)

The published records are read exactly as published. A person fixes what will be
examined — the date, the period it is compared against, how large a pull-back
has to be — before anything runs. Fixed code then does the arithmetic and
reports where the day stands within that period. Each observed value opens onto
the published row it was read from, and running it again on the same inputs
produces the same result.

What it does not say: who traded, why, or whether anything was wrong. The
comparison period and the thresholds were chosen by a person who had already
seen the day, which is part of how the result should be read.

[Walk the case](https://weave-trail-web-flax.vercel.app/case-2026-09-03)
&middot; [Limitations](docs/LIMITATIONS.md)

## Layer separation

**AI proposes. A person approves. Code decides. Evidence carries it back.**

A model reads faster than anyone, and a fluent summary can hide a gap. So the
work is separated by authority: each layer holds what it may do, what it may
never do, and the record it leaves behind. The planned public surface makes
that separation visible with an evidence badge on every sentence; current
routes do not yet render it.

![Planned four-layer surface between an official release, published market data or a pasted analysis and a sentence on screen: a model proposes a release's facts with their passages and the claims in a pasted text, a person fixes what will be examined and adopts conclusions into a brief, fixed code matches quotations against source bytes and recomputes calculated claims from verified source data, and each planned sentence opens onto its evidence. Beneath them, quoted, recomputed, differs and not confirmable are checked by code, and AI interpretation is a model's proposal](docs/assets/layer-separation.svg)

- **Interpret · a model ·** proposes the structure of a release — who, when,
  what, how much, which action, under which provision — with the passage each
  fact was read from, and picks out the claims worth checking in a pasted text.
  It never computes a number or owns an answer.
- **Approve · a person ·** fixes what will be examined before anything runs,
  and chooses which conclusions go into a brief. Approval cannot edit what comes
  back.
- **Decide · fixed code ·** matches quotations against retained source bytes,
  including numbers in quoted text. For calculated claims, it recomputes the
  value from verified source data. Where the data is absent it says so instead
  of guessing. A source's provenance tier is recorded separately.
- **Evidence ·** the planned surface opens every sentence onto its source
  passage, or onto the source rows, the formula and the definition behind it. A
  number whose origin cannot be resolved is withheld rather than shown.

| Badge             | What it means                                                            | Who vouches for it               |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------- |
| Quoted            | The sentence stands in the original, at that passage                     | Code, against the original bytes |
| Recomputed        | Recomputed from verified source data, or equal to that value             | Code                             |
| Differs           | Recomputing gives another value, shown beside it                         | Code                             |
| Not confirmable   | Verified source data cannot settle it; reason and missing data are shown | Code                             |
| AI interpretation | A model's summary, or a question data cannot answer                      | Nobody — it is a proposal        |

Two rules hold the separation up, and both live in code rather than in
guidance:

1. **No layer holds two authorities.** The layer that proposes cannot approve,
   the layer that approves cannot compute, and the layer that computes cannot
   widen what it was given.
2. **An answer carries the conditions it is true under.** Not true in general,
   but true for this version of this definition, against this snapshot of the
   data, at the thresholds shown beside it.

A conclusion says what the public data supports, not why it happened, whether
anyone did wrong, or where a price goes next.

Korea's [financial AI guideline](https://www.fsc.go.kr/no010101/87142), in force
since 22 June 2026, holds that the final decision and the responsibility for it
stay with a person, and the supervisory risk-management framework issued
alongside it asks for verification before release and documentation across the
process. Layer separation is one way to carry that out, sentence by sentence.
It is a design alignment, not a certification, an approval, or an endorsement.

See [Methodology](docs/METHODOLOGY.md) for the rules, their checks and where
they decline to answer.

## The boundary is a contract, not a convention

Repeatability is enforced rather than promised. How time is written, how ties
are broken, how decimals compare, and what the result fingerprint covers are
fixed choices, written down and tested.

![Untrusted input passes a gate that validates the contract, binds the approval to the proposed artifact hash, and compares every submitted row with the stored row, before reaching a deterministic core that fixes ordering, time precision, decimal arithmetic and number spelling](docs/assets/design.svg)

- **Nothing a model wrote crosses unapproved ·** a quotation is shown only when
  it matches the original, and records are rebuilt from the stored source, not
  from anything the model handed over.
- **No floating point where it matters ·** prices and thresholds are compared
  exactly, never through a rounded quotient.
- **A snapshot is never overwritten ·** a collected document keeps its original
  bytes and hash, and a changed one is linked to the one before it, so a shared
  link reopens the same numbers after new data arrives.
- **The fingerprint covers the answer, not the run ·** shuffling the same rows
  leaves it unchanged; who approved and when is kept in the approval record
  instead, where it can still be read.
- **Refusal is explicit ·** a check that cannot be satisfied stops there and
  returns no answer at all, rather than a weaker one.

Each model is defined by what it is allowed to hand over, so it can be replaced
without moving the boundary.

See [Architecture](docs/ARCHITECTURE.md) for the trust boundaries, and the
[decision records](docs/adr) for why each choice was made.

## How it fits together

One chain runs from a collected document to a sentence on screen, and every
handover is a contract rather than a convention. Each step names who authors
its output — a model, a person, or fixed code — so "who decided this?" has an
answer at every step.

- **Collect · code ·** official releases and published market data, kept as
  immutable snapshots with their original bytes, hash, origin and reuse terms.
- **Read · code ·** HTML, PDF and HWP parsed into text and tables that keep the
  position of every character in the original.
- **Structure · a model, then code ·** a model proposes the event's facts and
  their passages; code keeps a quotation only if it matches the original.
- **Link · code ·** names of instruments and indices resolved to their
  published market data as of the event's date.
- **Conclude · code ·** fixed-definition conclusions for each event, and
  market-wide statistics for every day that flag nothing.
- **Check · a model, then code ·** claims picked out of a pasted text, each
  recomputed or matched and graded like any other sentence.
- **Pass on · a person ·** adopted conclusions exported as a one-page brief,
  whose link pins the snapshots and definitions it used.

Case replay is the expert view of the same separation: a model proposes what the
columns of an unfamiliar file mean, a person approves that reading and the
scope, versioned code replays the case, and every finding opens onto its source
rows.

[Architecture](docs/ARCHITECTURE.md) carries the trust boundaries and what the
result fingerprint covers, [Methodology](docs/METHODOLOGY.md) the rules and
their checks, and the [decision records](docs/adr) the reason behind each
choice.

## See it running

The [deployed site](https://weave-trail-web-flax.vercel.app) follows the `main`
branch and may differ from this checkout. It serves the worked case above and
case replay at `/replay`; the rest of the chain is tracked in the
[v0.1.0 milestone](https://github.com/WeaveTrail/WeaveTrail/milestone/1).

Case replay carries one file along the whole chain: read the actual rows, review
what a model proposed the columns mean, approve that reading and the scope, run
it, and open a result back to the rows it rests on. Approvals and results live
in the open page only, so a refresh starts unapproved. The cases are synthetic
except for the published market records, which are committed under a licence
that permits it, with their origin and retrieval recorded beside them. By
default the reading step runs from stored fixtures rather than calling a model,
and the deployed configuration carries no model credential.
[Contributing](CONTRIBUTING.md) covers running it locally.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — components and trust boundaries
  ([한국어](docs/ARCHITECTURE.ko.md))
- [Methodology](docs/METHODOLOGY.md) — what a result means and the implemented
  rules ([한국어](docs/METHODOLOGY.ko.md))
- [Evaluation](docs/EVALUATION.md) — how every published measurement is defined
  and reproduced ([한국어](docs/EVALUATION.ko.md))
- [Limitations](docs/LIMITATIONS.md) — non-goals and interpretation boundaries
  ([한국어](docs/LIMITATIONS.ko.md))
- [Daily quote normalization](docs/DAILY_QUOTES.md) — the published market
  records, their permission and their exact reproduction
  ([한국어](docs/DAILY_QUOTES.ko.md))
- [Expected scenario results](https://weave-trail-web-flax.vercel.app/expectations)
  — what every committed case returns, taken from the engine itself
- [Deployment](docs/DEPLOYMENT.md) — public URL, settings, checks and rollback
- [Decision records](docs/adr) — why each design choice was made
- [Contributing](CONTRIBUTING.md) — workflow and validation expectations

## License

Original source code and documentation are licensed under the
[Apache License 2.0](LICENSE). Third-party packages keep their own licences;
see [Licensing and distribution](docs/LICENSING.md) and
[Third-party notices](THIRD_PARTY_NOTICES.md).
