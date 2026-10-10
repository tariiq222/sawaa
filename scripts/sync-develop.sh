#!/bin/bash
# Keep the local `develop` branch identical to `origin/develop`.
#
# Runs every few minutes from launchd (see scripts/install-develop-sync.sh) and
# can also be run by hand. It only ever fast-forwards and never discards work:
#   - local develop behind origin  -> fast-forward (git refuses if it would
#     overwrite uncommitted changes, in which case nothing changes)
#   - local develop ahead of origin -> leave it; the commits are published
#     through a PR under docs/operations/deployment-policy.md
#   - local develop diverged         -> leave it and notify the owner
#   - a git operation in progress    -> skip this run
#
# Usage: sync-develop.sh [repo-path]   (default: $SAWAA_REPO or ~/code/sawaa)

set -u

REPO="${1:-${SAWAA_REPO:-$HOME/code/sawaa}}"
BRANCH="develop"
REMOTE="origin"
STATE_DIR="$HOME/Library/Application Support/sawaa-develop-sync"
STATE_FILE="$STATE_DIR/last-state"

mkdir -p "$STATE_DIR"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# Notify once per distinct state so a stuck condition does not spam.
notify() {
  local state="$1" message="$2"
  local previous=""
  [ -f "$STATE_FILE" ] && previous="$(cat "$STATE_FILE")"
  if [ "$state" != "$previous" ]; then
    /usr/bin/osascript -e "display notification \"$message\" with title \"Sawaa develop sync\"" >/dev/null 2>&1 || true
  fi
  printf '%s' "$state" >"$STATE_FILE"
}

clear_state() { printf 'ok' >"$STATE_FILE"; }

if ! git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1; then
  log "error: $REPO is not a git repository"
  exit 1
fi

if ! git -C "$REPO" fetch --quiet --prune "$REMOTE" 2>/tmp/sawaa-sync-fetch.err; then
  log "fetch failed: $(tr '\n' ' ' </tmp/sawaa-sync-fetch.err)"
  notify "fetch-failed" "Could not fetch from GitHub. Local develop was not changed."
  exit 0
fi

local_sha="$(git -C "$REPO" rev-parse --verify --quiet "refs/heads/$BRANCH")" || {
  log "no local $BRANCH branch; nothing to do"
  exit 0
}
remote_sha="$(git -C "$REPO" rev-parse --verify --quiet "refs/remotes/$REMOTE/$BRANCH")" || {
  log "no $REMOTE/$BRANCH; nothing to do"
  exit 0
}

if [ "$local_sha" = "$remote_sha" ]; then
  clear_state
  exit 0
fi

if git -C "$REPO" merge-base --is-ancestor "$remote_sha" "$local_sha"; then
  ahead="$(git -C "$REPO" rev-list --count "$remote_sha..$local_sha")"
  log "local $BRANCH is $ahead commit(s) ahead of $REMOTE; waiting for a PR"
  clear_state
  exit 0
fi

if ! git -C "$REPO" merge-base --is-ancestor "$local_sha" "$remote_sha"; then
  log "local $BRANCH diverged from $REMOTE/$BRANCH; manual merge needed"
  notify "diverged-$remote_sha" "Local develop diverged from GitHub. Merge origin/develop by hand."
  exit 0
fi

behind="$(git -C "$REPO" rev-list --count "$local_sha..$remote_sha")"

# Find the worktree (if any) that has develop checked out.
worktree=""
current=""
while IFS= read -r line; do
  case "$line" in
    "worktree "*) current="${line#worktree }" ;;
    "branch refs/heads/$BRANCH") worktree="$current" ;;
  esac
done < <(git -C "$REPO" worktree list --porcelain)

if [ -z "$worktree" ]; then
  # Not checked out anywhere: move the ref atomically, only if it is unchanged.
  if git -C "$REPO" update-ref "refs/heads/$BRANCH" "$remote_sha" "$local_sha"; then
    log "fast-forwarded $BRANCH by $behind commit(s) to ${remote_sha:0:9} (not checked out)"
    clear_state
  else
    log "update-ref failed; will retry next run"
  fi
  exit 0
fi

git_dir="$(git -C "$worktree" rev-parse --absolute-git-dir)"
for marker in index.lock MERGE_HEAD REBASE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
  if [ -e "$git_dir/$marker" ]; then
    log "skipped: $marker present in $worktree"
    exit 0
  fi
done

if output="$(git -C "$worktree" merge --ff-only --quiet "$remote_sha" 2>&1)"; then
  log "fast-forwarded $BRANCH by $behind commit(s) to ${remote_sha:0:9} in $worktree"
  clear_state
else
  log "fast-forward blocked in $worktree: $(printf '%s' "$output" | tr '\n' ' ')"
  notify "blocked-$remote_sha" "develop is $behind commit(s) behind; local changes touch the same files. Commit or stash, then run the sync."
fi
