#!/usr/bin/env bash
# Host launcher: macOS Bash 3.2 compatible. No application process runs on host.
set -euo pipefail
engine=woodpecker-local-engine-1
source_dir=$(cd "${SAWAA_CI_SOURCE_DIR:-.}" && pwd -P)
base_ref=${SAWAA_CI_BASE_REF:?Set SAWAA_CI_BASE_REF to the local PR base ref}
run_id="sawaa-safe-ci-$(date -u +%Y%m%d%H%M%S)-$$-$RANDOM"
artifact_root=${SAWAA_CI_ARTIFACT_DIR:-$(dirname "$source_dir")/sawaa-ci-artifacts}
mkdir -p "$artifact_root/$run_id"
artifacts=$(cd "$artifact_root/$run_id" && pwd -P)
pg="$run_id-postgres"
redis="$run_id-redis"
outbox="$run_id-outbox-redis"
minio="$run_id-minio"
runner="$run_id-runner"
volume="$run_id-source"
containers=()
volume_created=0
runner_created=0
# This is the sole host Docker entry point. Every Docker operation targets
# the pre-existing nested daemon, never the host engine's service containers.
ndocker() { docker exec -i "$engine" docker "$@"; }
cleanup() {
  status=$?
  trap - EXIT INT TERM
  set +e
  if [ "$runner_created" = 1 ]; then
    # docker cp's tar stream crosses both engines without host bind mounts.
    ndocker cp "$runner:/evidence/." - | tar -xf - -C "$artifacts"
    copy_status=$?
    if [ "$copy_status" != 0 ]; then
      printf 'Artifact export failed (%s)\n' "$copy_status" >&2
      status=1
    fi
  fi
  for ((index=${#containers[@]}-1; index>=0; index--)); do
    container=${containers[$index]}
    ndocker logs "$container" > "$artifacts/$container.log" 2>&1
    if ! ndocker rm -fv "$container" >/dev/null; then status=1; fi
  done
  if [ "$volume_created" = 1 ]; then
    if ! ndocker volume rm "$volume" >/dev/null; then status=1; fi
  fi
  printf '%s\n' "$status" > "$artifacts/launcher.exitcode"
  printf 'CI evidence: %s (exit %s)\n' "$artifacts" "$status"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
cd "$source_dir"
# Linked worktree metadata points outside the copied tree and is deliberately
# rejected. Provide a standalone full-history clone; never rewrite .git here.
[ -d .git ] || { echo 'CI source must have standalone .git metadata.' >&2; exit 1; }
[ "$(git rev-parse --is-shallow-repository)" = false ] || { echo 'Full Git history is required.' >&2; exit 1; }
[ ! -s .git/objects/info/alternates ] || { echo 'Git alternates must be dissociated before CI.' >&2; exit 1; }
git rev-parse --verify "${base_ref}^{commit}" > "$artifacts/base.sha"
git rev-parse HEAD > "$artifacts/head.sha"
# These gates inspect Git commits (base...HEAD and commits since the merge base).
# Reject staged, unstaged and untracked source so those checks cover precisely
# the files copied into the runner. Do this before touching the nested engine.
git status --porcelain=v1 --untracked-files=all > "$artifacts/source-status.txt"
[ ! -s "$artifacts/source-status.txt" ] || {
  echo 'CI source must be a clean committed checkout (no staged, unstaged or untracked files).' >&2
  exit 1
}
# Refuse a missing, incorrectly built, or non-runnable MinIO image before any
# database/cache/service resource is created. Prepare it explicitly with the
# companion script; never reuse the historical ambiguous :pinned image.
engine_arch=$(ndocker info --format '{{.Architecture}}')
case "$engine_arch" in aarch64|arm64) engine_arch=arm64 ;; x86_64|amd64) engine_arch=amd64 ;; *) echo "Unsupported engine architecture: $engine_arch" >&2; exit 1 ;; esac
minio_revision=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a
minio_image=${SAWAA_CI_MINIO_IMAGE:-sawaa-ci-minio:9e49d5e7a648-linux-$engine_arch-go1.24.13}
if ! ndocker image inspect "$minio_image" >/dev/null 2>&1; then
  echo 'Required Linux MinIO image missing. Run bash scripts/ci/prepare-minio.sh first.' >&2
  exit 1
fi
[ "$(ndocker image inspect --format '{{.Os}}/{{.Architecture}}' "$minio_image")" = "linux/$engine_arch" ]
[ "$(ndocker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$minio_image")" = "$minio_revision" ]
[ "$(ndocker image inspect --format '{{index .Config.Labels "io.sawaa.ci.go"}}' "$minio_image")" = go1.24.13 ]
[ "$(ndocker image inspect --format '{{index .Config.Labels "io.sawaa.ci.os"}}' "$minio_image")" = linux ]
[ "$(ndocker image inspect --format '{{index .Config.Labels "io.sawaa.ci.arch"}}' "$minio_image")" = "$engine_arch" ]
minio_image_id=$(ndocker image inspect --format '{{.Id}}' "$minio_image")
ndocker run --rm --network none --read-only --cap-drop ALL --memory 512m --cpus 1 \
  "$minio_image_id" --version > "$artifacts/minio-version.txt"
grep -q '^minio version ' "$artifacts/minio-version.txt"
printf '%s %s\n' "$minio_image" "$minio_image_id" > "$artifacts/images.txt"
# Hash only the image build inputs, so cached tools survive source changes.
image_hash=$(cat scripts/ci/Dockerfile scripts/security/requirements.txt | shasum -a 256 | cut -c1-16)
runner_image="sawaa-ci-runner:$image_hash"
if ! ndocker image inspect "$runner_image" >/dev/null 2>&1; then
  tar -cf - scripts/ci/Dockerfile scripts/security/requirements.txt |
    ndocker build --tag "$runner_image" --file scripts/ci/Dockerfile - 2>&1 |
    tee "$artifacts/runner-image-build.log"
fi
for image in "$runner_image" pgvector/pgvector:pg16 redis:7-alpine; do
  image_id=$(ndocker image inspect --format '{{.Id}}' "$image")
  printf '%s %s\n' "$image" "$image_id" >> "$artifacts/images.txt"
done
ndocker volume create --label "sawaa.ci.run=$run_id" "$volume" >/dev/null
volume_created=1
ndocker volume create sawaa-ci-pnpm-store >/dev/null
ndocker volume create sawaa-ci-playwright-cache >/dev/null
ndocker run -d --name "$pg" --label "sawaa.ci.run=$run_id" \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=sawaa_test \
  pgvector/pgvector:pg16 >/dev/null
containers+=("$pg")
ndocker run -d --name "$redis" --label "sawaa.ci.run=$run_id" \
  --network "container:$pg" redis:7-alpine >/dev/null
containers+=("$redis")
# The fault tests use `docker exec ... redis-cli ping` without a port. Keep
# that probe on the dedicated Redis, not the normal queue Redis at 6379.
ndocker run -d --name "$outbox" --label "sawaa.ci.run=$run_id" --label sawaa.test=true \
  --network "container:$pg" redis:7-alpine sh -ec '
    if [ ! -f /usr/local/bin/redis-cli-original ]; then
      mv /usr/local/bin/redis-cli /usr/local/bin/redis-cli-original
      printf "#!/bin/sh\nexec /usr/local/bin/redis-cli-original -p 35454 \"\$@\"\n" > /usr/local/bin/redis-cli
      chmod +x /usr/local/bin/redis-cli
    fi
    exec redis-server --port 35454
  ' >/dev/null
containers+=("$outbox")
ndocker run -d --name "$minio" --label "sawaa.ci.run=$run_id" \
  --network "container:$pg" -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin123 \
  "$minio_image_id" server /data --address :9000 --console-address :9001 >/dev/null
containers+=("$minio")
ndocker run -d --name "$runner" --label "sawaa.ci.run=$run_id" \
  --network "container:$pg" --cpus 2 --cpuset-cpus 0,1 --memory 5g --shm-size 256m \
  -v "$volume:/repo" -v sawaa-ci-pnpm-store:/pnpm/store \
  -v sawaa-ci-playwright-cache:/root/.cache/ms-playwright \
  -v /run/user/1000/docker.sock:/var/run/docker.sock \
  -e SAWAA_CI_BASE_REF="$base_ref" -e OUTBOX_TEST_REDIS_CONTAINER="$outbox" \
  "$runner_image" sleep infinity >/dev/null
containers+=("$runner")
runner_created=1
ndocker exec "$runner" mkdir -p /evidence
# Copy committed tracked files only, plus full standalone Git history.
# Exclusions also protect against accidentally tracked live environment files.
git ls-files --cached -z > "$artifacts/source-files.nul"
: > "$artifacts/archived-files.nul"
while IFS= read -r -d '' file; do
  case "$file" in
    .env.example|*/.env.example|.env.prod.example|*/.env.prod.example) ;;
    .env|.env.*|*/.env|*/.env.*|*.env) continue ;;
  esac
  printf '%s\0' "$file" >> "$artifacts/archived-files.nul"
  if [ -f "$file" ]; then shasum -a 256 "$file"; fi
done < "$artifacts/source-files.nul" > "$artifacts/source-sha256.txt"
tar --exclude='node_modules' --exclude='dist' --exclude='build' --exclude='.next' \
  --exclude='coverage' --exclude='.turbo' --exclude='playwright-report' \
  --exclude='test-results' --null -T "$artifacts/archived-files.nul" -cf "$artifacts/source.tar" .git
shasum -a 256 "$artifacts/source.tar" > "$artifacts/source-archive.sha256"
ndocker exec -i "$runner" tar --no-same-owner -xf - -C /repo < "$artifacts/source.tar"
rm "$artifacts/source.tar"
# Strict readiness; no migration or test can target another database.
ready=0
for attempt in $(seq 1 60); do
  if ndocker exec "$pg" pg_isready -U test -d sawaa_test >/dev/null 2>&1 &&
     ndocker exec "$redis" redis-cli ping | grep -q '^PONG$' &&
     ndocker exec "$outbox" redis-cli ping | grep -q '^PONG$' &&
     ndocker exec "$runner" curl -fsS http://localhost:9000/minio/health/live >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[ "$ready" = 1 ] || { echo 'Isolated services did not become ready.' >&2; exit 1; }
for db in sawaa_critical_test sawaa_outbox_test sawaa_smoke_test; do
  ndocker exec "$pg" createdb -U test "$db"
done
set +e
ndocker exec "$runner" bash scripts/ci/run-gates.sh 2>&1 | tee "$artifacts/pipeline.log"
status=${PIPESTATUS[0]}
set -e
exit "$status"
