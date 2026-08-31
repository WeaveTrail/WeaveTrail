---
name: weavetrail-github-workflow
description: Prepare or execute an explicitly requested WeaveTrail GitHub stage—branch, commit, pull request, review update, or merge—while preserving issue linkage, validation evidence, and private-to-public boundaries.
---

# WeaveTrail GitHub Workflow

Handle only the GitHub stage the user requested. Read `AGENTS.md`,
`CONTRIBUTING.md`, the linked issue, and the applicable GitHub template before
acting.

## Conventions

- Issue and pull request title: `Type: lowercase summary`.
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

## Safety and authorization

Do not create an issue, push, open or update a pull request, reply to reviews,
merge, or delete a branch unless that remote mutation is explicitly requested.
Never publish `_workbench` content, private names or IDs, application strategy,
deadlines, career framing, real data, secrets, or unverified claims. Stop if a
linked public issue is missing when the requested repository convention
requires one.
