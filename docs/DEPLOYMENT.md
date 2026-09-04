# Deployment

The public WeaveTrail workbench is designed to run on Vercel in deterministic
fixture mode. It serves only the synthetic scenarios committed to this
repository. No live model provider, provider credential, database, analytics,
telemetry, or third-party script is part of this deployment.

Production is live at
[weave-trail-web-flax.vercel.app](https://weave-trail-web-flax.vercel.app).
The first production deployment uses Git revision `56d76f3` and is owned by the
`jaeundas-projects` Vercel scope. Its connected repository belongs to the
WeaveTrail GitHub organization.

## Vercel project settings

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

## Environment

Set `AI_MODE=fixture` in both Production and Preview. Do not create
`OPENAI_API_KEY`, `OPENAI_MODEL`, or any other provider credential or provider
configuration in either environment.

Vercel supplies the deployment origins used for canonical metadata:

- Preview deployments use `VERCEL_URL`, so their canonical links remain on the
  isolated preview origin.
- Production uses `VERCEL_PROJECT_PRODUCTION_URL`, the stable project domain
  supplied by Vercel.
- `WEAVETRAIL_SITE_URL` is an optional explicit production override for another
  stable HTTPS origin. Leave it unset for the initial Vercel deployment.
- Local builds fall back to `http://localhost:3000`.

Configured origin values must be origins only: no path, query, or fragment. An
invalid value fails the build instead of silently publishing incorrect
canonical metadata.

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

Then use a fresh browser session to load `/`, `/architecture`, `/lab`,
`/evals`, and `/methodology` from the production origin. In `/lab`:

1. Complete one unchanged committed synthetic replay and compare its result
   with the literal golden hash committed for that scenario.
2. Submit the committed rejected mapping path and confirm an HTTP `422`
   response with `status: REVIEW_REQUIRED`, a review workflow state, and no
   replay or canonical result hash.

Inspect the production browser assets, any emitted source maps, and the public
build log. Search for `OPENAI`, recognizable API-key patterns, and distinctive
content from the submitted request. Promotion stops if any credential, request
body, raw model trace, canonical event, or `rawRowHash` is present. Record the
search terms and results without copying a secret into the record.

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
4. Repeat the five-route fresh-browser smoke check and both lab checks.
5. Record the restored SHA, immutable deployment URL, time, check results, and
   whether any check was skipped.

If no prior known-good production deployment exists, do not claim rollback was
tested. Disable external sharing of the failed first deployment, correct the
problem on a new reviewed commit, and promote only after the full gate passes.
