# Data handling

[한국어](DATA_HANDLING.ko.md)

## Current routes

No route accepts pasted text for checking. Published coverage and case endpoints have been withdrawn and return 404. `/api/mapping` accepts a registered synthetic scenario name; `/api/replay` accepts its unchanged rows, approvals and optional case manifest.

The `/data-handling` page links evidence at the deployment revision, or `develop` when no revision is supplied.

## Reviewer text

Case Replay sends a reviewer reference and nonblank override reasons to `/api/replay`. Approval records are validated to bind the exact proposal; responses do not return the reference or reasons. Fixture-mode approval requests are neither persisted, logged nor sent to a model. Type no personal or confidential text there.

The retention test posts approved and rejected canary requests to the remaining synthetic replay route and inspects its module graph for storage and log writes.

## Provider and browser boundary

Only the mapping route can call a configured provider. It sends eligible synthetic source fields and samples, never reviewer text. Production uses fixture mode without provider credentials. Credentials and raw traces remain server-only.

Browser code sends request data only to the site API and retains only the language choice in `localStorage`. It adds no third-party script. Following an external source link is navigation. Platform request logs remain controlled by the hosting account.

## Storage and features not planned

Fixture mode uses no database or service snapshot store. Configured public model requests use only the daily budget store described below. Request workflow state lasts one request; browser approvals and results last only the mounted view. Refresh starts unapproved. Pasted-text extraction and checking and share links are not in the current plan, and durable audit history is not implemented. No private store or host is added for withdrawn data.

The mapping route requires `Content-Type: application/json` (an optional
charset is accepted). If a browser supplies an Origin header, it must match
the request URL's origin; foreign or opaque origins and safelisted form/text
content types fail before budget reservation. Requests without Origin still
require JSON, so a cross-origin browser must preflight. The Case Replay screen
validates `REVIEW_REQUIRED` responses and shows their issue messages, including
quota exhaustion or an unavailable store; invalid responses use the generic
failure message.

## Daily live model counters

Before a public live model request, the server checks a hosted Redis store
shared by Vercel functions. It stores a daily visitor key (HMAC-SHA-256 of the
platform IP and KST day using a server secret), that visitor's request count,
and one global reserved-call count. The application never stores or logs the
raw IP, and sends no IP, reviewer text, source rows or model output to Redis.
Keys and counts expire at the next 00:00 KST, at most 24 hours after creation;
the HMAC changes each day. These are pseudonymous budget counters, not accounts
or proof of a person's identity. People behind one IP share a visitor limit.

The visitor default is 15 requests per day. The operator must set the global
call cap. One direct proposal reserves one request and one call; a future
routed proposal must use the common two-call boundary, reserving one visitor
request and two global calls. Failed and unused reserved attempts are not
refunded. Routing and the mutation demo are not implemented yet.

Exceeding either cap, an unavailable store, missing configuration or missing
trusted platform IP prevents the model call and returns `REVIEW_REQUIRED` with
a fixed explanation. Fixture and recorded receipt replay make no budget-store
or model call. Manual local evaluations bypass this web-only limiter. Hosting
and Redis account logs, backups and retention settings are operator-controlled;
key expiry does not verify their deletion. Do not enable key/request-body
logging or retain counter backups beyond the KST day. See
[deployment configuration](DEPLOYMENT.md#daily-public-model-budget) and
[ADR 0063](adr/0063-reserve-public-model-budgets-in-shared-daily-counters.md).

## Verification

```bash
pnpm exec vitest run apps/web/src/app/api/check/pasted-text-retention.test.ts apps/web/src/app/browser-data-boundary.test.ts apps/web/src/app/provider-client-boundary.test.ts apps/web/src/app/data-handling/source-revision.test.ts apps/web/src/lib/public-model-budget.test.ts apps/web/src/app/api/mapping/route.test.ts
```

## Limits

These checks cover repository code and fixture requests, not hosting account settings, browser extensions or identity authentication. They establish no audit-grade human identity.
