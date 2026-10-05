# ADR 0056: Withdraw the committed real-data tier

- Status: Accepted
- Date: 2026-10-05

## Context

The publisher's written answer recorded in ADR 0055 permits non-commercial
server-side use of FSC quotations with attribution, but does not permit
publication of original data or files containing it on GitHub, or user downloads.
The project no longer plans a private store or host for these sources. Its
current model-evaluation work uses synthetic schema dialects and needs no real
market values. The owner decision is removal, without rewriting Git history.

## Decision

Withdraw the committed real-data tier. Remove all quotation response bytes,
JSONL, generated rows, provenance/acquisition registrations and projections in
`packages/published-data`, and the manual acquisition scripts. Remove the
published case page, its API, charts, approval records and figures; remove the
published coverage APIs and their evaluation runner. Remove those sources from
mapping registration, replay selection and the accepted scenario vocabulary.
The homepage remains usable with its existing synthetic walkthrough link and
without the quotation block. Its replacement is separate work.

Keep generic contracts, deterministic normalization, rules, evidence hash
scopes, synthetic scenarios and exact dated resolution over supplied synthetic
listings. Replace real-data-dependent hash and coverage probes with synthetic
specimens. FSC schema field names may remain as references for synthetic
dialects; quotation values may not remain in the current tree.

Evaluation v3 uses only the retained synthetic inputs with unchanged oracles.
Financial replay v1/v2 and claim coverage v1 summaries and run receipts remain
unchanged historical captures, explicitly marked as containing withdrawn
sources. They are not current results and their withdrawn inputs cannot be
reproduced from this tree. Git history is not rewritten. No private store, host
or new real data is added. The data-provenance rules in AGENTS.md remain intact;
the existing generic service-store implementation is not connected to the app.

## Supersession

This supersedes the committed-source admission and composition decisions in
ADRs 0021, 0023, 0025 and 0030, and the source-dependent parts of ADRs 0022,
0024, 0032, 0034, 0037, 0038, 0044, 0046, 0047, 0050, 0051, 0052, 0053,
0054 and 0055. Generic contracts, hash semantics, synthetic rules, translation,
font support and provenance safeguards in those records remain applicable.
Their original text is retained as a historical decision record, not as a
claim that withdrawn sources or routes still exist.

## Verification

Run `pnpm check`, `pnpm build` and `pnpm eval`. The withdrawal regression checks
source inventory, navigation and historical capture labels. Against the built
server, verify that the removed page and APIs return HTTP 404, while `/` and
`/replay` load. `git grep -i fsc` may find only this withdrawal decision,
historical notes/captures and schema-name references (plus incidental binary
font bytes, which are not data references).
