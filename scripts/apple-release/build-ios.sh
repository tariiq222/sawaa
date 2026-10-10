#!/bin/bash
set -euo pipefail
umask 077
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT/scripts/apple-release"
: "${GITHUB_SHA:?}" "${GITHUB_REF_NAME:?}" "${IOS_BUILD_NUMBER:?}" "${APPLE_P12_PATH:?}" "${APPLE_P12_PASSWORD_FILE:?}" "${APPLE_PROFILE_PATH:?}" "${FIREBASE_IOS_GOOGLE_SERVICES_FILE:?}" "${APPLE_OUTPUT_DIR:?}"
node -e 'if(!/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA)||! /^[1-9]\d{0,3}$/.test(process.env.IOS_BUILD_NUMBER))throw new Error("Invalid release identity")'
export EXPO_NO_DOTENV=1 CI=1 SENTRY_ALLOW_FAILURE=true SENTRY_DISABLE_AUTO_UPLOAD=true
export EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID=merchant.sa.sawa.app
# Dynamic import keeps the path separate from source and shell quoting.
TARGET=$(TARGET_MODULE="$SCRIPT/target.mjs" node --input-type=module -e 'const {releaseTarget}=await import(process.env.TARGET_MODULE);const t=releaseTarget(process.env.GITHUB_REF_NAME);console.log(t.profile+" "+t.apiUrl)')
read -r EAS_BUILD_PROFILE EXPO_PUBLIC_API_URL <<< "$TARGET"
export EAS_BUILD_PROFILE EXPO_PUBLIC_API_URL EXPO_PUBLIC_RELEASE_ENVIRONMENT="$EAS_BUILD_PROFILE"
mkdir -p "$APPLE_OUTPUT_DIR"
APPLE_OUTPUT_DIR=$(cd "$APPLE_OUTPUT_DIR" && pwd)
SESSION=$(mktemp -d "${TMPDIR:-/tmp}/sawaa-signing.XXXXXX")
KEYCHAIN="$SESSION/signing.keychain-db"
PROFILE_INSTALLED=""
cleanup() {
  status=$?
  set +e
  trap - EXIT INT TERM
  if [ -f "$SESSION/keychains.json" ]; then
    python3 - "$SESSION/keychains.json" <<'PY'
import json,subprocess,sys
subprocess.run(['security','list-keychains','-d','user','-s',*json.load(open(sys.argv[1]))],check=False,capture_output=True)
PY
  fi
  security delete-keychain "$KEYCHAIN" >/dev/null 2>&1 || true
  if [ -n "$PROFILE_INSTALLED" ]; then
    if [ -f "$SESSION/original.mobileprovision" ]; then cp "$SESSION/original.mobileprovision" "$PROFILE_INSTALLED"; else rm -f "$PROFILE_INSTALLED"; fi
  fi
  rm -rf "$SESSION"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
security list-keychains -d user | python3 -c 'import shlex,json,sys;json.dump(shlex.split(sys.stdin.read()),open(sys.argv[1],"w"))' "$SESSION/keychains.json"
KEYCHAIN_PASSWORD=$(openssl rand -hex 24)
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
python3 - "$SESSION/keychains.json" "$KEYCHAIN" <<'PY'
import json,subprocess,sys
subprocess.run(['security','list-keychains','-d','user','-s',sys.argv[2],*json.load(open(sys.argv[1]))],check=True,capture_output=True)
PY
security import "$APPLE_P12_PATH" -k "$KEYCHAIN" -P "$(cat "$APPLE_P12_PASSWORD_FILE")" -T /usr/bin/codesign >/dev/null
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN" >/dev/null
python3 "$SCRIPT/signing.py" "$APPLE_PROFILE_PATH" "$KEYCHAIN" "$SESSION/signing.json"
PROFILE_UUID=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["uuid"])' "$SESSION/signing.json")
PROFILE_DIRECTORY="${APPLE_PROFILE_DIRECTORY:-$HOME/Library/MobileDevice/Provisioning Profiles}"
mkdir -p "$PROFILE_DIRECTORY"
PROFILE_INSTALLED="$PROFILE_DIRECTORY/$PROFILE_UUID.mobileprovision"
if [ -e "$PROFILE_INSTALLED" ]; then cp "$PROFILE_INSTALLED" "$SESSION/original.mobileprovision"; fi
cp "$APPLE_PROFILE_PATH" "$PROFILE_INSTALLED"
cd "$ROOT"
pnpm install --frozen-lockfile
pnpm --dir apps/mobile install --frozen-lockfile
pnpm --filter @sawaa/shared build
pnpm --dir apps/mobile exec expo prebuild --clean --platform ios --no-install
export BUNDLE_GEMFILE="$SCRIPT/Gemfile" BUNDLE_FROZEN=true
bundle install
(cd apps/mobile/ios && bundle exec pod install --no-repo-update)
PROJECT=$(find "$ROOT/apps/mobile/ios" -maxdepth 1 -name '*.xcodeproj' -print)
WORKSPACE=$(find "$ROOT/apps/mobile/ios" -maxdepth 1 -name '*.xcworkspace' -print)
[ -d "$PROJECT" ] && [ -d "$WORKSPACE" ]
bundle exec ruby "$SCRIPT/configure-signing.rb" "$PROJECT" "$SESSION/signing.json" "$SESSION/scheme"
SCHEME=$(cat "$SESSION/scheme")
export SOURCEMAP_FILE="$APPLE_OUTPUT_DIR/main.jsbundle.map"
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release -destination 'generic/platform=iOS' -archivePath "$SESSION/Sawaa.xcarchive" -derivedDataPath "$SESSION/DerivedData" OTHER_CODE_SIGN_FLAGS="--keychain $KEYCHAIN" archive > "$APPLE_OUTPUT_DIR/archive.log" 2>&1
python3 - "$SESSION/signing.json" "$SESSION/export.plist" <<'PY'
import plistlib,json,sys
m=json.load(open(sys.argv[1]));plistlib.dump({'method':'app-store-connect','teamID':'569M49FYA6','signingStyle':'manual','signingCertificate':m['identity'],'provisioningProfiles':{'sa.sawa.app':m['uuid']},'manageAppVersionAndBuildNumber':False,'uploadSymbols':True},open(sys.argv[2],'wb'))
PY
xcodebuild -exportArchive -archivePath "$SESSION/Sawaa.xcarchive" -exportOptionsPlist "$SESSION/export.plist" -exportPath "$SESSION/export" > "$APPLE_OUTPUT_DIR/export.log" 2>&1
IPA=$(find "$SESSION/export" -maxdepth 1 -name '*.ipa' -print)
[ -f "$IPA" ]
cp "$IPA" "$APPLE_OUTPUT_DIR/Sawaa.ipa"
VERSION=$(node -p 'require("./apps/mobile/package.json").version')
python3 "$SCRIPT/verify-ipa.py" "$APPLE_OUTPUT_DIR/Sawaa.ipa" "$EAS_BUILD_PROFILE" "$VERSION" "$IOS_BUILD_NUMBER" "$GITHUB_SHA" "$APPLE_PROFILE_PATH" "$SOURCEMAP_FILE" "$APPLE_OUTPUT_DIR/binary-verification.json"
