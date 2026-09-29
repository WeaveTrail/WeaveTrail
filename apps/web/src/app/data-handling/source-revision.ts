/**
 * The commit a deployment was built from, so evidence links open the code the
 * page describes. Vercel sets `VERCEL_GIT_COMMIT_SHA` for a Git deployment; a
 * local or unrecognised build links the integration branch instead.
 */
export const UNPINNED_REVISION = "develop";

export function sourceRevision(
  commit = process.env.VERCEL_GIT_COMMIT_SHA,
): string {
  return commit && /^[0-9a-f]{40}$/.test(commit) ? commit : UNPINNED_REVISION;
}
