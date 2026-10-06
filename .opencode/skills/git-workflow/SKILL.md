---
name: Git Workflow
description: Manage this repository's Git workflow, version bumps, commits, tags, remotes, and pushes with explicit user approval gates.
---

# Git workflow for Companion for Kimai

Use this skill for Git operations and release/version decisions in this repository.

## Mandatory approval gates

1. **Commit:** Before creating any commit, ask the user whether they want a commit for the current changes. Wait for an explicit yes. A request to implement, version, or prepare changes is not commit approval. If declined or unanswered, leave the changes uncommitted.
2. **Plugin version:** Ask whether the user wants to bump the extension version for the current change set before changing any version field. Do not infer a bump from a code change. If approved, propose the version level and update `package.json`, `manifest.json`, `manifest/chrome.json`, `manifest/firefox.json`, and `CHANGELOG.md` consistently.
3. **Push:** Never push by default. Push only after the user explicitly confirms the exact push (remote and branch, and tag if applicable). Approval to commit, configure a remote, or create a version does not authorize a push. Ask again if the target or changes differ from what was confirmed.

Ask about a version bump and a commit separately, using clear questions. When a push is relevant, ask for its confirmation separately as well. Do not treat one yes as approval for the other actions.

## Safe repository workflow

- Start with `git status --short --branch`, `git remote -v`, and inspect the relevant diff. Preserve user changes and avoid staging unrelated files.
- Before a commit, run the applicable checks, review the staged diff, and ask the mandatory commit question if it has not already been answered for this exact change set.
- Use focused staging and a concise commit message. Never amend, reset, rebase destructively, or force-push without first explaining the impact and receiving explicit approval.
- Before publishing, verify the current branch, remote URL, upstream, and commit range. If the remote has commits not present locally, stop and resolve the divergence without overwriting remote history.
- A configured remote only connects the local repository; it is not permission to fetch private data, commit, or publish. Fetch only when relevant, and never push without the push approval gate above.

## Release checklist

- Ask whether to bump the plugin version. If approved, use the project's release convention and keep all four manifest/package versions synchronized.
- Update the current changelog entry and run `npm run check`, `npm test`, and `npm run build`.
- Ask separately whether to create a commit. Do not create one without an explicit yes.
- Ask separately before pushing. Publish only the specifically approved branch/tag to `origin` and report the resulting commit or tag.
