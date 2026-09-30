# Published data admission review

[한국어](PUBLISHED_DATA_ADMISSION.ko.md)

Review date: **2026-09-29 UTC**. This records source admission prerequisites for
[the coverage expansion](https://github.com/WeaveTrail/WeaveTrail/issues/225).
No new market data, listing, calendar or specification was collected or admitted.
The [coverage manifest](COVERAGE.md) continues to derive only from the five
existing acquisitions. The work to admit every listed stock and a longer major
index window remains blocked by source permissions.

## Source review and out-of-coverage inventory

These are authored review notes with links to the official pages, not copied
publisher artifacts or permission approvals. Conditions can change; reopen the
source and linked terms on the day of any proposed acquisition.

| Proposed dataset                                                                                             | Official source reviewed                                                                                                                                                                                                                                        | Admission result and missing prerequisite                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full KOSPI/KOSDAQ daily stock window ([#226](https://github.com/WeaveTrail/WeaveTrail/issues/226))           | [FSC stock quotations](https://www.data.go.kr/data/15094808/openapi.do), license section and description                                                                                                                                                        | Not admitted. KOGL type 4 prohibits modification; the description also expressly prohibits unauthorized third-party provision and redistribution, irrespective of commercial purpose.                                                                                                     |
| Longer major KOSPI/KOSDAQ index window ([#227](https://github.com/WeaveTrail/WeaveTrail/issues/227))         | [FSC index quotations](https://www.data.go.kr/data/15094807/openapi.do), license section and description                                                                                                                                                        | Not admitted. The same modification and redistribution restrictions apply.                                                                                                                                                                                                                |
| Full dated stock listing to bind identities                                                                  | [FSC KRX listings](https://www.data.go.kr/data/15094775/openapi.do), license section and description                                                                                                                                                            | Not admitted. The same restrictions apply; existing quote-derived identifiers are still a bounded listing.                                                                                                                                                                                |
| Derivatives expiry calendar and specifications ([#228](https://github.com/WeaveTrail/WeaveTrail/issues/228)) | KRX [KOSPI 200 futures](https://open.krx.co.kr/contents/OPN/01/01040201/OPN01040201.jsp), [options](https://open.krx.co.kr/contents/OPN/01/01040202/OPN01040202.jsp) and linked [legal notice](https://info.krx.co.kr/contents/KRX/06/06070200/KRX06070200.jsp) | Not admitted. The notice requires prior consent for copying, transmitting, publishing or distributing KRX services. No reviewed grant allowing retained source bytes, modification and redistribution was established. Product rules alone are not an admitted holiday-adjusted calendar. |
| Published investor-type trading aggregates ([#229](https://github.com/WeaveTrail/WeaveTrail/issues/229))     | KRX [Data Marketplace](https://data.krx.co.kr/contents/MDC/MAIN/main.jspx), investor trading statistics, and the KRX legal notice linked above                                                                                                                  | Not admitted. Published aggregate statistics exist, but no dataset-specific permission satisfying all admission requirements was established. Website availability is not a reuse grant.                                                                                                  |

### Stock and index API handling for a noncommercial service

For a noncommercial web service without advertising or paid features, keep API
responses on the server, normalize their format and calculate values as needed.
Display quotation values and calculated results on web pages with the source
attribution `한국거래소 통계정보`. Do not publish original data or files containing it
through GitHub, user downloads or other exports.

This guidance does not cover downloadable documents or images, or the separate
listing, derivative and investor datasets. Repository and service-snapshot
admission still require redistribution rights. No new dataset was admitted and
the coverage baseline is unchanged.

The FSC stock and index pages show a 2026-09-07 modification date; the listing
page shows 2026-09-23. Those are page metadata, not proof of when any particular
condition changed. The current review does not rewrite the recorded permission
or retrieval dates of existing acquisitions, and does not conclude whether a
later condition applies retroactively. Existing records do not authorize new
retrievals. See [licensing](LICENSING.md) and
[instrument resolution](INSTRUMENT_RESOLUTION.md).

Reopening repository admission requires a reviewed grant explicitly covering
retained original bytes, repository commitment, deterministic modification and
third-party redistribution, with its origin, check time and attribution
requirements. Paid API access or automatic API approval does not itself
establish those rights.
Service-tier storage has the same permission prerequisite under
[the snapshot rules](SERVICE_SNAPSHOTS.md); it cannot bypass these exclusions.

Candidate sizes are **not measured**: acquisition stopped at the permission
prerequisite. No absent dataset is classified as too large from an estimate.

## Repository payload budget

The initial review bound is **16 MiB (16,777,216 uncompressed bytes) per new
dataset**. This maintenance budget includes original responses, runtime JSONL,
generated rows, the provenance record, acquisition receipt and complete-series
declaration. Count each retained path once within a dataset. Source code,
documentation, Git history and compression are outside the measurement.

`pnpm eval:coverage` measures those files for existing admitted datasets, records
their byte counts and SHA-256 values, and reports whether each fits the bound.
It performs offline acquisition verification first; it grants no permission and
does not enforce a network or acquisition size limit. For a future permitted
dataset, record the same inventory **before staging it**. A complete series must
not be truncated to fit. Data exceeding the bound remains out of verification
coverage pending [service-tier work](https://github.com/WeaveTrail/WeaveTrail/issues/206)
and a reviewed permission grant. See
[ADR 0054](adr/0054-record-blocked-data-admission-with-a-coverage-baseline.md).

The following existing payload sizes are captured by the evaluation below;
all fit the review bound. They are measurements of committed files, not size
estimates for the blocked candidates.

| Existing dataset   | Retained bytes | Observations / publisher total |
| ------------------ | -------------- | ------------------------------ |
| KOSPI 200 baseline | 84,245         | 45 / 45                        |
| KOSPI 200 futures  | 20,573         | 13 / 13                        |
| KOSPI index family | 61,993         | 32 / 32                        |
| First stock page   | 50,195         | 40 / 943                       |
| Weekly options     | 687,071        | 546 / 546                      |

## Reproducible scope evaluation

```bash
pnpm eval:coverage
```

The [case definition](../packages/evals/src/claim-coverage-cases.ts) fixes twelve
authored structured requests: four observed daily scopes, three missing
instrument probes (one explicitly synthetic), two dates outside recorded windows,
one intraday request and two unadmitted field probes. These are illustrative
checking scopes, not collected user messages or asserted market facts. Canonical
IDs are supplied directly; neither name resolution nor pasted-text extraction
is measured. `expiryDate` and `foreignNetVolume` are illustrative absent fields,
not invented publisher columns or derived rows.

The [runner](../packages/evals/src/claim-coverage-runner.ts) compares the five
baseline dataset IDs against the current manifest, using no numeric definitions,
as in the public coverage endpoint. The
[captured summary](../packages/evals/results/published-claim-coverage-v1.json)
pins both manifest hashes and every retained payload file hash. The command
asserts agreement with that publication and never updates expectations. It also
verifies every existing source offline from its recorded response; no network
access or credential is required. Unit tests reject a missing dataset or a
changed observed scope. CI runs both the assertion and receipt generation.

| Preflight outcome       | Before | After |
| ----------------------- | ------ | ----- |
| `UNCONFIRMABLE` share   | 12/12  | 12/12 |
| `OUTSIDE_COVERAGE`      | 7      | 7     |
| `RESOLUTION_TOO_COARSE` | 1      | 1     |
| `DEFINITION_NOT_BOUND`  | 4      | 4     |

The command writes `dist/coverage-evaluation/summary.json` and `run.json`. The
[captured run receipt](../packages/evals/results/published-claim-coverage-v1.run.json)
records the exact command, checkout fingerprint and actual environment: Node
22.18.0, pnpm 10.33.2, Vitest 5.0.1, Linux x86_64. Environment metadata stays
outside the stable summary.

There is **no measured coverage improvement** because no new dataset is admitted.
These authored sample counts do not estimate a circulating-message failure rate
or sentence evidence-grade share. Even observed daily scopes still lack a bound
numeric definition; a coverage `READY` result alone would not establish
`COMPUTED` or `DIFFERS`. Numeric recomputation and pasted-text checking remain
planned. A future admission must publish a newly reviewed evaluation version
against this fixed baseline instead of rewriting this historical result.
