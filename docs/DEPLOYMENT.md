# Deployment

The public WeaveTrail workbench is designed to run on Vercel in deterministic
fixture mode. This checkout serves committed synthetic scenarios and a licensed
published daily quotation artifact; it never retrieves source data at runtime.
No provider credential, database, analytics,
telemetry, or third-party script is part of the current deployment.

Production is live at
[weave-trail-web-flax.vercel.app](https://weave-trail-web-flax.vercel.app).
The first production deployment uses Git revision
`56d76f3597de36db68af344843854bbd58fc416b` and is owned by the
`jaeundas-projects` Vercel scope. Its connected repository belongs to the
WeaveTrail GitHub organization.

## Vercel project settings

This checkout names the core surface **Case Replay** at `/replay`, which opens
the guided walkthrough; `/replay?mode=guided` names it explicitly and
`/replay?mode=working` selects working mode. The former `/lab` route has no
alias and returns not found. Verify the promoted revision before expecting the
new route on production; this documentation does not confirm its deployment.

Import the repository as one Vercel project with these settings:

| Setting           | Value                                              |
| ----------------- | -------------------------------------------------- |
| Framework preset  | Next.js                                            |
| Root directory    | `apps/web`                                         |
| Install command   | Vercel default (`pnpm install` for this workspace) |
| Build command     | Vercel default (`npm run build` or `next build`)   |
| Output directory  | Next.js default (`.next`); do not override         |
| Node.js version   | 24.x                                               |
| Production branch | `main`                                             |
| Pull requests     | Isolated preview deployment for each pull request  |

The project uses the dashboard defaults for install and build. Vercel detects
pnpm from the root `packageManager` declaration and installs the workspace even
though the selected application root is `apps/web`. Keep access to source files
outside that root enabled because the web app imports packages from
`packages/`. The existing Git integration is the deployment trigger:
production follows `main`, and pull requests receive isolated previews. This
repository does not duplicate that trigger with a deployment workflow.

The published quotation flow also requires verification at the promoted revision;
this document does not claim that the current checkout has been deployed.

## Environment

Fixture mode is the default. The checkout supports an explicitly selected
server-only mapping adapter for the two synthetic source dialects; no live
provider or configured deployment is validated by the mocked transport tests.
Page preparation and builds never call the provider. Its configuration is:

| Environment | Provider used today | Provider variables                                    |
| ----------- | ------------------- | ----------------------------------------------------- |
| Local       | Fixture by default  | May opt in explicitly for a manual configured request |
| CI          | Fixture             | Unset                                                 |
| Preview     | Fixture             | Unset                                                 |
| Production  | Fixture             | Unset                                                 |

The adapter reads these binding configuration names only on the server:

| Variable               | Meaning                                                          | Boundary                                                                              |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `AI_MODE`              | `fixture` (the default) or `ai`                                  | Server-only selection; the presence of the other variables does not select a provider |
| `AI_PROVIDER_BASE_URL` | HTTPS origin for an OpenAI-compatible structured-output endpoint | Server-only; never public-prefixed or sent to the browser                             |
| `AI_PROVIDER_API_KEY`  | Credential for that endpoint                                     | Secret, server-only; never public-prefixed, logged, or sent to the browser            |
| `AI_PROVIDER_MODEL`    | Provider model identifier                                        | Server-only configuration; never public-prefixed or sent to the browser               |

Do not create a `NEXT_PUBLIC_` variant of any of them. Leave all four unset in
CI, Preview, and Production. A future deployment may opt into `AI_MODE=ai` only as
an explicit environment choice; merely making provider configuration available
must leave the default fixture reviewer path and its published expected results
unchanged.

Migration from the old reserved names requires no runtime compatibility:
`OPENAI_API_KEY` and `OPENAI_MODEL` were never read. Remove them from local
templates and use the `AI_PROVIDER_*` names above for local adapter configuration.
Do not add either the old or new names to a deployed environment in this change.

For a local configured request, set the selector and all three provider values
in the server environment, run `pnpm dev`, open working mode, choose Dialect A
or B, and select **Request mapping proposal**. The base URL must be an HTTPS
origin with no credentials, path, query or fragment. The adapter appends
`/v1/chat/completions` and requires strict JSON-schema structured output.
No call happens on page load. A successful, validated response reveals its
actual **Configured provider** label and enables explicit mapping approval.
Provider mode is recorded with the model identifier and prompt version on the
server; the model identifier is encrypted in the opaque receipt and never
exposed as public configuration. See [ADR 0029](adr/0029-bind-configured-mapping-proposals-to-review.md)
for sample limits, eligibility and receipt expiry. The public endpoint has no
identity or spending controls yet; implement those before exposing configured
mode in a shared deployment.

`DATA_GO_KR_SERVICE_KEY` is a separate retrieval credential. The manual local
retrieval script reads it once before an admitted artifact is committed; the
application and CI do not read it. Never configure it in CI, Preview, or
Production because deployed code consumes the committed artifact and must not
retrieve it again.

### Proposal and result boundary

A provider can change only which mapping it proposes. It cannot approve a
mapping, modify source events, run replay rules, or determine a result. Provider
output remains untrusted until the strict mapping contract accepts it and a
reviewer explicitly approves it. The approved mapping—not provider mode, raw
provider output, or a credential—is the mapping input to the canonical replay
and its canonical result hash.

The fixture path remains the deterministic default, even if provider variables
are present. Provider status is
reported as **fixture provider** for a fixture proposal and **configured
provider** for an accepted configured proposal. Configuration presence alone
must never produce the configured-provider label or a claim of live
integration.

Failure behavior is closed and observable:

- With no configured provider selected, use the registered deterministic
  fixture proposal.
- If `AI_MODE=ai` is selected but configuration is incomplete, or the provider
  call fails, return `REVIEW_REQUIRED` without an approval, replay, or canonical
  result hash. Do not silently relabel a fixture proposal as configured output.
- If a response fails the strict mapping contract or is ambiguous, reject it as
  `REVIEW_REQUIRED` without an approval, replay, or canonical result hash.
- For ineligible artifacts, use the registered fixture mapping without reading
  credentials or calling the endpoint, even when configured mode is selected.
- An unknown explicit selector, invalid HTTPS origin, refused or truncated
  response, or missing/expired/tampered receipt also stops at `REVIEW_REQUIRED`.
  No error response includes configuration or raw provider output.

Vercel supplies the deployment origins used for canonical metadata:

- Preview deployments use `VERCEL_URL`, so their canonical links remain on the
  isolated preview origin.
- Production uses `VERCEL_PROJECT_PRODUCTION_URL`, the stable project domain
  supplied by Vercel.
- `WEAVETRAIL_SITE_URL` is an optional explicit production override for another
  stable HTTPS origin. Leave it unset for the initial Vercel deployment.
- Local builds fall back to `http://localhost:3000`.

Configured origin values must be origins only: no credentials, path, query, or
fragment. An invalid value fails the build instead of silently publishing
incorrect canonical metadata or credentials.

## Promotion gate

Promote only a CI-green commit on `main`. Record its full Git commit SHA and
the resulting production deployment URL before running the checks below. A
preview that cannot be rebuilt from the settings above is not promotion
evidence.

Run the repository checks on that exact revision:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
```

Then use a fresh browser session to load `/`, `/why`, `/architecture`,
`/replay`, `/evals`, and `/methodology` from the production origin. In `/replay`:

1. From `/`, select **Walk through a case**. Read the supported source, exercise
   the separate Dialect B review stop, supply its justified reason, and approve
   the worked case's own mapping and manifest. Run it, open source evidence,
   repeat it and compare both returned hashes with the committed golden oracle.
   Continue to working mode and confirm the case, approvals and result remain.
   Refresh and confirm approvals and results are cleared. Inspect a narrow
   viewport and keyboard navigation.
2. Submit the committed rejected mapping path and confirm an HTTP `422`
   response with `status: REVIEW_REQUIRED`, a review workflow state, and no
   replay or canonical result hash.

Inspect every production browser asset, any emitted browser source map, and the
complete public build log. This is a disclosure check, not a check that provider
configuration is absent from the server environment. Search all three surfaces
for each exact term below and require zero matches:

| Exact search term or regular expression                                                                         | Expected result                                                                                          |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `AI_MODE`, `AI_PROVIDER_BASE_URL`, `AI_PROVIDER_API_KEY`, `AI_PROVIDER_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL` | No current or retired provider variable name in a browser asset, browser source map, or public build log |
| `DATA_GO_KR_SERVICE_KEY`                                                                                        | No retrieval-credential name in a deployed asset or public build log                                     |
| `Authorization: Bearer` and `authorization\"\s*:\s*\"Bearer`                                                    | No provider authorization header in either text or serialized JSON form                                  |
| `sk-[A-Za-z0-9_-]{20,}` and `Bearer [A-Za-z0-9._-]{20,}`                                                        | No recognizable API-key or bearer-token value                                                            |
| `rawProviderTrace`, `raw_provider_trace`, `providerRequestBody`, `provider_request_body`                        | No raw-trace or request-body field in a public surface                                                   |

For a future configured-provider promotion, also record one
distinctive, non-secret substring from the submitted provider request and one
from the raw provider response, then search for those two exact substrings. Both
must have zero matches in browser assets, browser source maps, and the public
build log. Record only the non-secret search terms and zero-match result; never
copy a credential or raw trace into promotion evidence. Any match stops
promotion. Server configuration may exist for an explicitly configured future
deployment, but credentials, authorization values, raw provider traces, and
provider request bodies may not cross the server boundary.

## Rollback

Rollback is documented but was **not exercised** for the first production
release because only one production deployment exists. There is not yet a
previous known-good deployment to restore.

Before promotion, identify the previous known-good deployment by both its full
Git commit SHA and its immutable Vercel deployment URL. Record whether rollback
was exercised; documentation alone is not evidence that it works.

To roll back without rewriting Git history:

1. Open the Vercel project and select the previous known-good production
   deployment whose Git SHA matches the recorded revision.
2. Use the deployment's rollback action to restore it as production.
3. Confirm the production alias points to that immutable deployment URL.
4. Repeat the five-route fresh-browser smoke check and both Case Replay checks.
5. Record the restored SHA, immutable deployment URL, time, check results, and
   whether any check was skipped.

If no prior known-good production deployment exists, do not claim rollback was
tested. Disable external sharing of the failed first deployment, correct the
problem on a new reviewed commit, and promote only after the full gate passes.
