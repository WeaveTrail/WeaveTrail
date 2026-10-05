# ADR 0055: Admit display-only published data to the service tier

> Historical decision: source-dependent portions are superseded by
> [ADR 0056](0056-withdraw-the-committed-real-data-tier.md). The original
> account below describes the withdrawn tier. Generic contracts, synthetic
> behavior and provenance safeguards remain applicable.

- Status: Partially superseded by ADR 0056 (committed sources and composition)
- Date: 2026-09-30
- Partially supersedes [ADR 0046](0046-retain-public-sources-in-two-provenance-tiers.md)
  and [ADR 0054](0054-record-blocked-data-admission-with-a-coverage-baseline.md)
  where they require a redistribution right for service-tier admission.

## Context

Checking a claim about any listed stock or major index needs the complete FSC
daily stock and index quotation distributions. Both carry KOGL type 4 and
prohibit unauthorized third-party provision and redistribution. The service
tier contract admits only sources whose permission covers storage,
modification and redistribution, so the data had no admissible home.

On 2026-09-30 the project received a written answer from the Korea Exchange
data division to an inquiry naming the FSC stock quotation
(`금융위원회_주식시세정보`) and index quotation (`금융위원회_지수시세정보`)
distributions, for a public, non-commercial claim-checking web service:

- Keeping API responses on a server is permitted, with no retention limit.
- Normalizing their format and computing values such as change rates is
  permitted.
- A non-commercial service without advertising or paid features may display
  quote values and computed results on its web screens, credited to
  「한국거래소 통계정보」.
- Publishing original data, or files containing it, on GitHub or elsewhere is
  third-party provision and redistribution and is not permitted. Offering the
  data in a form users can download or export is treated the same way.
- The permitted non-commercial uses need no separate permission or contract.

## Decision

Add a **display-only** permission grade to the service tier alongside the
existing redistributable grade. A display-only source records storage and
modification rights, no redistribution right, the required on-screen
attribution, a non-commercial condition, and its permission evidence. That
evidence may be a dated written answer from the rights holder naming the
distributions and uses it covers; the operator records the sender, receipt
date and answered scope. The redistributable grade and its existing records
are unchanged.

Display-only data lives only in the server-side snapshot store:

- Original bytes and normalized rows never leave the server. The committed
  verification tier, repository history, CI artifacts, build output and
  browser bundles never contain them.
- A response carries the values its screen shows, with the source
  attribution: values a checked claim cites and values computed from them.
  Screens, briefs and image cards may lay those values out in tables. No
  endpoint returns stored rows in bulk or a data series beyond what the screen
  shows, and no surface offers a download, CSV, JSON or other file export of
  the data.
- A share link carries snapshot and result references, not data values; the
  server renders the shared view.
- WeaveTrail stays free of advertising and paid features while it displays
  display-only data. Any commercial use requires a separate agreement first.

Verification of display-only results runs against the private store: the
operator re-hashes stored original bytes and recomputes. Public evaluation
records for this data carry definitions, counts, reasons and hashes, never
quote values. Goldens and regression fixtures keep using synthetic or
redistributable data.

The collection credential lives on the collection host. It is never
configured in the web deployment, CI or a browser-reachable environment.

## Alternatives

- Keeping the data out of every tier leaves claims about most listed stocks
  permanently unconfirmable, although the rights holder permits the use.
- Fetching at request time without storage breaks the rule that results bind
  immutable inputs, and puts the credential on the web deployment.
- Committing a bounded date range to the repository is redistribution, which
  the answer excludes.

## Consequences

The complete stock and index distributions become admissible to the service
tier for on-screen checking. Implementation needs a versioned snapshot
contract carrying the permission grade, an export boundary with tests on every
response and share surface, attribution on every display, and a persistent
host for the store and collector ([#206](https://github.com/WeaveTrail/WeaveTrail/issues/206)).
None of these exist yet; this record changes no runtime behavior, contract,
hash or golden.

The five committed FSC acquisitions (stock, index and derivatives quotations)
carry the same current restriction on repository redistribution. They move to
the display-only service tier in planned work, and the repository keeps no
original market bytes: public checks and goldens that read them switch to
synthetic data or to the private store. Their recorded acquisition-time
permissions stay with the moved snapshots. The derivatives quotation
distribution has the same rights holder and terms text as the answered stock
and index distributions but was not named in the inquiry, so its display is
confirmed with the rights holder alongside that move. The listing, derivatives
calendar and investor statistics datasets need their own review.
