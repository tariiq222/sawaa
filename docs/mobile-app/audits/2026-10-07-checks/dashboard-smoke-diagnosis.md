# Dashboard smoke diagnosis — final mobile UI batch

Read-only diagnosis of the orchestrator run; no new test runs, product/config/auth modifications, provider requests, or database operations performed.

## Outcome and cause

The run exited 1 after 42 tests: **31 failed, 10 passed, 1 skipped** (dashboard-smoke.log:1599–1635). The 10 passes comprise 4 authentication setup tests and 6 smoke tests. All **31 failed error records are HTTP 429 at login**, before the page assertions or feature operation: 15 report Nest `ThrottlerException`, 16 report Express `Too many authentication attempts`. First failure: log:521–538; final failure:1564–1579; program seeding failure:1256–1270. Primary `apps/dashboard/test-results/.last-run.json` independently records failed status and 31 failed IDs; the ADMIN error-context confirms the same first login failure.

Repeated API authentication is built into `loginAs` (`/Users/tariq/code/sawaa/apps/dashboard/e2e/fixtures/auth.ts:69–74,171–187`). The helper's own comment recommends pre-authenticated storage state instead of repeated logins (65–67). Setup already saves state and smoke depends on setup (`playwright.config.ts:55–65`), but most failed tests call `loginAs` again. Reports call it in each of 9 tests (`reports.smoke.spec.ts:29–63`); the program spec fails in its API token prerequisite (`programs-edit-submit.spec.ts:43–47`) before seeding or PATCH.

Backend evidence explains both observed response variants:
- `/Users/tariq/code/sawaa/apps/backend/src/api/public/auth.controller.ts:82–83`: login throttle 5 requests/60 seconds.
- `/Users/tariq/code/sawaa/apps/backend/src/main.ts:49–54`: Express `/api/v1/auth` limiter 20 requests/15 minutes, message matching the later failures.
- `/Users/tariq/code/sawaa/apps/backend/src/app.module.ts:53–55`: supported automated-test throttle bypass.
- `/Users/tariq/code/sawaa/apps/backend/src/config/env.validation.ts:172–177`: bypass explicitly rejected for production.

## Coverage

Passing smoke tests: canonical booking proxy route mounting; EMPLOYEE no QuickActions; both login-error tests; UI admin login/logout; dashboard root render (log:86,146,199,240,321,518). Passing setup tests: admin, owner alias, receptionist, employee (25,28,31,34).

Failed: 3 role-widget tests, 2 dashboard home render tests, 16 navigation tests, 1 program edit-submit test, 9 reports tests (log:1599–1630). These failures provide no feature acceptance because their authentication prerequisite stopped execution.

Skipped: conversation reception flow (log:87). Source intentionally skips when the disposable `PW_CHAT_CONVERSATION_NAME` fixture is absent (`/Users/tariq/code/sawaa/apps/dashboard/e2e/smoke/conversations.spec.ts:9–15`).

## Attribution and remedy

This is an environment/test-harness blocker, with no demonstrated mobile regression. The command and stack paths show the run used the primary dashboard checkout (`dashboard-smoke.log:2,23–34,533–538`), while integration tracked changes are confined to `apps/mobile/`. The mobile UI batch cannot account for direct API login throttles from unchanged backend/dashboard source. This is not a clean baseline A/B comparison, so absence of regressions is not proven.

Minimal safe remedy for the orchestrator: restart only the disposable local test backend with its existing `THROTTLER_DISABLED=true` test setting, then perform one smoke rerun. This should disable both observed limiters without changing guard/token semantics or production. Do not modify production settings or clear shared Redis. A longer-term harness change to reduce repeated logins would require a separately scoped implementation and token-rotation checks; merely reusing mutable refresh state can create other failures.

The log also emits Frontman middleware Edge Runtime warnings (`dashboard-smoke.log:46–84`; primary middleware.ts:1,12–14). They are not the observed failure cause: all errors are login429 and six smoke tests render/pass. They remain an independent primary-checkout warning.
