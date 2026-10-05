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

## Storage and planned features

The web app uses no database or service snapshot store. Request workflow state lasts one request; browser approvals and results last only the mounted view. Refresh starts unapproved. Pasted-text extraction, checking, durable audit history and sharing remain planned. No private store or host is added for withdrawn data.

## Verification

```bash
pnpm exec vitest run apps/web/src/app/api/check/pasted-text-retention.test.ts apps/web/src/app/browser-data-boundary.test.ts apps/web/src/app/provider-client-boundary.test.ts apps/web/src/app/data-handling/source-revision.test.ts
```

## Limits

These checks cover repository code and fixture requests, not hosting account settings, browser extensions or identity authentication. They establish no audit-grade human identity.
