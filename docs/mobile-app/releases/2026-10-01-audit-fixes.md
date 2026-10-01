# Local branch-audit fixes — 2026-10-01

Owner authorized all identified source fixes. Worktree branch `codex/mobile-audit-fixes` starts at `5172887e65afa4dc6d512750caa808c28aad19ab`. Original checkout and its uncommitted TestFlight documents are preserved. No task-branch commit, push, merge, deployment or Apple upload is included.

## Source changes

- Public bootstrap, login guest escape, suspended escape, history-less navigation and both role logout destinations select `/(guest)/home` explicitly. Existing guest role dispatch, history-back behavior, authentication guards, hydration and session fences remain intact. External bare `/home` links still share route names; this scoped fix repairs internal destinations.
- Client appointment detail and list show booked service identity separately from the practitioner, including the card accessibility label. Existing normalized snapshot fields take precedence, with opposite-language and nested legacy fallbacks; absent names produce no invented label. No backend booking/payment/Zoom contract changed.
- Root and independently locked mobile dependencies gain compatible fixed version constraints. Two incompatible major/API upgrades are handled by exact-version `pnpm.patchedDependencies`: decoder remains CommonJS/callable with plus-to-space semantics; stream-json retains its CommonJS Transform and MinIO JSONL Parser APIs.

## Backport provenance and residual audit findings

- [decode-uri-component advisory GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr): bounded UTF-8 scanner adapted from upstream 0.5.0. Independent review reproduced a further quadratic outer replacement-map path; this patch removes that map, scans forward once, and normalizes legacy BOM recovery before decoding. Malformed percent recovery now avoids interpreting decoded replacement syntax or decoding escaped percent text twice. Valid URI decoding, Arabic/emoji, plus handling and expected invalid-byte controls are tested. Root and mobile patch files have identical content.
- [stream-json advisory GHSA-528h-pc64-c93x](https://github.com/advisories/GHSA-528h-pc64-c93x): default filter depth bound 1024 adapted from upstream 3.5.0, returned as a Transform callback RangeError before path filtering. A further independently reproduced shallow long-key route required a shared default total path-length bound of 16,384 UTF-16 characters before joins/scans (including separators); trusted callers may configure maxPathLength. Already selected/skipped containers only count depth and do not grow/check filter paths; this is a bound on expensive filter-path work, not a universal JSON nesting limit.
- Package license files stay intact. Patch provenance is recorded here and in patch comments. Versions remain 0.2.2 and 1.9.1; they are not falsified or hidden from scanners. Live pnpm audit JSON after lock regeneration reports root **2 moderate, 0 low/high/critical** and mobile **1 moderate, 0 low/high/critical**, all for those patched versions (before: root32moderate7low; mobile3moderate). Scanner warnings remain; local patch verification is distinct from upstream advisory-version clearance.
- MinIO currently uses query-string stringify and JSONL notification parser, with no app filter sink found. Expo Router's installed fork uses URLSearchParams for deep-link queries. These package advisories do not by themselves establish an exploitable application route. Real device/provider/storage operations are not accepted by static reachability or package tests.

## Verification

Focused mobile regressions: navigation8suites/64tests and appointment identity2suites/39tests passed after demonstrated failures before the fixes; independent task reviews approved the actual diffs. Dependency regressions demonstrated the original decoder timeout and all four missing filter bounds; the independent decoder bypass and escaped-percent regressions also failed before the final amendment. Integrated final evidence will be appended after completion.

Tests in `scripts/security/dependency-fixes.test.cjs` exercise installed root/mobile packages, bounded child processes, normal JSON filtering/JSONL imports, original JSON body bytes, upload size bounds, ExcelJS export/import, TSX transforms, xcode project parse/write/IDs and calendar dates/locales. Woodpecker runs them as `dependency-regressions` after the two frozen installations. For local invocation after both installations: `SAWAA_INCLUDE_MOBILE_DEPENDENCIES=1 node --test scripts/security/dependency-fixes.test.cjs`.

Code verification does not update the already uploaded TestFlight14 binary or prove native gestures, large-text/VoiceOver, real device login/booking/payment/Push/3DS, staging or production acceptance.

## Reviewable file groups

| Purpose | Files |
| --- | --- |
| Public destinations | `apps/mobile/lib/navigation.ts`, `apps/mobile/app/index.tsx`, auth `login.tsx` / `suspended.tsx`, client and employee `profile.tsx`, covering navigation and escape tests |
| Booked service identity | `apps/mobile/lib/booking-service-name.ts`, client `appointment/[id].tsx`, `AppointmentRowCard.tsx`, `appointment-service-identity.test.tsx` |
| Compatible dependency versions | Root/backend/mobile `package.json`, root/mobile `pnpm-lock.yaml` |
| Security backports | `patches/decode-uri-component@0.2.2.patch`, identical mobile patch, `patches/stream-json@1.9.1.patch` |
| Repeatable regression gate | `scripts/security/dependency-fixes.test.cjs`, `scripts/ci/phase.sh`, `scripts/ci/run-gates.sh`; `scripts/ci/run-local.sh` adds the normal freshness-aware Trivy cache |
| Local evidence | This dated record and `docs/superpowers/plans/2026-10-01-mobile-audit-fixes.md` |

## Ordered integrated verification commands

1. Regenerate the root and independent mobile locks with pnpm; run `pnpm install --frozen-lockfile --ignore-scripts` and `pnpm --dir apps/mobile install --frozen-lockfile --ignore-scripts`. Final root patch reinstall also passed with `--offline`.
2. Run `pnpm audit --json` and `pnpm --dir apps/mobile audit --json`. Exit 1 reflects the disclosed remaining moderate advisory-version warnings; no high/critical findings remain.
3. Run `SAWAA_INCLUDE_MOBILE_DEPENDENCIES=1 node --test scripts/security/dependency-fixes.test.cjs`: **32/32 passed**, exit 0, against the installed root/mobile packages. Original decoder timeout and missing filter depth/path-length bounds failed before their fixes; repeated/distinct malformed inputs now finish within bounded child processes and filters reject excessive paths through the normal error callback. Normal decoding/filtering, request bytes, uploads, SDK consumers and legacy APIs pass the controls.
4. Run `pnpm --filter=@sawaa/shared --filter=@sawaa/api-client --filter=@sawaa/ui test`: **503 tests passed** (223 shared, 137 API client, 143 UI). The same filters' `typecheck` commands passed.
5. Freeze all tracked candidate files in a standalone temporary full-history CI clone. Final snapshot `7476b763e184637a956d881d0b48806f9a6ede11`, tree `fbc0f884a6a0c8d848cdf1f801e1d755986e86f3`; all 4,587 tracked snapshot files byte-matched the worktree before execution. This test fixture commit exists only in `/tmp/sawaa-all-fixes-ci-20261001`, not the task branch.
6. Run local Woodpecker on that snapshot with `--pipeline-event pull_request --commit-branch develop --commit-sha 7476b763e184637a956d881d0b48806f9a6ede11 --timeout 3h .woodpecker/ci.yml`. It executes all 39 sequential gates with disposable Linux services, isolated test data and synthetic credentials. Final results are recorded below after completion.

The final independent reviews checked the actual full diff, backend callers and security boundaries. A fresh blind security pass found the shallow long-key filter bypass; the same-boundary amendment and covering RED/GREEN regressions resolved it. Review approval is separate from the integrated CI result. Native review token attribution was unavailable; whole-task consumption is unknown.

## Completed integrated run and covering amendments

The full Woodpecker run finished with **36/39 phases passing, exit 1**. Its evidence directory is `/tmp/sawaa-ci-artifacts/sawaa-safe-ci-20261001104400-2445-30745`. This is not recorded as a green full run. It passed backend lint/types/build-dependent API checks and 8,004 unit tests (1 pre-existing skip), 25 regular E2E tests, all 216 critical real-database tests and both outbox transport tests. Regular E2E intentionally skips the separately gated real-database suites. Dashboard passed 2,175 unit tests, build and 41 Smoke tests (1 existing skip); website passed 877 tests and build. Dependency audit, Gitleaks, Semgrep, both frozen installs and the new 32-test dependency regression gate passed. Semgrep reported no findings in its configured scope, which excludes mobile.

Three remaining phases were investigated and amended without changing application runtime source or locks:

- Mobile types: the real Expo route-matcher fixture needed explicit nested `NavigatorScreenParams` typing. The isolated diagnostic changed from two TS2353 errors to none, retaining the consumer destination assertions.
- Mobile coverage: three Node-only Expo config-plugin suites encountered UUID11's default ESM-browser export under Jest's React Native conditions. A version-independent pnpm link maps `^uuid$` to the real mobile UUID11 CommonJS implementation in Jest only. No mock or runtime package replacement is used. All eight plugin tests pass.
- Trivy: the official vulnerability database download received only15.7MiB/119.4MiB before Trivy's internal five-minute timeout. CI now allows15minutes within its existing20minute phase limit and persists the default cache, with normal metadata freshness checks retained. No advisory exclusion, severity change or skip-update was added. The database retry/scan outcome is recorded separately below.

After both mobile amendments, the orchestrator ran `pnpm --dir apps/mobile typecheck`, `pnpm --dir apps/mobile lint`, and `pnpm --dir apps/mobile test --runInBand --coverage`: all exited0; **150 suites/954 tests passed**, global coverage thresholds passed. Lint retains7 pre-existing warnings and no errors. `pnpm --dir apps/mobile install --frozen-lockfile --ignore-scripts --offline` also passed. A separate read-only amendment review approved the actual typing, mapper and CI cache/timeout changes. Existing successful gates are retained only for unchanged source surfaces; this covering verification is not described as a fresh single-run39/39 result.

## Final disposition and external blocker

**Source fixes and covering regressions complete; full security-gate acceptance blocked by database download.** The original integrated run is36/39; the two failed mobile phases now pass after narrow amendments, giving38verified phase outcomes across the integrated run and covering rechecks. Trivy has no completed result for this candidate, so39/39 is not claimed.

One bounded download retry used the official `ghcr.io/aquasecurity/trivy-db:2` repository with the same pinned Trivy0.72.0 binary, `--download-db-only --timeout15m --no-progress`, and the new cache. It exited1 after10minutes with `oci download error: copy error: unexpected EOF`. This is external transport failure, not an advisory finding or successful scan. No further retry, stale database substitution, advisory suppression or skip-update is used. Evidence: `/tmp/sawaa-trivy-db-preflight.log`, retained through the Codex Security artifact tool as `artifacts/trivy-final-download-blocker.log`, SHA256 `cb2e50818534c25c5cb429f0285127914c573a68ce806431792594cbcd9b292d`.

All actual task-branch modifications remain uncommitted in `codex/mobile-audit-fixes`. Develop's earlier dependency merge remains local; these subsequent fixes have not been merged or pushed. No deployment, provider/Apple write or native-device acceptance occurred. Original dirty TestFlight records remain byte-identical. The only post-CI source differences are the reviewed route-test types, Jest mapper, Trivy timeout/cache and evidence documents; application runtime code and both locks are unchanged from the integrated snapshot. Disposable attempt services and the unused scanner-source container/volume were removed; standard dependency/browser/scanner caches remain.
