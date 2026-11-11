#!/bin/bash
# Install (or reinstall) the launchd agent that runs scripts/sync-main.sh
# every 5 minutes. The script is copied out of the repo so switching branches
# or removing a worktree never breaks the agent.
#
# Usage: scripts/install-main-sync.sh [repo-path]
#        scripts/install-main-sync.sh --uninstall
#        scripts/install-main-sync.sh --uninstall-legacy

set -euo pipefail

LABEL="sa.sawaa.main-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
INSTALL_DIR="$HOME/Library/Application Support/sawaa-main-sync"
LOG="$HOME/Library/Logs/sawaa-main-sync.log"

if [ "${1:-}" = "--uninstall-legacy" ]; then
  legacy="sa.sawaa.develop-sync"
  launchctl bootout "gui/$(id -u)/$legacy" 2>/dev/null || true
  rm -f "$HOME/Library/LaunchAgents/$legacy.plist" "$HOME/Library/Application Support/sawaa-develop-sync/sync-develop.sh"
  echo "Uninstalled $legacy"
  exit 0
fi

if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST" "$INSTALL_DIR/sync-main.sh"
  echo "Uninstalled $LABEL"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-$HOME/code/sawaa}"

mkdir -p "$INSTALL_DIR" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
install -m 0755 "$SCRIPT_DIR/sync-main.sh" "$INSTALL_DIR/sync-main.sh"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$INSTALL_DIR/sync-main.sh</string>
    <string>$REPO</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL for $REPO (every 5 minutes). Log: $LOG"
