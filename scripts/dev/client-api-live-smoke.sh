#!/bin/zsh
# Check an already-running owned isolated stack; every mismatch fails the run.
set -euo pipefail
if [[ $# != 1 ]]; then
  print -u2 'Usage: scripts/dev/client-api-live-smoke.sh <isolated-run-directory>'
  exit 1
fi
root_dir="${0:A:h:h:h}"
exec node "$root_dir/e2e/local/with-env.mjs" "$1" node "$root_dir/scripts/dev/client-api-live-smoke.mjs"
