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

## Safety and authorization

Do not create an issue, push, open or update a pull request, reply to reviews,
merge, or delete a branch unless that remote mutation is explicitly requested.
Never publish `_workbench` content, private names or IDs, application strategy,
deadlines, career framing, real data, secrets, or unverified claims. Stop if a
linked public issue is missing when the requested repository convention
requires one.
