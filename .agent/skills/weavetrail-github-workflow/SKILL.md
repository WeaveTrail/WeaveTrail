---
name: weavetrail-github-workflow
description: Prepare or execute an explicitly requested WeaveTrail GitHub stage—branch, commit, pull request, review update, or merge—while preserving issue linkage, validation evidence, and private-to-public boundaries.
---

# WeaveTrail GitHub Workflow

Handle only the GitHub stage the user requested. Read `AGENTS.md`,
`CONTRIBUTING.md`, the linked issue, and the applicable GitHub template before
acting.

## Conventions

- Issue title: `<type>: <lowercase summary>`.
- Pull request title: repeat the linked issue title verbatim, with no scope,
  trailing `#<number>`, or paraphrase.
- Branch: `<type><issue-number>/<short-kebab-summary>`.
- Commit: `<type>(<scope>): <summary> #<issue-number>`.
- Preserve unrelated work and stage explicit paths only.
- Record only checks actually run as `PASS`, `FAIL`, or `SKIP`.
- A user-visible contract change includes docs in the same pull request.
- Write multiline GitHub bodies (issues, pull requests, and review replies) to
  files with actual newlines, then pass them with `--body-file` or
  `-F body=@file`. Do not put escape sequences such as `\n` in shell strings;
  `-f` sends values literally rather than interpreting them.
- Read each published body back from GitHub, verify its rendered structure,
  and report only what that check confirms.
- Rely on the repository's automatic review instead of posting a duplicate
  trigger comment. Start a review reply with `[result]` and a one-sentence work
  summary. Follow it with `in commit: <commit_hash>`, then two to four short
  bullets covering problem, work, and resolution. Do not add a separate
  `Summary` heading. Resolve threads only when the task explicitly includes
  resolution.

## Safety and authorization

Do not create an issue, push, open or update a pull request, reply to reviews,
merge, or delete a branch unless that remote mutation is explicitly requested.
Never publish `_workbench` content, private names or IDs, application strategy,
deadlines, career framing, real data, secrets, or unverified claims. Stop if a
linked public issue is missing when the requested repository convention
requires one.
