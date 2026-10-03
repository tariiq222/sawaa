# Booking lifecycle and cancellation — release candidate acceptance

Date: 2026-10-03. Branch: `codex/booking-lifecycle-cancellation`. Base: `6d47f75e72376d368a5884b88d5633f9fb0cb2a6` (develop).

This record supplements the two existing local acceptance reports; it does not rewrite their historical evidence. Candidate publication is authorized to develop and OpenShip staging only. Production data, branches and deployments are outside this authorization.

## Scope

Deposit-paid appointments have confirmed operational actions with the remaining balance intact. Expiry needs an explicit hold deadline, and refund-only actions retain appointment state. Immediate customer cancellation has configurable eligibility and separate refund policy. Legacy requests reconcile late captures. Center cancellation refunds full available paid money before program start and requires an explicit employee amount per participant afterwards. Existing terminal and historical records are preserved.

One additive migration adds four BookingSettings fields and a policy enum. Customer cancellation activation defaults to false. No historical backfill, record replacement, deletion, payment-provider credential migration or production database operation is included.

Release-gate work adds all four new SQL suites to both critical execution and required-result validation. The old scenario expecting a deposit-confirmed booking to expire was corrected to prove unchanged booking/payment/invoice/outbox state. Test servers now bind one loopback ephemeral listener per suite instead of allowing Supertest to open/close per request; auth rules and assertions are unchanged.

## Fresh verification

Evidence directory (private local artifacts): `/Users/tariq/.codex/routing-review/evidence/cancellation-staging-20261003/`.

| Check | Result | Evidence |
| --- | --- | --- |
| Finance refund/outcome unit suites | 3 suites, 79 passed; expected RED first | `provider-preflight-red.log`, `refund-handler-green.log` |
| All critical real SQL suites | 36 suites, 308 passed, no skips, empty disposable database with 111 migrations | `gate-db-migrate.log`, `critical-bound-server-final.log` |
| Dashboard production-build smoke | 42 passed, no skips, synthetic admin/reception/employee/chat fixtures | `dashboard-smoke-production.log` |
| Backend and dashboard builds, backend types and scoped lint | Passed | `backend-build.log`, `backend-types.log`, `dashboard-production-build.log`, coordinator ESLint exit 0 |
| Prior frontend/mobile/contracts | Preserved reviewed file hashes except explicitly reviewed release-gate and refund files | Earlier local acceptance reports |
| Independent review | No actionable P1/P2 in full candidate inventory, final provider fix or listener changes | Scoped review reports in task scratch directory |

Earlier full-gate runs were not accepted: a stale deposit-expiry assertion was fixed; reused test data polluted a global finance audit; intermittent socket/HTTP failures required listener ownership hardening and a fresh-database run. Their exact prior cause is not fully proven. Development-server smoke runs timed out on route loading and redirects; a focused rerun passed but full development runs remained unstable. The release gate therefore uses a built dashboard; its full smoke run passed without changing assertions or increasing timeouts.

## Real Moyasar Sandbox acceptance

Only `sk_test_`/`pk_test_` credentials were used. Actual provider payments were created in Sandbox, then linked to synthetic local ledger fixtures to exercise the real HTTP cancellation/refund handlers, durable events and settlement workers. This proves refund integration; it is not checkout, 3DS, webhook or production-provider acceptance.

| Scenario | Observed result |
| --- | --- |
| Center cancellation before start | SAR300 refunded locally and at provider; booking cancelled; one refund attempt |
| Center cancellation after start | Employee-selected SAR150 of SAR300 refunded; booking cancelled; one attempt |
| Price-correction refund | SAR50 refunded; appointment remains CONFIRMED |
| Unknown provider reference | New cancellation request FAILED after one typed preflight404; zero refunded |
| Repeated cancellation | No new refund request or additional settled amount |
| Customer outcome | Durable in-app success/failure notifications and published outcome events verified |

Sandbox revealed that a typed preflight404 previously remained PROCESSING. The handler now terminally fails only definitive BEFORE_CALL not-found errors using owned CAS/lease cleanup and atomic outcome capture. Transient errors and CALL_UNKNOWN remain reconcilable. Seven unit regressions cover the boundary. The old pre-fix fixture later reconciled to FAILED with zero money moved; new requests fail on the first attempt.

Provider settlement amounts and in-app notification state were read back independently. External email/push delivery and physical-device behavior are not claimed.

## Staging rollout conditions

Target: Sawaa Staging (`proj_7M0RNj59nQnafh1m`), branch develop, website `https://staging.sawaa.sa`. Its OpenShip environment label is Production, but this is the separate staging project. The real production project is excluded.

Read-only preflight observed active deployment `dep_hCuzOGJPTzwqHonO` at the base commit, six healthy services, internal network `openship-sawaa-staging`, distinct staging bind paths and one backend worker. Staging had 110 applied migrations; only the additive cancellation settings migration was pending. The normal backend startup performs migrations and no seed. All old backend consumers must retire before new cancellation/refund behavior is exercised. No provider egress expansion is authorized.

GitHub develop branch protection was not configured at inspection. Therefore the coordinator must check both GitHub Actions jobs manually before merge; local green checks do not bypass CI. Deployment identity/running source, health, migration outcome, synthetic staging flows and owner manual acceptance remain separate post-merge gates.

Rollback must preserve the database and current financial events. Reverting to an old worker that cancels appointments on refund requires compatibility assessment; restoring an old database is not a code rollback.

## Measurement boundary

Policy astra-effort-v1; task class deployment, complexity high. Native Astra high reviewers/implementer; coordinator model/effort and worker session counters were not exposed. Baseline began after initial preflight, so whole-task tokens and savings remain unknown. The receipt stays partial. No paid model API was used.

## CI follow-up: existing scenario fixtures

The first PR149 Actions run passed all 308 critical real-SQL cases but failed two cases in the older unit scenario file. Its raw-query mock did not support `Prisma.Sql`, and it still expected deposit-confirmed appointments to expire. The updated rejection fixture now contains the durable prior CONFIRMED state and an unpaid invoice, asserts lock/read ordering and guarded writes, and returns the actual mutated fixture instead of a fabricated success row. The deposit case proves rejection without financial or event writes. The final focused scenario suite passed all 26 tests (`booking-scenarios-final.log`). The preceding broad local backend run passed 8292 cases and exposed that one fixture inconsistency; it is not recorded as a green full run. The database-dependent legacy-import spec remains outside the ordinary unit lane.

Expanded local checks also passed dashboard 281 files / 2220 tests, website 103 files / 907 tests, and mobile 171 suites / 1143 tests with coverage thresholds. Mobile's old service-identity fixture gained the new cancellation-preview hook mock; all its original identity assertions remain. Mobile types and the changed test lint passed. These follow-up changes affect test fixtures only, not deployed application logic. Both Actions jobs must still pass on the new PR head before merge.

## CI follow-up: cancellation API documentation

Actions run 37149140264 passed backend, dashboard, website and mobile checks and the 308 critical SQL cases, then stopped at 25 new missing documentation fields in the program-cancellation DTOs. Swagger descriptions/examples were added and the backend snapshot/dashboard client regenerated. The local coverage ratchet now passes across 300 routes with zero new gaps; the existing baseline was not widened. Comparing the old/new OpenAPI documents after removing only description/example fields proves unchanged schema semantics (`openapi-doc-semantic-check.json`). API-client drift and migration immutability also pass. This documentation-only follow-up must pass the final Actions run before merge and staging delivery.
