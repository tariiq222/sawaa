# Release & Deploy State — Sawa

This document is the single source of truth for the version-promotion
chain. Read this before merging anything to `main`.

## The promotion chain

```
feature/*  →  develop  →  main  →  release tag  →  production
              ↑           ↑             ↑
              ↑     merge-gate.yml   release.yml
        (PR-time checks) (umbrella) (auto-tag)
```

| Branch | Checks | Workflows | Notes |
|--------|--------|-----------|-------|
| `feature/*` | local lefthook, typecheck, unit | (local) | developer pushes here |
| `develop` | regression-check (full E2E) | `regression-check.yml` | catches cross-cutting breaks the PR-time tests missed |
| `main` (PR) | merge-gate (everything) | `merge-gate.yml` | required by branch protection |
| `main` (post-merge) | release-tag | `release.yml` | creates `vYYYY.MM.DD.{N}` tag + deploy-state record |
| tag | — | — | the "latest deployed" reference for `develop` |
| `develop` (PR to `main`) | merge-gate + deploy-state | `merge-gate.yml` | refuses merge if `develop` is BEHIND latest tag |

## Why this matters

If a teammate force-pushes `develop` or a PR is cherry-picked from a
divergent branch, plain CI will still pass — but the merge target
is effectively behind production. The `check-deploy-state.mjs` step
in `merge-gate.yml` catches that: the merge base of `develop` HEAD
must equal the most recent `v*` tag on `main`. If not, the gate
fails with a clear error and the developer must rebase or pull.

## Workflows in this directory

| File | Triggers | Purpose | Required? |
|------|----------|---------|-----------|
| `ci.yml` | push/PR to main+develop | unit tests + typecheck + lint + smoke e2e | Yes (PR-time) |
| `merge-gate.yml` | PR to main, push to main | umbrella gate — must be green to merge | **Yes (block merge)** |
| `regression-check.yml` | push to develop | full backend e2e + dashboard smoke after merge | Recommended |
| `release.yml` | push to main (post-merge) | auto-tag + deploy-state record | Auto |
| `nightly-e2e.yml` | nightly 02:00 UTC | full Playwright flows suite | Periodic |
| `codeql.yml` | push/PR, weekly | GitHub-native SAST | Auto |

## Branch protection — apply in GitHub UI (Settings → Branches → main)

These rules must be configured manually in the GitHub UI; they are
not in the repo because GitHub requires admin permissions to set
them.

- [x] **Require a pull request before merging**
- [x] **Require approvals**: 1 (configurable to 2 for production-critical changes)
- [x] **Dismiss stale pull request approvals when new commits are pushed**
- [x] **Require status checks to pass before merging**
  - Required: `merge-gate / gate`
  - Required: `ci / backend`
  - Required: `ci / dashboard`
  - Required: `ci / website`
  - Required: `ci / security`
- [x] **Require conversation resolution before merging**
- [x] **Require linear history** (no merge commits on `main`)
- [x] **Do not allow force pushes**
- [x] **Do not allow deletions**

For `develop`:
- [x] Same as above except:
  - Required: `ci / backend`, `ci / dashboard`, `ci / website`, `ci / security`
  - **Not** required: `merge-gate / gate` (develop can land partial work; main enforces)

## "Skip release" pattern

To merge a CI-only or docs-only change without creating a tag, include
`[skip release]` in the commit subject when merging to main. Example:

```
[ci] bump openapi snapshot  [skip release]
```

The `release.yml` workflow detects this and skips the tag. The
deploy-state file is still updated to point at the new main HEAD so
the merge-gate doesn't fail on the next PR.

## Rollback

If a release is bad:

1. Identify the last good tag with `git tag --sort=-version:refname | head -5`
2. `git revert <bad-commit>` on `main` (preferred — preserves history)
3. Merge the revert PR through `merge-gate` (deploy-state check
   naturally validates since the revert is on top of the last tag)
4. `release.yml` will create a new tag like `v2026.07.30.3` with the
   revert, so the deploy state is forward-only

If the bad commit already shipped and you need an immediate fix:
1. `git push origin main --force-with-lease` is **not** allowed —
   branch protection forbids force pushes
2. Cherry-pick the fix from `develop` to `main` directly via the
   GitHub UI (creates a new commit, no force-push)
3. Or hotfix-branch off the tag: `git checkout v2026.07.30.2 -b
   hotfix/x`, commit fix, PR back to main