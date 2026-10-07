---
name: Git Workflow
description: Manage this repository's Git workflow, version bumps, commits, tags, remotes, and pushes with explicit user approval gates.
---

# Git workflow for Companion for Kimai

Use this skill for Git operations and release/version decisions in this repository.

## Mandatory approval gates

1. **Commit:** Before creating any commit, ask the user whether they want a commit for the current changes. Wait for an explicit yes. A request to implement, version, or prepare changes is not commit approval. If declined or unanswered, leave the changes uncommitted.
2. **Commit language:** Write every commit message in English, using a concise conventional format (e.g. `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`). Never write commit messages in any other language.
3. **Plugin version:** Ask whether the user wants to bump the extension version for the current change set before changing any version field. Do not infer a bump from a code change. If approved, propose the version level and update `package.json`, `manifest.json`, `manifest/chrome.json`, `manifest/firefox.json`, and `CHANGELOG.md` consistently.
3. **Push:** Never push a branch by default. Push a branch only after the user explicitly confirms the exact push (remote and branch). The user has pre-authorized one release-specific exception: after they approve a plugin version bump and the corresponding commit, create and push only the matching `vX.Y.Z` release tag to `origin`.

Ask about a version bump and a commit separately, using clear questions. The approved version bump plus approved version commit authorize only the matching release-tag push described above; they do not authorize a branch push or any other tag. Ask separately for any other push.

## Safe repository workflow

- Start with `git status --short --branch`, `git remote -v`, and inspect the relevant diff. Preserve user changes and avoid staging unrelated files.
- Before a commit, run `npm run check:sensitive` and the applicable project checks, review the staged diff, and ask the mandatory commit question if it has not already been answered for this exact change set.
- Use focused staging. Never amend, reset, rebase destructively, or force-push without first explaining the impact and receiving explicit approval.
- Before publishing, verify the current branch, remote URL, upstream, and commit range. If the remote has commits not present locally, stop and resolve the divergence without overwriting remote history.
- For a release tag, verify all package/manifest versions match, the changelog section exists, checks/build pass, the version commit is at HEAD, and the matching tag does not already exist locally or remotely. If it exists or the remote diverges, stop and ask; never move or force-update a tag.
- A configured remote only connects the local repository; it is not permission to fetch private data, commit, or publish. Fetch only when relevant, and follow the push rules above.

## Release checklist

- Ask whether to bump the plugin version. If approved, use the project's release convention and keep all four manifest/package versions synchronized.
- Update the current changelog entry and run `npm run check:sensitive`, `npm run check`, `npm test`, and `npm run build`.
- Ask separately whether to create a commit. Do not create one without an explicit yes.
- After explicit approval of both the version bump and its commit, create an annotated `vX.Y.Z` tag on that commit and push only that tag to `origin` to trigger the GitHub Release workflow. Do not push the branch unless separately confirmed.
- If the user declines the version commit, do not create or push a release tag. Report the local changes and leave them uncommitted.
