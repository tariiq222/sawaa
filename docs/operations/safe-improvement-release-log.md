# Safe improvement execution and release log

Execution base: `703e9444`. Status: **independent local packages verified; financial-policy decision required to continue dependent packages; no commit or deployment**.

| Package | Local status | Required remaining evidence |
|---|---|---|
| B0 | Local unit/UI baseline and isolated synthetic infrastructure established | Production inventory/restore and broad journey/performance baselines remain separate |
| O1 | Local critical gate15 suites128 tests and actual transport2/2 passed | Hosted Actions and full42-case production-profile smoke remain separate |
| F1 | Pure calculation helper prepared; collection-after-refund decision pending | All writer wiring and concurrent DB acceptance |
| F2 | Waiting for F1 | Atomic manual payment outbox and replay |
| F3 | Report arithmetic/date correction and O4 SQL integration accepted; actual DB and final broad gates pass | Target-environment acceptance; createdAt retained |
| T1 | Waiting for F2 outbox contract | Program cancellation atomicity and races |
| T2 | Accepted after review;21 actual DB races plus final128-case integration passed | Production rollout separate |
| T3 | Expansion/history/deletion accepted; final128-case integration passed | Production rollout separate |
| T4 | Local manifest/CLI/apply tool accepted; 10 units and7 actual DB cases passed | Real reviewed manifest, old-writer drain and unique-index rehearsal/promotion remain pending |
| D1 | Accepted:1,996 units, typecheck/build/lint and4/4 fresh built finance UI cases passed | Full42-case production smoke separately unresolved |
| D2 | Waiting for F1 | Booking wire DTO and adapter |
| D3 | Waiting for D2 | All-period analytics with existing scopes and meaning |
| D4 | Waiting for F2/F3/D2 | Sensitive API contracts and old/new compatibility |
| O2 | Waiting for F2/T1/T2 | Remove targeted backend import cycle, AST ratchet |
| O3 | Waiting for D1/D3 | Dashboard shared boundaries and ratchet |
| O4 | Local SQL + wired telemetry accepted; exact5k/50k output equality and measured improvements | Full mixed booking/payment-write, HTTP and two-instance load deferred until F1/F2 stabilize |
| R1 | Bounded read-only inventory R1.1-3 accepted after review;10 units and2 real DB cases passed | R1.4-7 repair/apply waits for F1/F2 rules; no real apply |

## Release-only gates

Published SHA/image, production backup/restore, authorized historical inventory/manifests, Moyasar sandbox, authenticated target-environment flows and post-release monitoring are not completed. Do not translate local unit/DB/HTTP evidence into production verification.

## Execution evidence

- 2026-09-05: Fresh remote main `f6e41f9e`; local base `703e9444`; copied six documents only from source. Root dependency install and Prisma generation passed. Dedicated DB identity verified before 95 immutable migrations+vector hooks passed. Backend baseline unit suite running; result pending.

- Backend configured run: **7,132 passed, 0 failed, 1 pre-existing skipped** in 790 suites (789 passed). This includes 4 new O1 HTTP configuration tests: original tracked baseline is 7,128 passing tests. `legacy-import.writer.spec.ts` has the existing skipped integration placeholder; it is not part of the forthcoming critical lane. Evidence: `b0-backend-unit-configured.json`, 76.565s. First unconfigured attempt failed required-env validation; no security setting changed.
- Dashboard baseline first run halted after reproducing missing compiled `@sawaa/shared/money` output in fresh worktree. Build of shared package is the setup fix; no source/API alteration.

- Dashboard configured baseline: **230 files / 1,967 tests passed** after compiling shared, 153.94s (`b0-dashboard-unit-configured.log`).
- DB integration baseline at O1 HTTP extraction: **168 passed / 1 failed / 0 skipped** across22 suites; includes164 existing tests +5 O1 validation cases. The one failure was `socket hang up` in the existing over-payment case. Focused finance rerun **19/19 passed**, 4.743s (`b0-finance-db-rerun.json`); original failed attempt retained. The first command used unsupported plural Jest29 testPathPatterns and selected the full configured suite; future targeted runs use explicit paths.
- Both backend and dashboard production builds passed (`o1-backend-build.log`, `o1-dashboard-build.log`). Built-app smoke uses newly created `sawaa_smoke_test_ecfc` (identity checked before95 migrations), Redis35464 and dedicated MinIO35455; integration fault lane stays on original test DB/Redis35454. Kernel sandbox permits localhost outbound only: local Redis connected; remote test IP returned EPERM. No provider keys copied from dev seed. Synthetic four-persona/main-branch fixture only.
- D1 delegated to `/root/d1_cache` (luna-high), frontend-only files, after dashboard baseline; targeted tests only.

- O1 built production-profile browser gate: **3/3 passed**,19.9s (`o1-production-journeys.log`): home content, reload survival, and program edit UI→PATCH→persisted detail without duplicate POST. Backend98450 ran with unchanged production auth/security behind a kernel localhost-only outbound sandbox.
- Built-production finance HTTP boundary: numeric amount reached missing-invoice404, numeric string400, unknown field400, unauthenticated401; no invoice or payment created (`o1-built-http-validation.log`).
- Full42-test smoke attempt:9 passed,32 failed,1 skipped under real production limits (fresh log lines1336/1369/1370). Repeated login/refresh reaches existing login5/min and auth-wide20/15min controls; this is a test-harness limitation, not a passed full gate. Bounded login-only retry experiment respected Retry-After but correctly refused a longer auth-wide wait; second setup aborted. Existing limits/guards were not changed. Limited authentic production journeys above are a separate evidence layer.
- Snapshot only (not capacity/load proof): isolated built backend RSS74,704KiB; smoke DB one idle app connection plus measurement query; no pending outbox rows at measurement time.
- D1 implementer reports targeted6 files47 tests and extended7 files51 tests passed; focused independent Sol review in progress, not accepted yet.
- D1 focused Sol review returned spec/quality changes required: polling lifecycle, missing wire response context, credit-return/reclaim invalidation, refresh error semantics, incomplete behavioral coverage, and filtered report prefixes. Original implementer is correcting all six; initial passing tests do not establish D1 acceptance.
- O1 critical wrapper:8 suites/77 tests passed, zero pending, required-path parser PASS. Final root transport wrapper after the clean-DB precondition: **2/2 passed**,41.824s on newly created and identified `sawaa_transport_test_ecfc`, using actual publisher/consumer; parser PASS and dedicated Redis PONG. Shared-DB contaminated attempt remains rejected; never clear unrelated test events to force this lane to pass.
- T3 expansion: **96 migrations** passed on a new empty rehearsal DB. Upgrade fixture retained2 differing response rows and checksum `3db525f6335701a35256d57463b3cce0`; nullable metadata untouched; old-shape INSERT succeeded. Source artifacts: `t3-migration-before.log`, `t3-migration-after.log`, `t3-migration-fresh-verify.log`.
- T3 legacy compatibility regression:2 behavioral failures/1 pass before guard;3/3 passed after. Read-only audit regression:1 failure/3 passes before separate current/history counters; combined legacy guard/audit7/7 passed after. Targeted DB proof is included in the T3 acceptance suite.
- D1 review follow-up reports45 focused tests and34 affected consumer tests passed. Root typecheck found8 D1 errors (union narrowing and optional mock arguments); round2 review underway. D1 is still not accepted.

- T2 round1 focused review rejected Serializable deletion-wins error semantics and incomplete writer/PID coverage. Corrected implementation:182/182 units and21/21 real DB cases, zero skips; independent re-review pending.
- T3 round2:39/39 units and13/13 actual DB cases passed. Review identified waiting invoice-lock deadlocks and a lazy-invoice orphan race. Bounded correction is in progress in deletion/CreateInvoice/Ensure only; provider semantics remain in F1.
- F3 report correction: original meaningful regression4 failed/7 passed; first correction25/25 builder+pure-balance tests. Expanded32 units+1 large actual DB reconciliation scenario passed. Focused review requires half-open period boundaries and exact Riyadh midnight assertions; correction ongoing. No processedAt migration or recollection policy chosen.
- D1 root regressions:3 failures proved deposit/remainder, concurrent affected bookings and filtered membership faults; Map job implementation fixed them. Final review then found waiting-to-waiting transitions/deadline stale lists; additional3 failures reproduced those. Final targeted4 files36 tests passed; dashboard typecheck and production build passed again.
- D1 built finance matrix: first fixture failed numeric production validation; explicit numeric service config fixed it. Next run3/4 passed; empty gatewayRef collided with unique constraint. Fixture now explicitly passes null for off-gateway payments; subsequent run hit unchanged login throttles. API-only assertions no longer log in a browser unnecessarily. Original failures retained, complete UI refund gate still pending.
- T4 preparation: DB-enforced READ ONLY manifest with bounded100-group batches, private answer hashes and no automatic review decision; guarded per-group apply preserves raw answers. Five pure tests passed. Dedicated `sawaa_intake_tools_test_ecfc` identified and96 migrations applied. No customer canonicalization or unique index created/applied.

- Accepted reviews: `d1-review-final-round2.md`, `t2-review-round2.md` (last assertion strengthened by root), `t3-review-final.md`, `f3-review-final.md`, `t4-review-final.md`. T4 minor documentation corrections are applied.
- Root integrated transaction gate: **3 suites/39 cases passed, zero skipped**,13.954s (`transactions-final-fixed.json`): person deletion21, intake13, invoice deletion5. First attempt failed only the new test's hardcoded DB-name restriction; it now reuses the existing validated real-E2E URL helper.
- D1 final: **233 files/1,996 unit tests passed**,168.41s; final typecheck and production build passed. Built-production finance matrix **4/4 passed**,4.8s (`d1-finance-production-e2e-navigation-final.log`). Test navigation now uses the existing sidebar button and avoids unnecessary full-page auth rehydration. Auth limits unchanged.
- D1 boundary: full refund of a partially paid invoice currently produces PARTIALLY_REFUNDED accounting status and an existing payment-label fallback. This remains a known F1/D4 dependency; the complete mounted UI refund test uses a fully paid invoice. The separate partial-invoice accounting assertions remain covered.
- F3 accepted after half-open date correction:33 focused units and1 actual DB reconciliation scenario passed (`evidence/f3-unit-green.json`, `evidence/f3-real-green.json`). No collection-after-refund policy or processedAt reporting migration selected.
- T4 accepted local tool:10 units and7 actual DB cases passed; default dry-run READ ONLY, exclusive0600 outputs, parent locks, verified database identity even for empty manifests, per-item fsynced NDJSON receipts and replay/conflict behavior. No customer manifest applied; no unique index promoted.
- Pre-O4 backend typecheck passed after correcting test-only EventHandler imports/JSON payload types and typed deletion fixtures. Critical wrapper now requires13 suites including all new transactional/report/tool DB cases; expanded wrapper has not yet run.
- O4 final pre-change baseline on50k synthetic rows: revenue p95 concurrency1=241.0ms/concurrency10=2481.0ms, peak RSS858MiB; concurrent indexed Booking.count read p95=2189.1ms. Bookings p95 concurrency1=82.2ms/concurrency10=809.3ms, peak RSS671MiB. Direct builders/local DB only, not HTTP or booking-create/payment capacity. Earlier timings were superseded after comparator-ordering correction.

- Final integrated outbox transport rerun: **2/2 actual transport cases passed**,42.674s; required-path parser PASS (`o1-transport-final-integrated.json`). Dedicated Redis was restored, and pending lease expiration plus process interruption exercised the real consumer.

- Dashboard final lint exited0:0 errors and10 warnings in untouched files (`d1-dashboard-lint-final.log`). Root diff whitespace check passed; existing migrations, lockfile, shared schemas and hand-written API client are unchanged.

## Final local integration gate (2026-09-05)

- Backend final full unit run: **798 passing suites /7,236 passing tests**,0 failures,1 existing skipped legacy-import placeholder;55.934s (`backend-final-unit-accepted.json`). Earlier broad run caught5 scenario failures from an old transaction mock lacking `$queryRaw`; root updated that fixture and26/26 scenario cases passed before the full rerun. Jest emitted a worker teardown warning; this is retained in the raw log.
- Backend production build and lint exited0 (0 errors/7 warnings). Backend source/test typecheck passed after correcting the R1 logging-client generic. Separate typecheck of all new data-integrity/performance scripts passed after fixing a readonly CLI argument annotation.
- Expanded critical real-DB gate: **15 suites/128 tests passed,0 skipped**,23.541s; required-path/exit-code parser PASS (`final-critical-expanded-accepted.json`). Earlier4 failures exposed invoice tests using nonexistent booking IDs; valid booking fixtures now preserve the same invoice assertions. A later oldest-outbox-age assertion assumed an empty shared event table; it now measures the oldest persisted row and checks bounded collection time. No app invariant was weakened.
- Fresh production backend built from current source uses synthetic smokeDB96 behind localhost-only outbound sandbox. Finance UI **4/4 passed**,5.5s (`final-built-finance-ui.log`); fresh home render/reload2/2 passed. Program edit initially hit the unchanged auth20/15min limiter (confirmed429/432-second Retry-After); after respecting the full wait its isolated rerun passed1/1 in17.9s (`final-built-program-ui-after-limit.log`). The seven selected fresh built journeys are green; full42-case smoke remains unpassed.
- Direct `pnpm openapi:sync` correctly encountered404 because Swagger is hidden under production. Used the existing `WRITE_OPENAPI_SPEC=1` build snapshot path and dashboard `openapi:generate` instead. Both snapshot and generated types are byte-unchanged. API client drift verifies54 endpoints; OpenAPI coverage gate passes.
- O4 independent review round2 accepts bounded SQL/telemetry source. Final50k direct-builder p95 at concurrency10: revenue152.9ms (baseline2481.0ms), bookings90.1ms (baseline809.3ms); peak RSS at most127MiB vs revenue baseline858MiB. Exact output equality at5k/50k. Actual aggregate EXPLAIN plans recorded; final after run reserved the shared Postgres lane. No claim about payment/booking-write p95, HTTP or multiple instances.
- O4 metrics now execute three aggregate queries on authorized scrape with30s singleflight caching. Unknown event types retain valid pending/failed distinctions and oldest pending age. Unsupported consumer/pool/deadlock dimensions are omitted. Monitoring never chooses recollection policy or writes business data.
- R1 independent review round2 accepts R1.1-3 only. Corrected package-invoice coverage, conservative fresh/page/resumed coverage, actual query event capture with READ ONLY + no-DML assertions, persisted fixture count/content hashes, CLI0600/no-overwrite/missing-env coverage. Arbitrary resumption never certifies a global pass; multiple pages are separate snapshots. No repair/apply implementation or customer inventory performed.

- Narrow teardown diagnosis: new telemetry/controller and data-integrity CLI suites **5/24 passed** with `--detectOpenHandles`,6.982s and no reported handles. The broad Jest worker warning remains recorded, with no proven production leak. Removed the one newly introduced unused report-helper import; focused lint passes. Six existing backend warnings remain outside this change.

- Final source/test typecheck rerun exited0 after the last test fixture/type-only corrections (`backend-final-typecheck-release.log`). Final source base remains703e944487a55ebadc579e241e50015c913e56d8; no commit, push, merge or deployment was performed. Working changes and local evidence are retained for review.

## Required next decision

F1 writer wiring waits for the approved financial rule: after a partial refund, may a new collection be created for the resulting outstanding amount, or should new collection remain blocked on that invoice? The pure helper supports either explicit choice and has no default policy. F2/T1/D2/D3/D4/O2/O3 and full R1 repair or O4 mixed-write acceptance remain sequenced behind the relevant financial contracts. Historical canonicalization/index promotion and production/sandbox/release gates remain separate authorization/evidence boundaries.
