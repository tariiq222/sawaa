# OpenShip build context repair (2026-10-10)

This image derives from the exact deployed OpenShip 0.8.0 image. It changes only `packBuildContext` and its ambient tar-fs types. A root-directory tar header precedes the original explicit entries; their ENOENT errors, ignore predicate and cancellation ownership remain intact. No platform upgrade or migration.

The original directory-less archive timed out before a Docker response for the actual Sawaa dashboard context. The corrected image completed the native `streamDockerodeBuild` pipeline in 2259 ms using the same cached context. Three Bun regression tests cover root/header, allowlist/ignore, missing explicit entry and cancellation/handoff.

Applied locally on the host as `openship-api:sawaa-context-root-v2-20261010`. Only the API image line in `/opt/openship/control/docker/docker-compose.yml` changed, with backup `docker-compose.yml.before-sawaa-context-root-20261010`. Compose must use `/opt/openship/control/.env` and the base file explicitly; the older unused override must not be applied.

Observed staging deployment `dep_5iIKzzj5HSLLGDP7` is ready at `7b57a9ef3bc49989830379cbf38317d1238e2675`, all six Docker healthchecks healthy. Eleven backend compiled-file hashes match the candidate; backend, dashboard and website HTTP checks returned 200. Production remained at `7d2d970265c39bb90cb22a5776f6a7da54488658`.

For a future OpenShip update, reassess whether upstream fixes this transport case before removing the patch. Do not blindly reapply it to a different baseline. Recovery is restoring the original compose API image and recreating only `api` with `--no-deps`; keep application containers and databases running.

## Resource scope picker dependency

`dashboard-scope-catalog.patch` fixes the scope modal callback lifetime on the same official source baseline `234d8a9d0bd571aff3fe3ce73a8408f226dcb4a0`. Updating catalog labels recreated `onCatalogLoaded`; ResourcePicker then fetched again and hid the resource list. `useCallback([])` keeps the callback stable. No permission, grant, authentication or API behavior changes.

Apply the patch to an archive of that exact upstream commit, then build with its `apps/dashboard/Dockerfile`. No signing material, control environment or application data enters the source archive. The regression file belongs next to AccessEditorModal.tsx in that source checkout; run its dashboard test command. The regression failed on the original modal and passed after the fix; the full dashboard suite passed (211 files, 2228 tests). Linux production image compilation also passed.

Activated with owner approval: `openship-dashboard:sawaa-scope-catalog-20261010`, image `sha256:9fbb2baee7a56ece16d175aa773e7a6a5efae87b4a74b1eb14b3d7dc2df43e02`. The live scope picker stayed visible and both project choices worked. Only the dashboard image changed; backup `docker-compose.yml.before-sawaa-scope-catalog-20261010` preserves the original. Compose used the same explicit env-file/base file and `--no-deps`; dashboard HTTP returned 200. Two separate read-only tokens, each limited to one Sawaa project with View permission and no expiry, were saved in GitHub Secrets. Each read its own project/deployment/containers/history, could not access the other project (404), and could not write (403 `TOKEN_READ_ONLY`). External API reads use `/api/proxy/api/`. Recovery restores `ghcr.io/oblien/openship-dashboard:0.8.0` and recreates only dashboard. Preserve the working API repair.
