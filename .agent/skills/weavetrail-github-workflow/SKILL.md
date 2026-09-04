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
- Publish every multiline body from a file, never from an inline string. See
  [Publishing multiline bodies](#publishing-multiline-bodies).
- Rely on the repository's automatic review instead of posting a duplicate
  trigger comment. Start a review reply with `[result]` and a one-sentence work
  summary. Follow it with `in commit: <commit_hash>`, then two to four short
  bullets covering problem, work, and resolution. Do not add a separate
  `Summary` heading. Resolve threads only when the task explicitly includes
  resolution.

## Publishing multiline bodies

Issue bodies, pull request bodies, and review replies are multiline Markdown.
Write each body to a file containing real newlines, then hand `gh` that file.

`\n` inside a shell string is not a newline. Single quotes stop the shell from
interpreting it, and `gh` sends `-f` and `-F` values byte for byte, so the body
publishes with a literal backslash and `n` where each line break belonged. This
is the failure to design against; the fix is the file, not a different quoting
trick.

```bash
body_file="$(mktemp)"
cat >"$body_file" <<'EOF'
[Confirmed] one-sentence work summary

in commit: <commit_hash>

- problem
- work
- resolution
EOF

gh issue create --body-file "$body_file"
gh pr create --body-file "$body_file"
gh pr edit <pr-number> --body-file "$body_file"
gh api repos/WeaveTrail/WeaveTrail/pulls/<pr-number>/comments/<comment-id>/replies \
  -F body=@"$body_file"
```

`-F body=@<file>` reads the file; `-f body=...` does not. Build a body with
`printf` rather than `echo -e` when a file is genuinely impossible.

Then read every published body back and confirm no escape sequence survived:

```bash
gh api repos/WeaveTrail/WeaveTrail/pulls/comments/<reply-id> --jq .body |
  grep -n '\\n'
```

A match means the body published escape sequences instead of line breaks.
Rewrite that body from a file before reporting the stage as done. Report only
the rendered structure this read-back confirms.

## Safety and authorization

Do not create an issue, push, open or update a pull request, reply to reviews,
merge, or delete a branch unless that remote mutation is explicitly requested.
Never publish `_workbench` content, private names or IDs, application strategy,
deadlines, career framing, real data, secrets, or unverified claims. Stop if a
linked public issue is missing when the requested repository convention
requires one.
