#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
node --test scripts/apple-release/*.test.mjs
for file in scripts/apple-release/*.test.py; do python3 "$file"; done
bash -n scripts/apple-release/build-ios.sh
ruby -c scripts/apple-release/configure-signing.rb
