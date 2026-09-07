<!-- markdownlint-disable-file MD033 MD041 -->

<p align="center">
  <img src="docs/assets/brand/mark.svg" width="72" height="72" alt="">
</p>

<h1 align="center">WeaveTrail</h1>

<p align="center">
  Weave signals into replayable evidence.
</p>

<p align="center">
  <a href="https://github.com/WeaveTrail/WeaveTrail/actions/workflows/ci.yml?query=branch%3Amain"><img alt="CI" src="https://github.com/WeaveTrail/WeaveTrail/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-blue">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A5%2022-informational">
</p>

<p align="center">
  <a href="https://weave-trail-web-flax.vercel.app"><b>Open the workbench</b></a>
  &middot;
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="#an-alert-is-not-yet-evidence">Problem</a> &middot;
  <a href="#a-worked-case">A worked case</a> &middot;
  <a href="#layer-separation">Layers</a> &middot;
  <a href="#the-boundary-is-a-contract-not-a-convention">Design</a> &middot;
  <a href="#how-it-is-built">How it is built</a>
</p>

A surveillance system flags a day, an account, a price move. Someone then has to
show that the flag holds up — which records produced the number, who decided
what those records meant, and what changes if any of those decisions change.
Answering that a second time, from the same records, is harder than raising the
flag was.

WeaveTrail is a workbench for that step. It takes one case, re-derives it from
the records it rests on, and leaves a trail a second person can walk without
trusting the first.

- **Where it sits ·** after an alert or a referral, before an investigation
  concludes. It finds nothing on its own; something else names the case.
- **Who it is for ·** surveillance teams at a trading venue, compliance
  reviewers at a broker or bank, supervisory investigators, internal audit.
- **What it returns ·** an answer computed by fixed code, the arithmetic behind
  it, and the original record behind every number in it.
- **What it never does ·** decide guilt, infer intent, or recommend a trade.

## An alert is not yet evidence

Whoever picks the alert up has to say which records produced the number, how
those records were read, and under which version of which rule. The data makes
that hard before a model is anywhere near it.

![An alert names a candidate whose executions arrive in two dialects with different field names and time notations; a model can propose how they line up, but an alert alone never records which rows, which mapping, or which rule version produced its number](docs/assets/problem.svg)

- **Systems disagree by construction ·** two venues name the same field
  differently, write time differently, and spell the same number differently.
- **Sameness is not given ·** a duplicate, a reused reference and a late arrival
  all look alike until something decides what counts as one record.
- **A model helps and adds a risk ·** it can read an unfamiliar file quickly,
  but a fluent summary can hide a gap, and nobody can see which is which.

See [Limitations](docs/LIMITATIONS.md) for what a result is allowed to mean.

## A worked case

On 3 September 2026 the KOSPI 200 finished a hair above the previous day. Inside
that day it had given back roughly fourteen times that gain from its own high,
and the futures contract on it gave back roughly twenty-five times. Nothing in a
closing price says so. Suppose someone hands you the date and asks whether it is
worth a second look.

![One day re-derived from published records: the published prices for the index and its futures contract, the scope a person fixes before anything runs, and what fixed code returns afterwards, with each observed value opening onto the published row it was read from](docs/assets/worked-case.svg)

The published records are read exactly as published. A person fixes what will be
examined — the date, the period it is compared against, how large a pull-back
has to be — and fixes it before anything runs. Then fixed code does the
arithmetic and reports where the day stands within that period. Each observed
value opens onto the published row it was read from; the thresholds are a
person's and say so, and the standing is computed across the whole approved
period. Running it again on the same inputs produces the same result.

What it does not say: who traded, why, or whether anything was wrong. The
comparison period and the thresholds were chosen by a person who had already
seen the day, which is part of how the result should be read.

[Walk the case](https://weave-trail-web-flax.vercel.app/case-2026-09-03)
&middot; [Limitations](docs/LIMITATIONS.md)

## Layer separation

**AI proposes. A person approves. Code decides. Evidence carries it back.**

Keeping a model off the network protects the data and leaves the harder problem
open: an unchecked judgement can still walk into a case file from inside the
building. So the work is separated by authority rather than by location. Each
layer holds what it may do, what it may never do, and the record it leaves
behind.

The first case the workbench answers is deliberately narrow:

> Does a short run-up in price match a declared pattern of repeated,
> concentrated buying by one approved group of accounts — and what do the same
> numbers look like with that group's trades taken out?

![Four layers between a surveillance alert and a re-derivable result: a constrained mapper proposes a field mapping, a reviewer approves that exact proposal by hash, versioned code decides the outcome, and the evidence layer resolves every finding back to its source rows](docs/assets/how-it-works.svg)

- **Interpret · a model ·** reads an unfamiliar file and proposes what each
  column means, with its reason and how sure it is. It never edits a row,
  computes a number, or owns an answer.
- **Approve · a person ·** approves that exact proposal, and anything the model
  flagged needs a written reason before it can pass. Approval fixes what will be
  examined; it cannot edit what comes back.
- **Decide · fixed code ·** compares the approved data against the approved
  thresholds and returns one of three answers: the pattern holds, it does not
  hold, or the evidence was not enough to say. The third is a real answer, not
  a failure.
- **Evidence ·** open any check and read the original rows underneath it. A
  number whose origin cannot be resolved is withheld rather than shown.

Two rules hold the separation up, and both live in code rather than in
guidance:

1. **No layer holds two authorities.** The layer that proposes cannot approve,
   the layer that approves cannot compute, and the layer that computes cannot
   widen what it was given.
2. **An answer carries the conditions it is true under.** Not true in general,
   but true for this version of this rule, against this approved scope, at the
   thresholds shown beside it.

The answer is about a technical pattern, not about legality, intent or guilt,
and taking a group's trades out is arithmetic, not a statement of cause.

Korea's [financial AI guideline](https://www.fsc.go.kr/no010101/87142), in force
since 22 June 2026, holds that the final decision and the responsibility for it
stay with a person, and the supervisory risk-management framework issued
alongside it asks for verification before release and documentation across the
process. Layer separation is one way to carry that out inside a single
investigation. It is a design alignment, not a certification, an approval, or an
endorsement.

See [Methodology](docs/METHODOLOGY.md) for the rule, its checks and where it
declines to answer.

## The boundary is a contract, not a convention

Repeatability is enforced rather than promised. How time is written, how ties
are broken, how decimals compare, and what the result fingerprint covers are
fixed choices, written down and tested.

![Untrusted input passes a gate that validates the contract, binds the approval to the proposed artifact hash, and compares every submitted row with the stored row, before reaching a deterministic core that fixes ordering, time precision, decimal arithmetic and number spelling](docs/assets/design.svg)

- **Nothing a model wrote crosses unapproved ·** the records are rebuilt from
  the stored file through the approved reading, not from anything the model
  handed over.
- **No floating point where it matters ·** prices and thresholds are compared
  exactly, never through a rounded quotient.
- **The fingerprint covers the answer, not the run ·** shuffling the same rows
  leaves it unchanged. Change the scope or the thresholds and the answer moves
  with them; change who approved and when, and that is kept in the approval
  record instead, where it can still be read.
- **Refusal is explicit ·** a check that cannot be satisfied stops there and
  returns no answer at all, rather than a weaker one.

The model behind the reading step is defined by what it is allowed to hand over,
so it can be replaced without moving the boundary.

See [Architecture](docs/ARCHITECTURE.md) for the trust boundaries, and the
[decision records](docs/adr) for why each choice was made.

## How it is built

One chain runs from stored records to evidence, and every handover between
components is a contract rather than a convention. A component is coloured by
who authors it — a model, a person, or fixed code — so the question "who decided
this?" is answered by the diagram itself. Two components are specified and not
yet built, and they say so.

![Ten components in two rows: committed source rows are untrusted input; a constrained schema mapper proposes a field mapping; a reviewer approves that proposal bound to its artifact hash; versioned code re-derives the canonical event set and computes a deterministic dataset profile; a planned bounded case proposer would select an actor group and interval from profile facts alone; a reviewer approves the case scope; the deterministic replay engine evaluates the rule; the source trace resolves every finding back to its committed rows; Evidence Bundle assembly remains planned. Any gate can refuse, and a refused request carries no result hash](docs/assets/component-chain.svg)

[Architecture](docs/ARCHITECTURE.md) carries the trust boundaries and what the
result fingerprint covers, [Methodology](docs/METHODOLOGY.md) the rule and its
checks, and the [decision records](docs/adr) the reason behind each choice.

## See it running

The [deployed workbench](https://weave-trail-web-flax.vercel.app) opens on a
guided walkthrough of one case at `/replay`. Its deployed revision may differ
from this checkout, and nothing here is a claim that this revision has been
deployed.

The walkthrough carries one file along the whole chain: read the actual rows,
review what a model proposed the columns mean, approve that reading and the
scope explicitly, run it, and open a result back to the rows it rests on. A
second example holds a column the model cannot resolve, so it needs a written
reason before it can be approved — and approving it does not authorize the
case. Running the same approved case again returns a second fingerprint to
compare against the first.

Approvals and results live in the open page only, so a refresh starts
unapproved. The cases are synthetic except for the published market records,
which are committed under a licence that permits it, with their origin and
retrieval recorded beside them. By default the reading step runs from stored
fixtures rather than calling a model, and the deployed configuration carries no
model credential. [Contributing](CONTRIBUTING.md) covers running it locally.

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
