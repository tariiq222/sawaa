# OpenShip build context repair (2026-10-10)

This image derives from the exact deployed OpenShip 0.8.0 image. It changes only `packBuildContext` and its ambient tar-fs types. A root-directory tar header precedes the original explicit entries; their ENOENT errors, ignore predicate and cancellation ownership remain intact. No platform upgrade or migration.

The original directory-less archive timed out before a Docker response for the actual Sawaa dashboard context. The corrected image completed the native `streamDockerodeBuild` pipeline in 2259 ms using the same cached context. Three Bun regression tests cover root/header, allowlist/ignore, missing explicit entry and cancellation/handoff.

Applied locally on the host as `openship-api:sawaa-context-root-v2-20261010`. Only the API image line in `/opt/openship/control/docker/docker-compose.yml` changed, with backup `docker-compose.yml.before-sawaa-context-root-20261010`. Compose must use `/opt/openship/control/.env` and the base file explicitly; the older unused override must not be applied.

Observed staging deployment `dep_5iIKzzj5HSLLGDP7` is ready at `7b57a9ef3bc49989830379cbf38317d1238e2675`, all six Docker healthchecks healthy. Eleven backend compiled-file hashes match the candidate; backend, dashboard and website HTTP checks returned 200. Production remained at `7d2d970265c39bb90cb22a5776f6a7da54488658`.

For a future OpenShip update, reassess whether upstream fixes this transport case before removing the patch. Do not blindly reapply it to a different baseline. Recovery is restoring the original compose API image and recreating only `api` with `--no-deps`; keep application containers and databases running.
