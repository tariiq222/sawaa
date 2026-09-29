#!/usr/bin/env bash
# Cross-build official pinned source on the host, load only the nested engine.
# Does not overwrite sawaa-ci-minio:pinned or modify the Go module cache.
set -euo pipefail
engine=woodpecker-local-engine-1
revision=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a
toolchain=go1.24.13
script_dir=$(cd "$(dirname "$0")" && pwd -P)
ndocker() { docker exec -i "$engine" docker "$@"; }
architecture=$(ndocker info --format '{{.Architecture}}')
case "$architecture" in aarch64|arm64) architecture=arm64 ;; x86_64|amd64) architecture=amd64 ;; *) echo "Unsupported engine architecture: $architecture" >&2; exit 1 ;; esac
image="sawaa-ci-minio:${revision:0:12}-linux-$architecture-$toolchain"
source_dir=$(cd "$script_dir/../.." && pwd -P)
evidence_root=${SAWAA_CI_ARTIFACT_DIR:-$(dirname "$source_dir")/sawaa-ci-artifacts}
evidence="$evidence_root/minio-build-$(date -u +%Y%m%d%H%M%S)-$$"
mkdir -p "$evidence"
evidence=$(cd "$evidence" && pwd -P)
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/sawaa-minio-build.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT
# GOTOOLCHAIN pins the toolchain independently of the host's default Go.
GOTOOLCHAIN="$toolchain" go version | tee "$evidence/toolchain.txt"
grep -q "go version $toolchain " "$evidence/toolchain.txt"
GOTOOLCHAIN="$toolchain" go mod download -json "github.com/minio/minio@$revision" > "$evidence/source-module.json"
module_dir=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["Dir"])' "$evidence/source-module.json")
# Read-only module mode ensures cache go.mod/go.sum are never rewritten.
(
  cd "$module_dir"
  GOTOOLCHAIN="$toolchain" GOOS=linux GOARCH="$architecture" CGO_ENABLED=0 GOMAXPROCS=2 \
    go build -mod=readonly -trimpath -buildvcs=false -p 2 -o "$build_dir/minio" .
) 2>&1 | tee "$evidence/build.log"
GOTOOLCHAIN="$toolchain" go version -m "$build_dir/minio" > "$evidence/binary-build-info.txt"
grep -q 'GOOS=linux' "$evidence/binary-build-info.txt"
grep -q "GOARCH=$architecture" "$evidence/binary-build-info.txt"
shasum -a 256 "$build_dir/minio" > "$evidence/binary.sha256"
cp "$script_dir/Minio.Dockerfile" "$build_dir/Dockerfile"
tar -C "$build_dir" -cf - Dockerfile minio |
  ndocker build --build-arg "MINIO_ARCH=$architecture" --tag "$image" - 2>&1 |
  tee "$evidence/image-build.log"
ndocker image inspect --format '{{.Id}} {{.Os}}/{{.Architecture}}' "$image" > "$evidence/image.txt"
ndocker run --rm --network none --read-only --cap-drop ALL --memory 512m --cpus 1 \
  "$image" --version > "$evidence/minio-version.txt"
grep -q '^minio version ' "$evidence/minio-version.txt"
printf 'Prepared %s\nEvidence: %s\n' "$image" "$evidence"
