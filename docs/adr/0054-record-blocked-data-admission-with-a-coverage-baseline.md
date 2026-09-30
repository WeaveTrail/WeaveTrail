# ADR 0054: Record blocked data admission with a coverage baseline

## Status

Accepted. Partially superseded by
[ADR 0055](0055-admit-display-only-published-data-to-the-service-tier.md),
which admits display-only data to the service tier without a redistribution
right.

## Context

Broadening the admitted stock and index inventory requires permission to store,
modify and redistribute each source. The current FSC distributions and KRX
website terms do not grant those rights for the proposed acquisitions. A public
URL, a previous acquisition's permission record or a service snapshot does not
authorize a new collection. The claim endpoint currently performs structured
coverage preflight without numeric definitions.

## Decision

Record the checked source URLs, review date and failed prerequisites in an
[admission review](../PUBLISHED_DATA_ADMISSION.md). Keep rejected candidates
outside the acquisition-derived manifest, and preserve existing immutable
acquisition records.

Commit a separate versioned evaluation of authored structured requests. Compare
the five baseline dataset identities with the current admitted manifest, pin
both manifest hashes and record exact `UNCONFIRMABLE` counts by reason. Use the
same empty definition registry as the public endpoint. These observations do not
represent sentence grades, text-extraction performance or a coverage improvement.
The publication test fails on disagreement with the committed summary, even
under snapshot update mode. Record the actual environment outside that summary,
following [ADR 0053](0053-publish-fixture-evaluations-with-separate-run-receipts.md).

Use an initial review budget of 16 MiB (16,777,216 uncompressed bytes) per new
dataset, including original responses, generated rows, JSONL and acquisition
metadata. This is a repository maintenance choice, not a benchmark or a provider
limit: retained evidence duplicates data in several representations. Measure all
those representations before staging a permitted source, and record the files,
sizes and hashes. Do not trim a declared complete series to fit. A larger dataset
remains outside verification coverage pending service-tier admission, which still
requires independently reviewed storage, modification and redistribution rights.
The evaluation reports the bound; it is not an acquisition or transport guard.

## Consequences

Permission-blocked work has a reproducible baseline and an explicit reopening
condition. A future admission needs its own permission evidence, byte inventory,
offline reproduction and a newly reviewed evaluation version. The current
evaluation truthfully reports no change. Existing rules, source bytes, hashes
and the public coverage contract remain unchanged. Purchasing access or moving
data to the service tier cannot by itself supply the missing redistribution right.
