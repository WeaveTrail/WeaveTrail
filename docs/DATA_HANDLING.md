# Data handling

[한국어](DATA_HANDLING.ko.md)

This page is for a security or compliance reviewer deciding whether staff may
use the check. It states what leaves the browser, what the server does with
it, what is kept and for how long, and which file or test enforces each
statement. It describes this repository revision; planned work is marked
planned and links to its issue. The `/data-handling` page links each file at
the commit its deployment was built from (`VERCEL_GIT_COMMIT_SHA`), and at
`develop` in a build without one
([`source-revision.ts`](../apps/web/src/app/data-handling/source-revision.ts)).

## At a glance

| Question                            | Today                                                                                                                                             | Enforced by                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does any route accept pasted text?  | No. The only check route takes a structured scope, not free text. Pasted-text checking is planned.                                                | [`api/check/coverage/route.ts`](../apps/web/src/app/api/check/coverage/route.ts), [`ClaimCoverageRequestSchema`](../packages/contracts/src/coverage.ts) |
| Is a check request stored?          | No. A check route loads no store, database or file writer.                                                                                        | [`pasted-text-retention.test.ts`](../apps/web/src/app/api/check/pasted-text-retention.test.ts)                                                          |
| Is a check request logged?          | The application writes nothing from a check request to a log, stream or file. Hosting-platform logs are outside the code.                         | [`pasted-text-retention.test.ts`](../apps/web/src/app/api/check/pasted-text-retention.test.ts)                                                          |
| Does a check call a model?          | No. A check route loads no model provider and sends no outbound request.                                                                          | [`pasted-text-retention.test.ts`](../apps/web/src/app/api/check/pasted-text-retention.test.ts)                                                          |
| Where does the browser send data?   | The site's code sends request data only to this site's own `/api/` routes. Following a source or evidence link opens that site, as any link does. | [`browser-data-boundary.test.ts`](../apps/web/src/app/browser-data-boundary.test.ts)                                                                    |
| What does the browser keep?         | The language choice, under one `localStorage` key.                                                                                                | [`browser-data-boundary.test.ts`](../apps/web/src/app/browser-data-boundary.test.ts), [`language.tsx`](../apps/web/src/app/i18n/language.tsx)           |
| Are model credentials exposed?      | No. Provider settings are read on the server only, and production runs without them.                                                              | [`provider-client-boundary.test.ts`](../apps/web/src/app/provider-client-boundary.test.ts), [deployment environment](DEPLOYMENT.md#environment)         |
| How does a share link carry values? | Planned: a URL fragment, with no server storage of pasted text.                                                                                   | [#159](https://github.com/WeaveTrail/WeaveTrail/issues/159), [ADR 0050](adr/0050-place-planned-service-components.md)                                   |

## Request path of a check

`POST /api/check/coverage` is the only route under `/api/check`. It receives a
JSON scope: a canonical instrument ID, an inclusive date window, a publisher
field, a resolution and an optional definition ID and version. The
[route](../apps/web/src/app/api/check/coverage/route.ts) validates it against
the strict
[`ClaimCoverageRequestSchema`](../packages/contracts/src/coverage.ts); an extra
field, a malformed body or invalid JSON returns HTTP 422 `REVIEW_REQUIRED`
without further processing
([`route.test.ts`](../apps/web/src/app/api/check/coverage/route.test.ts)).

A valid scope is compared by
[`checkPublishedClaimCoverage`](../apps/web/src/lib/published-claim-coverage.ts)
with the coverage manifest derived from committed files when the server starts
([published check coverage](COVERAGE.md)). The response returns the validated
scope, a closed reason code and its Korean and English explanation to the
caller. Nothing is fetched, and the request is discarded when the response is
sent. No screen calls this route yet.

Extracting claims from pasted text
([#155](https://github.com/WeaveTrail/WeaveTrail/issues/155)), checking them
([#154](https://github.com/WeaveTrail/WeaveTrail/issues/154)) and the
sentence-by-sentence screen
([#157](https://github.com/WeaveTrail/WeaveTrail/issues/157)) are planned.

## Model call

No check route calls a model.
[`pasted-text-retention.test.ts`](../apps/web/src/app/api/check/pasted-text-retention.test.ts)
walks every module a check route loads and fails if one comes from the model
provider package or calls `fetch`. At run time it also fails if the route makes
an outbound request.

The only route that can call a model is `/api/mapping`, used in working mode
for field mapping. It accepts only the name of a committed synthetic source,
never text a person typed
([`mapping/route.ts`](../apps/web/src/app/api/mapping/route.ts),
[`mapping-provider.ts`](../apps/web/src/lib/mapping-provider.ts)). Production
runs it in fixture mode without provider settings, and those settings never
reach the browser ([deployment environment](DEPLOYMENT.md#environment),
[`provider-client-boundary.test.ts`](../apps/web/src/app/provider-client-boundary.test.ts)).

Planned pasted-text extraction will send text to a model provider
([#155](https://github.com/WeaveTrail/WeaveTrail/issues/155)), under bounds that
[#231](https://github.com/WeaveTrail/WeaveTrail/issues/231) will set. Adding a
provider to a check route fails the retention test until its allowlist and
this page change together.

## Retention

A check request is kept nowhere. The deployment has no database
([deployment](DEPLOYMENT.md)). The retention test fails if a check route loads
the service snapshot store, a file system or any other package outside its
allowlist (`zod`, `node:crypto`, `next/server`), and if calling the route writes
to a file. The service snapshot store holds admitted public-source bytes only,
is not connected to the deployment, and is outside a check route's reach
([service snapshots](SERVICE_SNAPSHOTS.md)).

In the browser, the site's code stores only the language choice under the
`localStorage` key `weavetrail.language`
([`browser-data-boundary.test.ts`](../apps/web/src/app/browser-data-boundary.test.ts)).

## Logs

A check route contains no `console`, `process.stdout`, `process.stderr` or file
write call, and none is reachable from the modules it loads. The retention test
checks this in the source, then calls each route with a marker string in every
free-text field and fails if the marker reaches the console, standard output
or standard error.

The hosting platform keeps its own request logs, such as path, status and
time, under the hosting account's retention settings. Those settings are not in
this repository, so this page cannot verify them from source; confirm them with
the operator.

## Share link

Planned. A share link will carry its values in the URL fragment (the part after
`#`), which browsers do not send to the server. Reopening it resolves pinned
committed artifacts and reruns the engine, with no server storage of pasted
text ([#159](https://github.com/WeaveTrail/WeaveTrail/issues/159),
[ADR 0050](adr/0050-place-planned-service-components.md)). Sharing collected
service snapshots is separate planned work
([#237](https://github.com/WeaveTrail/WeaveTrail/issues/237)).

## Verification

```bash
pnpm exec vitest run apps/web/src/app/api/check/pasted-text-retention.test.ts apps/web/src/app/api/check/coverage/route.test.ts apps/web/src/app/browser-data-boundary.test.ts apps/web/src/app/provider-client-boundary.test.ts apps/web/src/app/data-handling/source-revision.test.ts
```

Every route file under `apps/web/src/app/api/check` is found automatically. A
new check route fails the retention test until it is given a marker request.

## Limits

- The tests check this repository's source. They do not inspect a deployed
  build or the hosting account.
- The source checks match call patterns. Indirect calls that avoid those
  patterns are caught only at run time, for the marker requests the test sends.
- Browser extensions, networks and devices between a person and the site are
  outside the site's code.
