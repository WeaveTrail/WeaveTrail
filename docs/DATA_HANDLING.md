# Data handling

[한국어](DATA_HANDLING.ko.md)

## Current routes

No route accepts pasted text for checking. Published coverage and case endpoints have been withdrawn and return 404. `/api/mapping` accepts a registered synthetic scenario name; `/api/replay` accepts its unchanged rows, approvals and optional case manifest.

The `/data-handling` page links evidence at the deployment revision, or `develop` when no revision is supplied.

## Reviewer text

Case Replay sends a reviewer reference and nonblank override reasons to `/api/replay`. Approval records are validated to bind the exact proposal; responses do not return the reference or reasons. Fixture-mode approval requests are neither persisted, logged nor sent to a model. Type no personal or confidential text there.

The retention test posts approved and rejected canary requests to the replay route and inspects its module graph for storage and log writes. Every API route is either given such requests or listed as taking no typed text, so a new route fails the test until it is one or the other.

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
validates `REVIEW_REQUIRED` responses and selects English/Korean budget guidance
from a stable reason code. Other validated issues retain their message; invalid
responses use the localized generic failure message.

### Mapping budget denial codes

A budget denial remains HTTP 422 with `status: REVIEW_REQUIRED`,
`workflowState: MAPPING_REVIEW_REQUIRED`, and issue code
`MAPPING_APPLICATION_REVIEW_REQUIRED`. Its issue now carries optional
`budgetReason` alongside `path` and the English `message`:

| `budgetReason`        | Meaning                                                         |
| --------------------- | --------------------------------------------------------------- |
| `VISITOR_DAILY_LIMIT` | The visitor's daily request cap is exhausted                    |
| `GLOBAL_DAILY_LIMIT`  | The shared daily reserved-call cap is exhausted                 |
| `BUDGET_UNAVAILABLE`  | Configuration, trusted identity or store checks are unavailable |

Only these three codes on mapping application review issues are accepted.
Unknown codes or metadata on another issue/state fail validation. The client
keeps the validated response and selects translated guidance at render time,
so changing language also updates an already displayed denial. Machine tokens
such as `REVIEW_REQUIRED` retain one spelling.

Migration: updated consumers accept prior responses without `budgetReason` and
continue to use their `message`. Deploy the updated contract and client together
with the server: older strict parsers reject the additional field. Successful
mapping proposals, receipts, approvals and canonical replay hashes are unchanged.

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
pnpm exec vitest run apps/web/src/app/api/reviewer-text-retention.test.ts apps/web/src/app/browser-data-boundary.test.ts apps/web/src/app/provider-client-boundary.test.ts apps/web/src/app/data-handling/source-revision.test.ts apps/web/src/lib/public-model-budget.test.ts apps/web/src/app/api/mapping/route.test.ts
```

## Limits

These checks cover repository code and fixture requests, not hosting account settings, browser extensions or identity authentication. They establish no audit-grade human identity.
