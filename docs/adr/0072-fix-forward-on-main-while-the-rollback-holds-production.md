# ADR 0072: Fix forward on main while the rollback holds production

- Status: Accepted
- Date: 2026-10-09

## Context

[The deployment document](../DEPLOYMENT.md#rollback) rolls production back by
restoring an earlier Vercel deployment without rewriting Git history, so `main`
still points at the failed commit afterwards. The contribution rules start an
emergency hotfix from an up-to-date `origin/main` and target `main`, and the
Vercel Git integration builds a production deployment for every push to `main`.
Read separately, the two rules leave unclear whether merging a hotfix after a
rollback puts the failed release back in production.

Vercel's Instant Rollback turns off automatic assignment of the production
domains. While the project is in that rolled-back state, new deployments from
`main` are built but not served. The domains move only when a deployment is
promoted, through **Undo Rollback** or `vercel promote`, and that promotion
turns automatic assignment back on. A hotfix branched from `origin/main`
contains the failed release, so promoting the hotfix's deployment promotes the
failed release too, together with the fix.

Two sequences were considered:

1. Revert the failed promotion's merge commit on `main`, then fix forward.
   Reverting a merge records that its commits are already in `main`, so the
   next `develop`-to-`main` promotion silently omits the reverted changes
   unless someone reverts the revert. Carrying that revert into `develop`, as
   the hotfix backport rule requires, would also remove the release's work
   from the integration branch.
2. Keep the restored deployment serving production and fix forward on top of
   `main`. Promote the hotfix deployment only after it passes the promotion
   gate.

## Decision

Use the second sequence.

- After a rollback, `main` keeps the failed commit. The hotfix branch starts
  from that `origin/main` and targets `main`. Its change is either a forward
  fix or a revert of the specific failing pull request's commits, never a
  revert of the promotion merge.
- Merging the hotfix builds a production deployment that Vercel does not
  serve. The restored known-good deployment stays in production.
- That deployment runs the whole [promotion gate](../DEPLOYMENT.md#promotion-gate)
  against its immutable URL. Only after the gate passes is it promoted with
  **Undo Rollback** or `vercel promote`. Promotion moves the production domains
  to it and makes them follow `main` again.
- Production then serves the hotfix commit: the failed release plus the hotfix
  change. It takes the next patch version, under the existing
  [version rules](../DEPLOYMENT.md#versions-and-release-tags), and the change
  is carried into `develop` as for any hotfix.
- Until that promotion, nothing merged into `main` reaches production, an
  ordinary `develop` promotion included. Only a deployment that has passed the
  gate is promoted.

## Consequences

While production is rolled back, a merge into `main` never goes live by
itself, so reviewers can reason about the hotfix without racing the
deployment. In exchange, the gate becomes a manual promotion step: whoever
promotes must pick the gated deployment by its immutable URL rather than the
latest one, because Vercel offers every eligible deployment, including the
failed one. If the failed release can't be repaired quickly, production keeps
serving the restored deployment until a gated fix exists. Rollback has still
not been exercised, so this records the documented path and Vercel's stated
behavior, not an observed recovery.
