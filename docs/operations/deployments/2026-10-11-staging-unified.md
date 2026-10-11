# Unified staging path — initial live observation, 11 October 2026

This is a dated diagnostic observation, not owner acceptance or a successful workflow receipt. The only publication path is defined in [the deployment policy](../deployment-policy.md#fixed-staging-publication-path--owner-approved-2026-10-11).

## Observed runtime

- [PR #205](https://github.com/tariiq222/sawaa/pull/205) merged into `develop` at `2fe5bddec4bfea84c8af7dc38ccb68150a517dea`. Required `gate` and `critical-real-e2e` passed. Local premerge passed on the identical reviewed source tree: four browser smoke checks and both website/staff booking journeys on disposable local data.
- [Build/deploy run 38129689595](https://github.com/tariiq222/sawaa/actions/runs/38129689595) built all four images successfully. After correcting the hook credential, the existing scoped hook created `dep_umLIEZq-0hC9q6hT`; independent read-only observation at 10:03 UTC found it active and `ready`.
- Recorded source ref and live backend `/api/v1/health` agree on the full SHA above. OpenShip leaves `commitSha=null` for fully image-backed snapshots. All three actual Docker RepoDigests match that run's SHA-bound manifests:

| Service | Observed digest |
| --- | --- |
| backend | `sha256:110a59a4192516bcb67f0b7e51e9e17299ea909e213f3fd1024fc644740e7f27` |
| dashboard | `sha256:dc65b33f352cbab079cd845ce132c37a261993fe2f6566a8bacd99280c9e643a` |
| website | `sha256:a532ee1ee794f6841594a602b28802a9ac934d6bcc494b1833e023ad09d1b3c1` |

- All six staging containers and all six production containers were healthy. Staging PostgreSQL, Redis and MinIO retained their baseline container IDs and image refs. All production container IDs/image refs and its `main`, auto-deploy, compose path and active deployment `dep_6WwSoqpt_PJmgQMy` were unchanged.
- The 120 migration metadata rows are identical before/after in SELECT-only read-only transactions. No live migration, seed, booking, payment or customer-data mutation was performed.
- Public staging pages `/`, `/services`, `/clinics`, `/booking`, `/packages`, three public catalog endpoints and ten referenced static assets returned HTTP 200. This does not prove a real booking/payment/device journey.
- All then-existing local/remote branch tips, including `main`, `chore/playwright-test-agents`, `fix/mobile-review-findings` and the deployment task branch, were ancestors of the merged `develop`; local `develop` matched its remote. Branches were preserved.

## Corrections before final acceptance

The workflow itself remained **failed**: its verifier incorrectly required populated OpenShip commit metadata. The reviewed correction requires the exact immutable source ref, strict application scope, exact image digests and independent live backend SHA; populated contradictory metadata still fails. Production receives no null-metadata exception.

Initial website runtime used a moving tag whose actual digest matched this candidate. A historical image override was aligned to the current source digest through the staging service configuration API without replacing a container. Subsequent publication must prove all three configured runtime refs are pinned digests, not merely matching tag contents.

Scope/authority updates can rotate the incoming-hook token. Finalize the three-application scope before privately synchronizing the credential into GitHub. Diagnose failures in this path; do not use host builds, bare Redeploy or manual container replacement.

Final acceptance requires a green corrected publication and a manual repeat through the same workflow without file changes, with a `staging-deployment-<sha>` artifact and fresh independent preservation checks. Those results are recorded by the workflow/private evidence after this snapshot. Owner manual acceptance remains separate.
